from __future__ import annotations

from pydantic import BaseModel

from app.schemas.plate import PlateResponse


class LeaderboardResponse(BaseModel):
    items: list[PlateResponse]
    window: str
    generated_at: str
