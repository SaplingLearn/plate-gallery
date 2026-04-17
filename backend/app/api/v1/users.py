from __future__ import annotations

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import UnauthorizedError
from app.core.security import verify_jwt
from app.db.models import User
from app.db.session import get_db
from app.schemas.user import UserProfileResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/sync", response_model=UserProfileResponse)
async def sync_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """Upsert user on first login. Creates or updates the user row from JWT claims."""
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError()
    token = authorization.removeprefix("Bearer ").strip()
    claims = await verify_jwt(token)

    result = await db.execute(select(User).where(User.id == claims.sub))
    user = result.scalar_one_or_none()

    meta = claims.user_metadata
    display_name = meta.get("full_name") or meta.get("name") or ""
    if not display_name and claims.email:
        display_name = claims.email.split("@")[0]
    avatar_url = meta.get("avatar_url") or meta.get("picture")

    if user is None:
        user = User(
            id=claims.sub,
            email=claims.email,
            display_name=display_name or "Anonymous",
            avatar_url=avatar_url,
        )
        db.add(user)
    else:
        if display_name:
            user.display_name = display_name
        if avatar_url:
            user.avatar_url = avatar_url
        if claims.email:
            user.email = claims.email

    await db.commit()
    await db.refresh(user)

    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        created_at=user.created_at.isoformat(),
    )
