from __future__ import annotations

from app.api.v1.leaderboard import _window_interval


def test_year_is_365_days():
    assert _window_interval("year") == "interval '365 days'"


def test_day_week_month():
    assert _window_interval("day") == "interval '1 day'"
    assert _window_interval("week") == "interval '7 days'"
    assert _window_interval("month") == "interval '30 days'"


def test_all_is_none():
    assert _window_interval("all") is None


def test_unknown_is_none():
    assert _window_interval("decade") is None
