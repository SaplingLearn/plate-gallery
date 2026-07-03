from __future__ import annotations

import uuid
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.errors import RateLimitedError
from app.services.rate_limit import check_and_record


def _db_with_counts(counts):
    """An AsyncSession mock whose successive .execute(...).scalar() return `counts`."""
    db = MagicMock()
    results = []
    for c in counts:
        r = MagicMock()
        r.scalar.return_value = c
        results.append(r)
    db.execute = AsyncMock(side_effect=results)
    db.add = MagicMock()
    db.flush = AsyncMock()
    return db


async def test_under_user_limit_records_event():
    db = _db_with_counts([0])
    await check_and_record(
        db, "upload", uuid.uuid4(), None,
        user_limits=[(5, timedelta(hours=1))],
    )
    db.add.assert_called_once()
    db.flush.assert_awaited_once()


async def test_over_user_limit_raises_and_skips_record():
    db = _db_with_counts([5])
    with pytest.raises(RateLimitedError):
        await check_and_record(
            db, "upload", uuid.uuid4(), None,
            user_limits=[(5, timedelta(hours=1))],
        )
    db.add.assert_not_called()


async def test_ip_enforced_even_when_user_under():
    # scope order is user-first then ip: user under (0), ip over (10)
    db = _db_with_counts([0, 10])
    with pytest.raises(RateLimitedError):
        await check_and_record(
            db, "upload", uuid.uuid4(), "1.2.3.4",
            user_limits=[(5, timedelta(hours=1))],
            ip_limits=[(10, timedelta(hours=1))],
        )


async def test_no_limits_records_without_querying():
    db = _db_with_counts([])
    await check_and_record(db, "upload", uuid.uuid4(), "1.2.3.4")
    db.execute.assert_not_called()
    db.add.assert_called_once()
