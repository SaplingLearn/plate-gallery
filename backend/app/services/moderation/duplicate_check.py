from __future__ import annotations

import io

import imagehash
from PIL import Image
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def compute_phash(image_bytes: bytes) -> int:
    """Compute a 64-bit perceptual hash as a signed int64 (PostgreSQL bigint)."""
    img = Image.open(io.BytesIO(image_bytes))
    h = imagehash.phash(img)
    value = int(str(h), 16)
    if value >= 2**63:
        value -= 2**64
    return value


async def find_duplicate(
    db: AsyncSession, phash: int, state_code: str, threshold: int = 6
) -> str | None:
    """Returns the plate ID of a near-duplicate, or None."""
    query = text("""
        SELECT id::text FROM plates
        WHERE state_code = :state_code
          AND status = 'approved'
          AND created_at > now() - interval '90 days'
          AND image_phash IS NOT NULL
          AND bit_count((CAST(:phash AS bigint) # image_phash)::bit(64)) <= :threshold
        LIMIT 1
    """)
    result = await db.execute(
        query, {"state_code": state_code, "phash": phash, "threshold": threshold}
    )
    row = result.first()
    return row[0] if row else None
