from __future__ import annotations

from pydantic import BaseModel

from app.schemas.plate import PlateResponse


class StateSummary(BaseModel):
    code: str
    name: str
    plate_count: int
    top_plate_id: str | None = None


class MapSummaryResponse(BaseModel):
    states: list[StateSummary]


class StateInfo(BaseModel):
    code: str
    name: str


class StateDetailResponse(BaseModel):
    state: StateInfo
    hero_plate: PlateResponse | None = None
    top_10: list[PlateResponse] = []
    total_count: int = 0
