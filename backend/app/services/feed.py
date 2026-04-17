from __future__ import annotations

import base64
import json
import uuid

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Plate, PlateStatus, Vote


def encode_cursor(data: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode()


def decode_cursor(cursor: str) -> dict:
    return json.loads(base64.urlsafe_b64decode(cursor.encode()))


async def query_feed(
    db: AsyncSession,
    *,
    state: str | None = None,
    sort: str = "recent",
    cursor: str | None = None,
    limit: int = 24,
    user_id: uuid.UUID | None = None,
    include_rejected: bool = False,
    author_id: uuid.UUID | None = None,
) -> tuple[list[Plate], str | None, dict[uuid.UUID, int]]:
    """Query plates for the feed. Returns (plates, next_cursor, user_votes_map)."""
    stmt = select(Plate)

    if author_id:
        stmt = stmt.where(Plate.author_id == author_id)
        if not include_rejected:
            stmt = stmt.where(Plate.status == PlateStatus.approved)
    else:
        stmt = stmt.where(Plate.status == PlateStatus.approved)

    if state:
        stmt = stmt.where(Plate.state_code == state.upper())

    if sort == "recent":
        stmt = stmt.order_by(Plate.created_at.desc(), Plate.id.desc())
        if cursor:
            cur = decode_cursor(cursor)
            stmt = stmt.where(
                (Plate.created_at < cur["created_at"])
                | (
                    and_(
                        Plate.created_at == cur["created_at"],
                        Plate.id < uuid.UUID(cur["id"]),
                    )
                )
            )
    elif sort in ("top_day", "top_week", "top_all"):
        stmt = stmt.order_by(Plate.score.desc(), Plate.created_at.desc())
        from sqlalchemy import func, text

        if sort == "top_day":
            stmt = stmt.where(Plate.created_at > func.now() - text("interval '1 day'"))
        elif sort == "top_week":
            stmt = stmt.where(Plate.created_at > func.now() - text("interval '7 days'"))
        if cursor:
            cur = decode_cursor(cursor)
            stmt = stmt.where(
                (Plate.score < cur["score"])
                | (
                    and_(
                        Plate.score == cur["score"],
                        Plate.created_at < cur["created_at"],
                    )
                )
            )

    stmt = stmt.limit(limit + 1)
    result = await db.execute(stmt)
    plates = list(result.scalars().all())

    next_cursor = None
    if len(plates) > limit:
        plates = plates[:limit]
        last = plates[-1]
        next_cursor = encode_cursor(
            {
                "created_at": last.created_at.isoformat(),
                "id": str(last.id),
                "score": last.score,
            }
        )

    # Fetch user votes if authenticated
    user_votes: dict[uuid.UUID, int] = {}
    if user_id and plates:
        plate_ids = [p.id for p in plates]
        vote_stmt = select(Vote.plate_id, Vote.value).where(
            Vote.user_id == user_id, Vote.plate_id.in_(plate_ids)
        )
        vote_result = await db.execute(vote_stmt)
        user_votes = {row.plate_id: row.value for row in vote_result}

    return plates, next_cursor, user_votes
