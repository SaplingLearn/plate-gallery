from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class VoteRequest(BaseModel):
    value: Literal[1, -1, 0]


class VoteResponse(BaseModel):
    score: int
    upvotes: int
    downvotes: int
    user_vote: Literal[1, -1, 0]
