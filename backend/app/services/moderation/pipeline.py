from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.moderation.duplicate_check import compute_phash, find_duplicate
from app.services.moderation.image_check import check_image
from app.services.moderation.text_check import check_text

logger = logging.getLogger(__name__)


@dataclass
class ModerationResult:
    approved: bool
    reason: str | None = None
    detail: str | None = None
    phash: int | None = None
    signals: dict = field(default_factory=dict)


async def run_moderation(
    db: AsyncSession,
    image_bytes: bytes,
    plate_text: str,
    caption: str | None,
    state_code: str,
) -> ModerationResult:
    """Run full moderation pipeline. Short-circuits on first rejection."""
    start = time.monotonic()

    # 1. Text check (fastest, free)
    text_ok, text_reason = check_text(plate_text, caption)
    if not text_ok:
        duration = int((time.monotonic() - start) * 1000)
        logger.info(
            "moderation_decision approved=false reason=offensive_text duration_ms=%d", duration
        )
        return ModerationResult(
            approved=False, reason="offensive_text", detail=text_reason, signals={"text_hit": True}
        )

    # 2. Image check
    image_result = await check_image(image_bytes, plate_text)
    if not image_result.ok:
        duration = int((time.monotonic() - start) * 1000)
        logger.info(
            "moderation_decision approved=false reason=%s duration_ms=%d",
            image_result.reason,
            duration,
        )
        return ModerationResult(
            approved=False,
            reason=image_result.reason,
            detail=image_result.detail,
            signals={"image_check_reason": image_result.reason},
        )

    # 3. Duplicate check
    try:
        phash = compute_phash(image_bytes)
    except Exception as e:
        logger.warning("Failed to compute phash: %s", e)
        phash = None

    if phash is not None:
        dup_id = await find_duplicate(db, phash, state_code)
        if dup_id:
            duration = int((time.monotonic() - start) * 1000)
            logger.info(
                "moderation_decision approved=false reason=duplicate dup_id=%s duration_ms=%d",
                dup_id,
                duration,
            )
            return ModerationResult(
                approved=False,
                reason="duplicate",
                detail=f"Similar plate already exists (id: {dup_id})",
                phash=phash,
                signals={"duplicate_of": dup_id},
            )

    duration = int((time.monotonic() - start) * 1000)
    logger.info("moderation_decision approved=true duration_ms=%d", duration)
    return ModerationResult(approved=True, phash=phash, signals={})
