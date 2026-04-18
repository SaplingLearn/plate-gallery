from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.errors import NotFoundError
from app.db.models import Favorite, Plate, User
from app.db.session import get_db

router = APIRouter(tags=["favorites"])


@router.post("/plates/{plate_id}/favorite")
async def toggle_favorite(
    plate_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    plate_result = await db.execute(select(Plate).where(Plate.id == plate_id))
    if plate_result.scalar_one_or_none() is None:
        raise NotFoundError("Plate not found")

    fav_result = await db.execute(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.plate_id == plate_id)
    )
    existing = fav_result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()
        return {"is_favorited": False}

    db.add(Favorite(user_id=user.id, plate_id=plate_id))
    await db.commit()
    return {"is_favorited": True}
