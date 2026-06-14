from __future__ import annotations

import pytest

from app.core.errors import UpstreamError
from app.services.moderation import pipeline
from app.services.moderation.image_check import ImageCheckResult
from app.services.moderation.pipeline import run_moderation


@pytest.fixture
def no_duplicate(monkeypatch):
    monkeypatch.setattr(pipeline, "compute_phash", lambda image_bytes: 123)

    async def _none(db, phash, state_code):
        return None

    monkeypatch.setattr(pipeline, "find_duplicate", _none)


async def test_fails_open_on_upstream_error(monkeypatch, no_duplicate):
    async def _raise(image_bytes, plate_text):
        raise UpstreamError("provider down")

    monkeypatch.setattr(pipeline, "check_image", _raise)
    result = await run_moderation(None, b"img", "ABC123", None, "MA")
    assert result.approved is True
    assert result.signals.get("image_check_skipped") is True


async def test_real_verdict_still_rejects(monkeypatch, no_duplicate):
    async def _reject(image_bytes, plate_text):
        return ImageCheckResult(ok=False, reason="not_a_plate", detail="no plate")

    monkeypatch.setattr(pipeline, "check_image", _reject)
    result = await run_moderation(None, b"img", "ABC123", None, "MA")
    assert result.approved is False
    assert result.reason == "not_a_plate"


async def test_rule_based_failure_rejects_even_in_fail_open(monkeypatch, no_duplicate):
    async def _low_quality(image_bytes, plate_text):
        return ImageCheckResult(ok=False, reason="low_quality", detail="too small")

    monkeypatch.setattr(pipeline, "check_image", _low_quality)
    result = await run_moderation(None, b"img", "ABC123", None, "MA")
    assert result.approved is False
    assert result.reason == "low_quality"
