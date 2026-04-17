from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.state import MapSummaryResponse, StateSummary

router = APIRouter(prefix="/map", tags=["map"])

# Simple in-memory cache
_cache: dict[str, Any] = {}
CACHE_TTL = 60  # seconds


@router.get("/summary", response_model=MapSummaryResponse)
async def map_summary(db: AsyncSession = Depends(get_db)) -> MapSummaryResponse:
    now = time.time()
    if "map_summary" in _cache and now - _cache["map_summary_time"] < CACHE_TTL:
        return _cache["map_summary"]

    # Get all states with plate counts and top plate
    query = text("""
        SELECT
            s.code,
            s.name,
            COALESCE(counts.cnt, 0) AS plate_count,
            top_plates.plate_id::text AS top_plate_id
        FROM states s
        LEFT JOIN (
            SELECT state_code, count(*) AS cnt
            FROM plates
            WHERE status = 'approved'
            GROUP BY state_code
        ) counts ON counts.state_code = s.code
        LEFT JOIN LATERAL (
            SELECT id AS plate_id
            FROM plates
            WHERE state_code = s.code AND status = 'approved'
            ORDER BY score DESC, created_at DESC
            LIMIT 1
        ) top_plates ON true
        ORDER BY s.code
    """)

    result = await db.execute(query)
    rows = result.all()

    states = [
        StateSummary(
            code=row.code,
            name=row.name,
            plate_count=row.plate_count,
            top_plate_id=row.top_plate_id,
        )
        for row in rows
    ]

    response = MapSummaryResponse(states=states)
    _cache["map_summary"] = response
    _cache["map_summary_time"] = now
    return response
