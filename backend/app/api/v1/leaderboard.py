from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user_optional
from app.api.v1.plates import plate_to_response
from app.db.models import Plate, PlateStatus, User
from app.db.session import get_db
from app.schemas.leaderboard import LeaderboardResponse

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])

# Simple cache
_cache: dict[str, Any] = {}
CACHE_TTL = 60


@router.get("/overall", response_model=LeaderboardResponse)
async def leaderboard_overall(
    window: Literal["day", "week", "month", "all"] = Query(default="all"),
    limit: int = Query(default=50, ge=1, le=100),
    user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> LeaderboardResponse:
    cache_key = f"leaderboard_{window}_{limit}"
    now = time.time()
    if cache_key in _cache and now - _cache[f"{cache_key}_time"] < CACHE_TTL:
        return _cache[cache_key]

    stmt = (
        select(Plate)
        .where(Plate.status == PlateStatus.approved)
        .order_by(Plate.score.desc(), Plate.created_at.desc())
        .limit(limit)
    )

    if window == "day":
        stmt = stmt.where(Plate.created_at > func.now() - text("interval '1 day'"))
    elif window == "week":
        stmt = stmt.where(Plate.created_at > func.now() - text("interval '7 days'"))
    elif window == "month":
        stmt = stmt.where(Plate.created_at > func.now() - text("interval '30 days'"))

    result = await db.execute(stmt)
    plates = list(result.scalars().all())

    response = LeaderboardResponse(
        items=[plate_to_response(p) for p in plates],
        window=window,
        generated_at=datetime.now(UTC).isoformat(),
    )

    _cache[cache_key] = response
    _cache[f"{cache_key}_time"] = now
    return response
