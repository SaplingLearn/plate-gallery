from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user, get_current_user_optional
from app.core.errors import (
    ModerationRejectedError,
    NotFoundError,
    ValidationError,
)
from app.db.models import Plate, PlateStatus, State, UploadToken, User
from app.db.session import get_db
from app.schemas.common import PaginatedResponse
from app.schemas.plate import CreatePlateRequest, PlateDetailResponse, PlateResponse
from app.schemas.user import AuthorResponse
from app.services.feed import query_feed
from app.services.moderation.pipeline import run_moderation
from app.services.storage import storage_service

router = APIRouter(prefix="/plates", tags=["plates"])

PLATE_TEXT_RE = re.compile(r"^[A-Z0-9 \-]{1,8}$")


def plate_to_response(
    plate: Plate, user_vote: int = 0, include_status: bool = False
) -> PlateResponse:
    state_name = plate.state.name if plate.state else plate.state_code
    author = None
    if plate.author:
        author = AuthorResponse(
            id=str(plate.author.id),
            display_name=plate.author.display_name,
            avatar_url=plate.author.avatar_url,
        )

    resp = PlateResponse(
        id=str(plate.id),
        image_url=storage_service.public_url(plate.image_path),
        image_thumb_url=storage_service.transform_url(plate.image_path, width=400),
        plate_text=plate.plate_text,
        state_code=plate.state_code,
        state_name=state_name,
        author=author,
        score=plate.score,
        upvotes=plate.upvotes,
        downvotes=plate.downvotes,
        user_vote=user_vote,
        comment_count=plate.comment_count,
        caption=plate.caption,
        created_at=plate.created_at.isoformat(),
    )
    if include_status:
        resp.status = plate.status.value
        resp.rejection_reason = plate.rejection_reason.value if plate.rejection_reason else None
    return resp


@router.get("", response_model=PaginatedResponse[PlateResponse])
async def list_plates(
    state: str | None = Query(default=None, max_length=2),
    sort: Literal["recent", "top_day", "top_week", "top_all"] = Query(default="recent"),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=48),
    user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[PlateResponse]:
    user_id = user.id if user else None
    plates, next_cursor, user_votes = await query_feed(
        db, state=state, sort=sort, cursor=cursor, limit=limit, user_id=user_id
    )
    items = [plate_to_response(p, user_votes.get(p.id, 0)) for p in plates]
    return PaginatedResponse(items=items, next_cursor=next_cursor)


@router.get("/{plate_id}", response_model=PlateDetailResponse)
async def get_plate(
    plate_id: uuid.UUID,
    user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> PlateDetailResponse:
    result = await db.execute(select(Plate).where(Plate.id == plate_id))
    plate = result.scalar_one_or_none()
    if plate is None:
        raise NotFoundError("Plate not found")

    # User vote
    user_vote = 0
    if user:
        from app.db.models import Vote

        vote_result = await db.execute(
            select(Vote.value).where(Vote.user_id == user.id, Vote.plate_id == plate_id)
        )
        row = vote_result.first()
        if row:
            user_vote = row.value

    # Related plates (4 from same state, highest score, excluding self)
    related_stmt = (
        select(Plate)
        .where(
            Plate.state_code == plate.state_code,
            Plate.status == PlateStatus.approved,
            Plate.id != plate_id,
        )
        .order_by(Plate.score.desc(), Plate.created_at.desc())
        .limit(4)
    )
    related_result = await db.execute(related_stmt)
    related_plates = list(related_result.scalars().all())

    base = plate_to_response(plate, user_vote)
    return PlateDetailResponse(
        **base.model_dump(),
        related_plates=[plate_to_response(rp) for rp in related_plates],
        comments_enabled=True,
    )


@router.post("", response_model=PlateResponse)
async def create_plate(
    body: CreatePlateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlateResponse:
    # Validate upload token
    result = await db.execute(
        select(UploadToken).where(UploadToken.token == body.upload_token)
    )
    token = result.scalar_one_or_none()
    if token is None:
        raise ValidationError("Invalid upload token")
    if token.user_id != user.id:
        raise ValidationError("Upload token belongs to another user")
    if token.consumed_at is not None:
        raise ValidationError("Upload token already consumed")
    if token.expires_at < datetime.now(UTC):
        raise ValidationError("Upload token expired")
    if token.object_path != body.object_path:
        raise ValidationError("Object path mismatch")

    # Validate plate text
    plate_text = body.plate_text.upper().strip()
    plate_text = re.sub(r"\s+", " ", plate_text)
    if not PLATE_TEXT_RE.match(plate_text):
        raise ValidationError(
            "Invalid plate text. Use 1-8 alphanumeric characters, spaces, or dashes."
        )

    # Validate state
    state_result = await db.execute(select(State).where(State.code == body.state_code.upper()))
    state = state_result.scalar_one_or_none()
    if state is None:
        raise ValidationError(f"Invalid state code: {body.state_code}")

    # Validate caption
    caption = body.caption.strip() if body.caption else None
    if caption:
        caption = re.sub(r"[\x00-\x1f]", "", caption)

    # Download image for moderation
    try:
        image_bytes = await storage_service.download_object(body.object_path)
    except Exception:
        raise ValidationError("Could not retrieve uploaded image. Please try again.")

    # Run moderation
    mod_result = await run_moderation(db, image_bytes, plate_text, caption, body.state_code.upper())

    # Mark token consumed
    token.consumed_at = datetime.now(UTC)

    if not mod_result.approved:
        # Insert rejected plate so user can see why in their profile
        plate = Plate(
            author_id=user.id,
            state_code=body.state_code.upper(),
            plate_text=plate_text,
            caption=caption,
            image_path=body.object_path,
            image_phash=mod_result.phash,
            status=PlateStatus.rejected,
            rejection_reason=mod_result.reason,
            rejection_detail=mod_result.detail,
        )
        db.add(plate)
        await db.commit()
        raise ModerationRejectedError(
            reason=mod_result.reason or "other",
            explanation=mod_result.detail or "Upload rejected by moderation",
        )

    # Approved — create plate
    plate = Plate(
        author_id=user.id,
        state_code=body.state_code.upper(),
        plate_text=plate_text,
        caption=caption,
        image_path=body.object_path,
        image_phash=mod_result.phash,
        status=PlateStatus.approved,
        approved_at=datetime.now(UTC),
    )
    db.add(plate)
    await db.commit()
    await db.refresh(plate)

    return plate_to_response(plate)
