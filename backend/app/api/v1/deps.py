from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import UnauthorizedError
from app.core.security import verify_jwt
from app.db.models import User
from app.db.session import get_db


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError()
    token = authorization.removeprefix("Bearer ").strip()
    claims = await verify_jwt(token)
    result = await db.execute(select(User).where(User.id == claims.sub))
    user = result.scalar_one_or_none()
    if user is None:
        raise UnauthorizedError("User not synced. Call POST /api/v1/users/sync first.")
    return user


async def get_current_user_optional(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    try:
        claims = await verify_jwt(token)
    except Exception:
        return None
    result = await db.execute(select(User).where(User.id == claims.sub))
    return result.scalar_one_or_none()


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"
