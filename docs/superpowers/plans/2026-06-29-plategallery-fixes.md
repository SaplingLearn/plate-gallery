# PlateGallery Three-Issue Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken mobile layout, the leaderboard "This Year" 422 + mislabeled "Upvotes" column, and the rate-limiting gaps (unthrottled commit endpoint, unused IP limiter).

**Architecture:** Three independent phases. Phase 1 is frontend-only responsive work on `Home.tsx` and `Nav.tsx`. Phase 2 adds a `year` window to the leaderboard backend (via a small DRY helper) and corrects the frontend column. Phase 3 refactors the rate-limit service to enforce user-and-IP limits and wires it into the sign and commit endpoints.

**Tech Stack:** FastAPI / async SQLAlchemy / Pydantic / pytest + pytest-asyncio (backend); React 19 / Vite / TypeScript / TanStack Query / Tailwind v4 / Framer Motion (frontend).

## Global Constraints

- **Do NOT `git commit`.** This repo's CLAUDE.md says commit only when the user asks. Each task ends with verification; the user commits when ready. (The `- [ ]` "Verify" steps replace the usual commit step.)
- Error envelope stays `{ error: { code, message, details? } }`; all routes under `/api/v1`.
- Do **not** add app-level vote/comment counter logic — `upvotes`/`downvotes`/`score`/`comment_count` are DB-trigger maintained.
- Rate limiting stays DB-backed (no Redis).
- Backend tests follow the existing pattern: mock `AsyncSession` with `MagicMock`/`AsyncMock` (see `tests/test_duplicate_check.py`). No DB harness, no `TestClient`.
- Frontend has no test runner; the automated gate is `npm run build` (tsc) + `npm run lint`, plus manual viewport verification.
- Tailwind v4 default breakpoints: `sm 640 / md 768 / lg 1024 / xl 1280`. The 3-column→1-column threshold is `lg`.
- Backend dev: `cd backend`; run tests with `python -m pytest`. Frontend dev: `cd frontend`.

---

## Phase 1 — Mobile layout (frontend)

### Task 1: Make the Home grid collapse to one column on phones

**Files:**
- Modify: `frontend/src/pages/Home.tsx:352-414`

**Interfaces:**
- Consumes: existing `FeedSideNav` (`currentState`, `onStateChange`) and `FeedRightRail` components, unchanged.
- Produces: a single-column feed below `lg`; nothing other tasks depend on.

- [ ] **Step 1: Make the grid responsive and hide the side rails below `lg`**

In `Home.tsx`, change the `motion.main` className (line 352) from:

```tsx
      className="grid min-h-[calc(100vh-72px)] grid-cols-[220px_1fr_300px]"
```

to:

```tsx
      className="grid min-h-[calc(100vh-72px)] grid-cols-1 lg:grid-cols-[220px_1fr_300px]"
```

Wrap `FeedSideNav` (line 354) so it only renders at `lg`+:

```tsx
      <div className="hidden lg:block">
        <FeedSideNav currentState={stateFilter} onStateChange={setStateFilter} />
      </div>
```

Wrap `FeedRightRail` (line 413) the same way:

```tsx
      <div className="hidden lg:block">
        <FeedRightRail />
      </div>
```

Soften the feed section's horizontal padding for narrow screens — change line 355 from `className="overflow-hidden px-7 py-5"` to:

```tsx
      <section className="overflow-hidden px-4 py-5 lg:px-7">
```

- [ ] **Step 2: Verify build + lint pass**

Run: `cd frontend && npm run build && npm run lint`
Expected: both succeed, no TypeScript or lint errors.

- [ ] **Step 3: Verify manually at mobile width**

Run the dev server (`npm run dev`), load `/` at 375px width. Expected: single full-width feed column, no horizontal scroll, no left/right rail visible. At 1280px: the original 3-column layout is unchanged.

---

### Task 2: Mobile state-filter drawer on Home

**Files:**
- Modify: `frontend/src/pages/Home.tsx` (imports, component state, render)

**Interfaces:**
- Consumes: `FeedSideNav` (`currentState: string | null`, `onStateChange: (code: string | null) => void`), `setStateFilter`, `stateFilter` already defined in `Home`.
- Produces: a `lg:hidden` "Browse states" trigger + slide-in drawer reusing `FeedSideNav`.

- [ ] **Step 1: Import `AnimatePresence` and add drawer state**

At the top of `Home.tsx`, ensure the framer-motion import includes `AnimatePresence`:

```tsx
import { motion, AnimatePresence } from 'framer-motion'
```

Inside the `Home` component body (near the other `useState`/derived values, before `return`), add:

```tsx
  const [stateDrawerOpen, setStateDrawerOpen] = useState(false)
```

(Confirm `useState` is imported from `'react'`; add it to the import if missing.)

- [ ] **Step 2: Add the mobile trigger button**

Inside the `<section>`, immediately after `<FeedHero count={plates.length} />` (line 356), add:

```tsx
        <button
          type="button"
          onClick={() => setStateDrawerOpen(true)}
          className="mt-4 flex items-center gap-2 rounded-full border-[1.5px] border-rule bg-paper px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.3px] text-ink lg:hidden"
        >
          <span className="text-base leading-none">☰</span>
          Browse states{stateFilter ? ` · ${stateFilter}` : ''}
        </button>
```

- [ ] **Step 3: Add the slide-in drawer**

Just before the closing `</motion.main>` (line 414, after `<FeedRightRail />`'s wrapper), add:

```tsx
      <AnimatePresence>
        {stateDrawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStateDrawerOpen(false)}
            />
            <motion.div
              className="fixed left-0 top-0 z-50 h-full w-[280px] max-w-[85vw] overflow-y-auto bg-cream lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
            >
              <FeedSideNav
                currentState={stateFilter}
                onStateChange={(c) => {
                  setStateFilter(c)
                  setStateDrawerOpen(false)
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
```

- [ ] **Step 4: Verify build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: both pass.

- [ ] **Step 5: Verify manually**

At 375px: tap "Browse states" → drawer slides in with the state nav; selecting a state filters the feed and closes the drawer; tapping the backdrop closes it. At 1280px the trigger and drawer are hidden.

---

### Task 3: Responsive Nav — compact actions + site-nav drawer

**Files:**
- Modify: `frontend/src/components/Nav.tsx`

**Interfaces:**
- Consumes: existing `LINKS` array, `useAuth`, `useNavigate`.
- Produces: a `lg:hidden` hamburger + drawer exposing the nav links and search; compact "Post a Plate" on mobile.

- [ ] **Step 1: Add imports and menu state**

Change the React import line to include `useState` (already imported) and add framer-motion at the top of `Nav.tsx`:

```tsx
import { motion, AnimatePresence } from 'framer-motion'
```

In the `Nav` component, add state next to `const [q, setQ] = useState('')`:

```tsx
  const [menuOpen, setMenuOpen] = useState(false)
```

- [ ] **Step 2: Tighten the nav container and hide the inline links on mobile**

Change the `<nav>` className (line 34) from `... gap-8 ... px-8` to:

```tsx
    <nav className="sticky top-0 z-50 flex h-[72px] items-center gap-3 border-b-[1.5px] border-rule bg-cream px-4 lg:gap-8 lg:px-8">
```

Add a hamburger button as the **first** child inside `<nav>` (before the logo `<Link>`):

```tsx
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setMenuOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-rule bg-paper text-lg text-ink lg:hidden"
      >
        ☰
      </button>
```

Hide the inline links row on mobile — change line 42 from `className="ml-4 flex gap-1"` to:

```tsx
      <div className="ml-4 hidden gap-1 lg:flex">
```

- [ ] **Step 3: Make "Post a Plate" compact on mobile**

Change the post button (lines 81-88) so the label collapses below `lg` and padding shrinks:

```tsx
      <button
        type="button"
        onClick={() => navigate(user ? '/upload' : '/login?next=/upload')}
        className="ml-auto flex h-11 items-center gap-2 rounded-full bg-rust px-3 font-sans text-[15px] font-extrabold uppercase tracking-wide text-white transition-transform hover:-translate-y-px lg:ml-0 lg:px-5"
        style={{ boxShadow: '0 3px 0 var(--color-rust-deep), 0 6px 14px rgba(40,26,10,0.22)' }}
      >
        <span className="text-lg leading-none">+</span>
        <span className="hidden lg:inline">POST A PLATE</span>
      </button>
```

Note the added `ml-auto lg:ml-0`: on mobile the search form is hidden (it carries `ml-auto`), so the post button takes over pushing the actions to the right edge.

- [ ] **Step 4: Add the site-nav drawer**

Immediately before the closing `</nav>` (line 110), add a drawer that reuses `LINKS` and the search box:

```tsx
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              className="fixed left-0 top-0 z-50 flex h-full w-[260px] max-w-[80vw] flex-col gap-2 overflow-y-auto bg-cream p-4 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
            >
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'rounded-full border-[1.5px] px-4 py-2.5 font-sans text-[15px] font-bold',
                      isActive ? 'border-rule bg-paper text-ink' : 'border-transparent text-ink-soft',
                    )
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
```

- [ ] **Step 5: Verify build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: both pass.

- [ ] **Step 6: Verify manually**

At 375px: hamburger visible; logo, compact "+" post button, and avatar/Sign-in all fit with no horizontal scroll; hamburger opens a drawer listing Feed / USA Map / Leaderboards / About; tapping a link navigates and closes the drawer. At 1280px: original inline links + full "Post a Plate" label, no hamburger.

---

## Phase 2 — Leaderboard

### Task 4: Add the `year` window to the backend (DRY helper + test)

**Files:**
- Modify: `backend/app/api/v1/leaderboard.py`
- Create: `backend/tests/test_leaderboard_window.py`

**Interfaces:**
- Produces: `_window_interval(window: str) -> str | None` — returns the Postgres interval literal for a window, or `None` for `"all"`/unknown. Used by both leaderboard endpoints.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_leaderboard_window.py`:

```python
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/test_leaderboard_window.py -v`
Expected: FAIL — `ImportError: cannot import name '_window_interval'`.

- [ ] **Step 3: Add the helper and use it in both endpoints**

In `backend/app/api/v1/leaderboard.py`, add the constant + helper after the imports (above `_load_user_votes`):

```python
_WINDOW_INTERVALS = {
    "day": "interval '1 day'",
    "week": "interval '7 days'",
    "month": "interval '30 days'",
    "year": "interval '365 days'",
}


def _window_interval(window: str) -> str | None:
    return _WINDOW_INTERVALS.get(window)
```

Add `"year"` to both `Literal` annotations (lines 34 and 68):

```python
    window: Literal["day", "week", "month", "year", "all"] = Query(default="all"),
```

Replace the `if window == "day": ... elif ...` blocks in **both** endpoints (lines 46-51 and 81-86) with:

```python
    interval = _window_interval(window)
    if interval is not None:
        stmt = stmt.where(Plate.created_at > func.now() - text(interval))
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/test_leaderboard_window.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full backend suite for regressions**

Run: `cd backend && python -m pytest -q`
Expected: all tests pass (no import errors from the leaderboard edit).

---

### Task 5: Leaderboard frontend — relabel to SCORE + error state

**Files:**
- Modify: `frontend/src/pages/Leaderboard.tsx`

**Interfaces:**
- Consumes: `useLeaderboard` / `useStateLeaderboard` query objects (which expose `isLoading`, `isError`); `Plate.score`, `Plate.upvotes`.
- Produces: column relabeled SCORE, score-based display, a distinct error state.

- [ ] **Step 1: Show net score in the podium card**

In `Leaderboard.tsx`, change the podium value (line 70) from:

```tsx
          ▲ {plate.upvotes.toLocaleString()}
```

to:

```tsx
          ▲ {plate.score.toLocaleString()}
```

- [ ] **Step 2: Relabel the column header and show score in rows**

Change the header cell (line 93) from `<div>UPVOTES</div>` to:

```tsx
        <div>SCORE</div>
```

Change the row value (line 117) from `{r.upvotes.toLocaleString()}` to:

```tsx
            {r.score.toLocaleString()}
```

- [ ] **Step 3: Add a distinct error state**

In the `Leaderboard` component, after `const isLoading = active.isLoading` (line 190), add:

```tsx
  const isError = active.isError
```

In the render (the `isLoading ? ... : plates.length === 0 ? ...` chain starting line 268), insert an error branch between the loading and empty branches:

```tsx
      {isLoading ? (
        <div className="py-16 text-center font-mono text-sm text-ink-muted">Loading leaderboard…</div>
      ) : isError ? (
        <div className="mt-10 rounded-[18px] border-[1.5px] border-dashed border-rule bg-paper p-12 text-center">
          <h2 className="font-display text-3xl font-black tracking-tight text-ink">Couldn't load the leaderboard.</h2>
          <p className="mt-2 text-sm font-semibold text-ink-soft">
            Something went wrong fetching the rankings. Please try again.
          </p>
        </div>
      ) : plates.length === 0 ? (
```

(Leave the existing empty-state and `: (` success branches unchanged.)

- [ ] **Step 4: Verify build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: both pass.

- [ ] **Step 5: Verify manually**

With the backend running: select "This Year" → results load (HTTP 200), no "No plates ranked yet." The column header reads SCORE and values match the ranked order. Temporarily point the API at a bad URL (or stop the backend) → the "Couldn't load the leaderboard." error state shows instead of the empty state.

---

## Phase 3 — Rate limiting (backend)

### Task 6: Refactor `check_and_record` to enforce user AND IP

**Files:**
- Modify: `backend/app/services/rate_limit.py`
- Modify (call sites): `backend/app/api/v1/uploads.py:55`, `backend/app/api/v1/votes.py:39`, `backend/app/api/v1/comments.py:103`
- Create: `backend/tests/test_rate_limit.py`

**Interfaces:**
- Produces: `check_and_record(db, bucket, user_id, ip, user_limits=None, ip_limits=None) -> None`. Checks each provided scope independently; raises `RateLimitedError` if either is exceeded; records one `RateLimitEvent` with both `user_id` and `ip`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_rate_limit.py`:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_rate_limit.py -v`
Expected: FAIL — `check_and_record()` got an unexpected keyword `user_limits` (old signature uses `limits`).

- [ ] **Step 3: Rewrite `check_and_record`**

Replace the body of `backend/app/services/rate_limit.py` (lines 13-46) with:

```python
async def check_and_record(
    db: AsyncSession,
    bucket: str,
    user_id: uuid.UUID | None,
    ip: str | None,
    user_limits: list[tuple[int, timedelta]] | None = None,
    ip_limits: list[tuple[int, timedelta]] | None = None,
) -> None:
    """Check rate limits per scope and record the event.

    Each provided scope (user, ip) is checked independently against its own
    limits; the call raises RateLimitedError if EITHER scope is over limit.
    """
    scopes: list[tuple[object, object, list[tuple[int, timedelta]]]] = []
    if user_id is not None and user_limits:
        scopes.append((RateLimitEvent.user_id, user_id, user_limits))
    if ip is not None and ip_limits:
        scopes.append((RateLimitEvent.ip, ip, ip_limits))

    for column, value, limits in scopes:
        for max_count, window in limits:
            cutoff = func.now() - window
            stmt = select(func.count()).where(
                column == value,
                RateLimitEvent.bucket == bucket,
                RateLimitEvent.created_at > cutoff,
            )
            result = await db.execute(stmt)
            count = result.scalar() or 0
            if count >= max_count:
                raise RateLimitedError(retry_after=int(window.total_seconds()))

    event = RateLimitEvent(user_id=user_id, ip=ip, bucket=bucket)
    db.add(event)
    await db.flush()
```

- [ ] **Step 4: Update the three existing call sites (rename `limits=` → `user_limits=`)**

`uploads.py:55-64` — change `limits=[` to `user_limits=[`:

```python
    await check_and_record(
        db,
        bucket="upload",
        user_id=user.id,
        ip=ip,
        user_limits=[
            (settings.RATE_LIMIT_UPLOADS_PER_HOUR, timedelta(hours=1)),
            (settings.RATE_LIMIT_UPLOADS_PER_DAY, timedelta(days=1)),
        ],
    )
```

`votes.py:39-45`:

```python
    await check_and_record(
        db,
        bucket="vote",
        user_id=user.id,
        ip=ip,
        user_limits=[(settings.RATE_LIMIT_VOTES_PER_MINUTE, timedelta(minutes=1))],
    )
```

`comments.py:103-112`:

```python
    await check_and_record(
        db,
        bucket="comment",
        user_id=user.id,
        ip=ip,
        user_limits=[
            (settings.RATE_LIMIT_COMMENTS_PER_MINUTE, timedelta(minutes=1)),
            (settings.RATE_LIMIT_COMMENTS_PER_DAY, timedelta(days=1)),
        ],
    )
```

- [ ] **Step 5: Run the new tests + full suite**

Run: `cd backend && python -m pytest tests/test_rate_limit.py -v && python -m pytest -q`
Expected: 4 new tests pass; full suite passes (call-site renames don't break imports).

---

### Task 7: Wire IP limit into sign, and rate-limit the commit endpoint

**Files:**
- Modify: `backend/app/api/v1/uploads.py` (add `ip_limits` to sign)
- Modify: `backend/app/api/v1/plates.py` (rate-limit `create_plate`)

**Interfaces:**
- Consumes: `check_and_record(..., user_limits=, ip_limits=)` from Task 6; `get_client_ip` from `app.api.v1.deps`; `settings.RATE_LIMIT_UPLOADS_PER_HOUR / _PER_DAY / _PER_HOUR_IP`.

- [ ] **Step 1: Add the per-IP limit to the sign endpoint**

In `uploads.py`, extend the sign call (from Task 6) with `ip_limits`:

```python
    await check_and_record(
        db,
        bucket="upload",
        user_id=user.id,
        ip=ip,
        user_limits=[
            (settings.RATE_LIMIT_UPLOADS_PER_HOUR, timedelta(hours=1)),
            (settings.RATE_LIMIT_UPLOADS_PER_DAY, timedelta(days=1)),
        ],
        ip_limits=[(settings.RATE_LIMIT_UPLOADS_PER_HOUR_IP, timedelta(hours=1))],
    )
```

- [ ] **Step 2: Rate-limit `create_plate` (commit)**

In `plates.py`, update the imports near the top of the file to add `Request`, `get_client_ip`, `check_and_record`, and `timedelta` if not already imported. Confirm the existing import lines; add what's missing:

```python
from datetime import UTC, datetime, timedelta
from fastapi import APIRouter, Depends, Request
from app.api.v1.deps import get_client_ip
from app.services.rate_limit import check_and_record
```

Change the `create_plate` signature (lines 137-141) to accept the request:

```python
@router.post("", response_model=PlateResponse)
async def create_plate(
    body: CreatePlateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlateResponse:
```

Add the rate-limit check as the **first** statement in the body (before the upload-token validation, line 142), using a dedicated `"plate_create"` bucket so it does not share budget with the `"upload"` bucket:

```python
    ip = get_client_ip(request)
    await check_and_record(
        db,
        bucket="plate_create",
        user_id=user.id,
        ip=ip,
        user_limits=[
            (settings.RATE_LIMIT_UPLOADS_PER_HOUR, timedelta(hours=1)),
            (settings.RATE_LIMIT_UPLOADS_PER_DAY, timedelta(days=1)),
        ],
        ip_limits=[(settings.RATE_LIMIT_UPLOADS_PER_HOUR_IP, timedelta(hours=1))],
    )
```

Confirm `settings` is imported in `plates.py` (it uses other config already); add `from app.core.config import settings` if absent.

- [ ] **Step 3: Verify imports resolve and the app loads**

Run: `cd backend && python -c "import app.api.v1.plates, app.api.v1.uploads"`
Expected: no ImportError / NameError.

- [ ] **Step 4: Run the full backend suite**

Run: `cd backend && python -m pytest -q`
Expected: all tests pass (the limiter logic itself is covered by Task 6; this task is endpoint wiring).

- [ ] **Step 5: (Optional) manual smoke**

With the backend + a valid auth token, POST `/api/v1/plates` repeatedly; after `RATE_LIMIT_UPLOADS_PER_HOUR` creates within the hour, expect HTTP 429 with a `Retry-After` header. (`plate_create` is independent of the `upload`/sign bucket.)

---

## Self-review notes

- **Spec coverage:** Phase 1 → mobile grid (T1) + state drawer (T2) + reachable nav actions/links (T3). Phase 2 → `year` window 422 (T4), SCORE relabel + score display (T5 steps 1-2), error-vs-empty (T5 step 3). Phase 3 → user-AND-ip refactor (T6), commit gap (T7 step 2), unused IP limiter now used at sign + commit (T7 steps 1-2). All spec sections map to a task.
- **Frontend `year` value:** no frontend change needed for the 422 — `WINDOWS` already includes `{ value: 'year' }` and `useLeaderboard(window: string)` is untyped; the backend addition (T4) is the whole fix.
- **No new config:** commit reuses `RATE_LIMIT_UPLOADS_*`; IP limit reuses `RATE_LIMIT_UPLOADS_PER_HOUR_IP` (was defined, now used).
- **Type consistency:** `check_and_record(..., user_limits=, ip_limits=)` is defined in T6 and used with those exact kwargs in T6 (3 call sites) and T7 (2 endpoints). `_window_interval` defined and consumed within T4.
