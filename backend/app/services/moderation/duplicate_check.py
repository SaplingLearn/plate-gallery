from __future__ import annotations

import io
import logging

import imagehash
from PIL import Image
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def compute_phash(image_bytes: bytes) -> int:
    """Compute a 64-bit perceptual hash as a signed int64 (PostgreSQL bigint)."""
    img = Image.open(io.BytesIO(image_bytes))
    h = imagehash.phash(img)
    value = int(str(h), 16)
    if value >= 2**63:
        value -= 2**64
    return value


async def find_duplicate(
    db: AsyncSession, phash: int, state_code: str, threshold: int = 4
) -> str | None:
    """Returns the plate ID of a near-duplicate, or None. Logs the nearest
    neighbor distance so the threshold can be calibrated from real data."""
    query = text("""
        SELECT id::text,
               bit_count((CAST(:phash AS bigint) # image_phash)::bit(64)) AS dist
        FROM plates
        WHERE state_code = :state_code
          AND status = 'approved'
          AND created_at > now() - interval '90 days'
          AND image_phash IS NOT NULL
        ORDER BY dist ASC
        LIMIT 1
    """)
    result = await db.execute(query, {"state_code": state_code, "phash": phash})
    row = result.first()
    if row is None:
        return None
    plate_id, dist = row[0], row[1]
    logger.info(
        "duplicate_check nearest dist=%s threshold=%d state=%s", dist, threshold, state_code
    )
    return plate_id if dist <= threshold else None
