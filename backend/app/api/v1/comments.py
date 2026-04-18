from __future__ import annotations

import re
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_client_ip, get_current_user
from app.core.config import settings
from app.core.errors import NotFoundError, ValidationError
from app.db.models import Comment, Plate, PlateStatus, User
from app.db.session import get_db
from app.schemas.comment import CommentResponse, CreateCommentRequest
from app.schemas.common import PaginatedResponse
from app.schemas.user import AuthorResponse
from app.services.feed import decode_cursor, encode_cursor
from app.services.moderation.text_check import check_text
from app.services.rate_limit import check_and_record

router = APIRouter(prefix="/plates", tags=["comments"])


def comment_to_response(comment: Comment) -> CommentResponse:
    return CommentResponse(
        id=str(comment.id),
        plate_id=str(comment.plate_id),
        author=AuthorResponse(
            id=str(comment.author.id),
            display_name=comment.author.display_name,
            avatar_url=comment.author.avatar_url,
        ),
        body=comment.body,
        created_at=comment.created_at.isoformat(),
    )


@router.get("/{plate_id}/comments", response_model=PaginatedResponse[CommentResponse])
async def list_comments(
    plate_id: uuid.UUID,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[CommentResponse]:
    # Check plate exists
    plate_result = await db.execute(select(Plate.id).where(Plate.id == plate_id))
    if plate_result.scalar_one_or_none() is None:
        raise NotFoundError("Plate not found")

    stmt = (
        select(Comment)
        .where(Comment.plate_id == plate_id)
        .order_by(Comment.created_at.desc(), Comment.id.desc())
    )

    if cursor:
        cur = decode_cursor(cursor)
        from sqlalchemy import and_

        stmt = stmt.where(
            (Comment.created_at < cur["created_at"])
            | (and_(Comment.created_at == cur["created_at"], Comment.id < uuid.UUID(cur["id"])))
        )

    stmt = stmt.limit(limit + 1)
    result = await db.execute(stmt)
    comments = list(result.scalars().all())

    next_cursor = None
    if len(comments) > limit:
        comments = comments[:limit]
        last = comments[-1]
        next_cursor = encode_cursor(
            {"created_at": last.created_at.isoformat(), "id": str(last.id)}
        )

    return PaginatedResponse(
        items=[comment_to_response(c) for c in comments],
        next_cursor=next_cursor,
    )


@router.post("/{plate_id}/comments", response_model=CommentResponse)
async def create_comment(
    plate_id: uuid.UUID,
    body: CreateCommentRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CommentResponse:
    # Check plate exists and is approved
    plate_result = await db.execute(
        select(Plate).where(Plate.id == plate_id, Plate.status == PlateStatus.approved)
    )
    plate = plate_result.scalar_one_or_none()
    if plate is None:
        raise NotFoundError("Plate not found")

    # Rate limit
    ip = get_client_ip(request)
    await check_and_record(
        db,
        bucket="comment",
        user_id=user.id,
        ip=ip,
        limits=[
            (settings.RATE_LIMIT_COMMENTS_PER_MINUTE, timedelta(minutes=1)),
            (settings.RATE_LIMIT_COMMENTS_PER_DAY, timedelta(days=1)),
        ],
    )

    # Text moderation
    comment_body = body.body.strip()
    comment_body = re.sub(r"[\x00-\x1f]", "", comment_body)
    text_ok, text_reason = check_text("", comment_body)
    if not text_ok:
        raise ValidationError(f"Comment rejected: {text_reason}")

    comment = Comment(
        plate_id=plate_id,
        author_id=user.id,
        body=comment_body,
    )
    db.add(comment)

    await db.commit()
    await db.refresh(comment)

    return comment_to_response(comment)
