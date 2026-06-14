from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

from app.services.moderation.duplicate_check import find_duplicate


def _db_returning(row):
    db = MagicMock()
    result = MagicMock()
    result.first.return_value = row
    db.execute = AsyncMock(return_value=result)
    return db


async def test_within_threshold_is_duplicate():
    db = _db_returning(("plate-123", 4))
    assert await find_duplicate(db, 999, "MA", threshold=4) == "plate-123"


async def test_beyond_threshold_is_not_duplicate():
    db = _db_returning(("plate-123", 5))
    assert await find_duplicate(db, 999, "MA", threshold=4) is None


async def test_no_rows_is_not_duplicate():
    db = _db_returning(None)
    assert await find_duplicate(db, 999, "MA") is None


async def test_logs_nearest_distance(caplog):
    db = _db_returning(("plate-123", 7))
    with caplog.at_level("INFO"):
        await find_duplicate(db, 999, "MA")
    assert "dist=7" in caplog.text


async def test_default_threshold_is_four():
    db = _db_returning(("plate-123", 5))
    assert await find_duplicate(db, 999, "MA") is None
