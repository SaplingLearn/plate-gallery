from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user_optional
from app.api.v1.plates import plate_to_response
from app.core.errors import NotFoundError
from app.db.models import Plate, PlateStatus, State, User
from app.db.session import get_db
from app.schemas.state import StateDetailResponse, StateInfo

router = APIRouter(prefix="/states", tags=["states"])


@router.get("/{code}", response_model=StateDetailResponse)
async def get_state_detail(
    code: str,
    user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> StateDetailResponse:
    code = code.upper()

    # Get state
    state_result = await db.execute(select(State).where(State.code == code))
    state = state_result.scalar_one_or_none()
    if state is None:
        raise NotFoundError(f"State not found: {code}")

    # Total count
    count_result = await db.execute(
        select(func.count()).select_from(Plate).where(
            Plate.state_code == code, Plate.status == PlateStatus.approved
        )
    )
    total_count = count_result.scalar() or 0

    # Top 10 by score
    top_result = await db.execute(
        select(Plate)
        .where(Plate.state_code == code, Plate.status == PlateStatus.approved)
        .order_by(Plate.score.desc(), Plate.created_at.desc())
        .limit(10)
    )
    top_plates = list(top_result.scalars().all())

    hero_plate = top_plates[0] if top_plates else None

    return StateDetailResponse(
        state=StateInfo(code=state.code, name=state.name),
        hero_plate=plate_to_response(hero_plate) if hero_plate else None,
        top_10=[plate_to_response(p) for p in top_plates],
        total_count=total_count,
    )
