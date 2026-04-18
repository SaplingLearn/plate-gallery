from __future__ import annotations

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
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
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError()
    token = authorization.removeprefix("Bearer ").strip()
    claims = await verify_jwt(token)

    meta = claims.user_metadata
    display_name = meta.get("full_name") or meta.get("name") or ""
    if not display_name and claims.email:
        display_name = claims.email.split("@")[0]
    avatar_url = meta.get("avatar_url") or meta.get("picture")

    stmt = (
        insert(User)
        .values(
            id=claims.sub,
            email=claims.email,
            display_name=display_name or "Anonymous",
            avatar_url=avatar_url,
        )
        .on_conflict_do_update(
            index_elements=["id"],
            set_={
                "email": claims.email,
                "display_name": display_name or User.display_name,
                "avatar_url": avatar_url or User.avatar_url,
            },
        )
    )
    await db.execute(stmt)
    await db.commit()

    result = await db.execute(select(User).where(User.id == claims.sub))
    user = result.scalar_one()

    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        created_at=user.created_at.isoformat(),
    )
