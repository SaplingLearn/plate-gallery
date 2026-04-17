from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_client_ip, get_current_user
from app.core.config import settings
from app.core.errors import NotFoundError
from app.db.models import Plate, PlateStatus, User, Vote
from app.db.session import get_db
from app.schemas.vote import VoteRequest, VoteResponse
from app.services.rate_limit import check_and_record

router = APIRouter(prefix="/plates", tags=["votes"])


@router.post("/{plate_id}/vote", response_model=VoteResponse)
async def vote_on_plate(
    plate_id: uuid.UUID,
    body: VoteRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VoteResponse:
    # Check plate exists and is approved
    result = await db.execute(
        select(Plate).where(Plate.id == plate_id, Plate.status == PlateStatus.approved)
    )
    plate = result.scalar_one_or_none()
    if plate is None:
        raise NotFoundError("Plate not found")

    # Rate limit
    ip = get_client_ip(request)
    await check_and_record(
        db,
        bucket="vote",
        user_id=user.id,
        ip=ip,
        limits=[(settings.RATE_LIMIT_VOTES_PER_MINUTE, timedelta(minutes=1))],
    )

    # Get existing vote
    existing_result = await db.execute(
        select(Vote).where(Vote.user_id == user.id, Vote.plate_id == plate_id)
    )
    existing_vote = existing_result.scalar_one_or_none()

    if body.value == 0:
        # Retract vote
        if existing_vote:
            if existing_vote.value == 1:
                plate.upvotes = max(0, plate.upvotes - 1)
            else:
                plate.downvotes = max(0, plate.downvotes - 1)
            await db.delete(existing_vote)
    elif existing_vote:
        # Update existing vote
        if existing_vote.value != body.value:
            if existing_vote.value == 1:
                plate.upvotes = max(0, plate.upvotes - 1)
            else:
                plate.downvotes = max(0, plate.downvotes - 1)
            if body.value == 1:
                plate.upvotes += 1
            else:
                plate.downvotes += 1
            existing_vote.value = body.value
    else:
        # New vote
        vote = Vote(user_id=user.id, plate_id=plate_id, value=body.value)
        db.add(vote)
        if body.value == 1:
            plate.upvotes += 1
        else:
            plate.downvotes += 1

    plate.score = plate.upvotes - plate.downvotes
    await db.commit()
    await db.refresh(plate)

    # Get current user vote
    user_vote = 0
    if body.value != 0:
        user_vote = body.value

    return VoteResponse(
        score=plate.score,
        upvotes=plate.upvotes,
        downvotes=plate.downvotes,
        user_vote=user_vote,
    )
