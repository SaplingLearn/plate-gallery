from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.api.v1.plates import plate_to_response
from app.db.models import Plate, User, Vote
from app.db.session import get_db
from app.schemas.common import PaginatedResponse
from app.schemas.plate import PlateResponse
from app.schemas.user import UserProfileResponse
from app.services.feed import decode_cursor, encode_cursor, query_feed

router = APIRouter(prefix="/me", tags=["profile"])


@router.get("", response_model=UserProfileResponse)
async def get_profile(user: User = Depends(get_current_user)) -> UserProfileResponse:
    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        created_at=user.created_at.isoformat(),
    )


@router.get("/plates", response_model=PaginatedResponse[PlateResponse])
async def get_my_plates(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=48),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[PlateResponse]:
    plates, next_cursor, user_votes = await query_feed(
        db,
        sort="recent",
        cursor=cursor,
        limit=limit,
        user_id=user.id,
        author_id=user.id,
        include_rejected=True,
    )
    items = [plate_to_response(p, user_votes.get(p.id, 0), include_status=True) for p in plates]
    return PaginatedResponse(items=items, next_cursor=next_cursor)


@router.get("/votes")
async def get_my_votes(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=48),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[dict]:
    stmt = (
        select(Vote)
        .where(Vote.user_id == user.id)
        .order_by(Vote.created_at.desc())
    )

    if cursor:
        cur = decode_cursor(cursor)

        stmt = stmt.where(Vote.created_at < cur["created_at"])

    stmt = stmt.limit(limit + 1)
    result = await db.execute(stmt)
    votes = list(result.scalars().all())

    next_cursor = None
    if len(votes) > limit:
        votes = votes[:limit]
        last = votes[-1]
        next_cursor = encode_cursor({"created_at": last.created_at.isoformat()})

    # Load the plates for these votes
    items = []
    for v in votes:
        plate_result = await db.execute(select(Plate).where(Plate.id == v.plate_id))
        plate = plate_result.scalar_one_or_none()
        if plate:
            items.append({
                "plate": plate_to_response(plate, v.value).model_dump(),
                "value": v.value,
                "voted_at": v.created_at.isoformat(),
            })

    return PaginatedResponse(items=items, next_cursor=next_cursor)
