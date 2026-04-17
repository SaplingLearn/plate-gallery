from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import RateLimitedError
from app.db.models import RateLimitEvent


async def check_and_record(
    db: AsyncSession,
    bucket: str,
    user_id: uuid.UUID | None,
    ip: str | None,
    limits: list[tuple[int, timedelta]],
) -> None:
    """Check rate limits and record the event. Raises RateLimitedError if over limit."""
    for max_count, window in limits:
        cutoff = func.now() - window
        if user_id:
            stmt = select(func.count()).where(
                RateLimitEvent.user_id == user_id,
                RateLimitEvent.bucket == bucket,
                RateLimitEvent.created_at > cutoff,
            )
        elif ip:
            stmt = select(func.count()).where(
                RateLimitEvent.ip == ip,
                RateLimitEvent.bucket == bucket,
                RateLimitEvent.created_at > cutoff,
            )
        else:
            continue

        result = await db.execute(stmt)
        count = result.scalar() or 0
        if count >= max_count:
            retry_after = int(window.total_seconds())
            raise RateLimitedError(retry_after=retry_after)

    event = RateLimitEvent(user_id=user_id, ip=ip, bucket=bucket)
    db.add(event)
    await db.flush()
