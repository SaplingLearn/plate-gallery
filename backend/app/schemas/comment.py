from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.user import AuthorResponse


class CommentResponse(BaseModel):
    id: str
    plate_id: str
    author: AuthorResponse
    body: str
    created_at: str


class CreateCommentRequest(BaseModel):
    body: str = Field(min_length=1, max_length=500)
