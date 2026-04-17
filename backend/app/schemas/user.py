from __future__ import annotations

from pydantic import BaseModel


class AuthorResponse(BaseModel):
    id: str
    display_name: str
    avatar_url: str | None = None


class UserProfileResponse(BaseModel):
    id: str
    email: str | None = None
    display_name: str
    avatar_url: str | None = None
    created_at: str
