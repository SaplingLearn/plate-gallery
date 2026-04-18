from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.user import AuthorResponse


class PlateResponse(BaseModel):
    id: str
    image_url: str
    image_thumb_url: str
    plate_text: str
    state_code: str
    state_name: str
    author: AuthorResponse | None = None
    score: int
    upvotes: int
    downvotes: int
    user_vote: Literal[1, -1, 0] = 0
    comment_count: int
    caption: str | None = None
    created_at: str
    is_favorited: bool = False
    status: str | None = None
    rejection_reason: str | None = None


class PlateDetailResponse(PlateResponse):
    related_plates: list[PlateResponse] = []
    comments_enabled: bool = True


class CreatePlateRequest(BaseModel):
    upload_token: str
    object_path: str
    plate_text: str = Field(min_length=1, max_length=8)
    state_code: str = Field(min_length=2, max_length=2)
    caption: str | None = Field(default=None, max_length=280)
