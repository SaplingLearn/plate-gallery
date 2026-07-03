# PlateGallery — Three-Issue Fix (Design Spec)

**Date:** 2026-06-29
**Status:** Approved for planning

## Summary

Fix three reported issues in PlateGallery, phased by priority. Each phase is
independent and shippable on its own.

1. **Mobile layout (HIGH, frontend)** — the Home 3-column layout doesn't
   collapse on phone widths.
2. **Leaderboard (HIGH, backend + frontend)** — the "This Year" filter 422s and
   silently shows an empty state; the "Upvotes" column header doesn't match the
   net-score ranking.
3. **Rate limiting (MEDIUM, backend)** — the commit endpoint is unthrottled and
   the configured IP-based limiter is never used.

Phases are ordered by priority but have no cross-dependencies and could be
worked in any order or in parallel.

---

## Phase 1 — Mobile layout

**Problem.** `frontend/src/pages/Home.tsx:352` hardcodes
`grid-cols-[220px_1fr_300px]` with no responsive prefixes, so the 220px state
nav + 300px right rail (~520px) render at every viewport, compressing the feed
and pushing `Nav.tsx` actions ("Post a Plate", "Sign in") off-screen on phones.
The viewport meta tag is already correct; this is purely a CSS/layout gap. Other
pages (Leaderboard, Profile) already use `md:`/`lg:` prefixes — Home is the
exception.

**Approach.** Feed-first single column below the `lg` breakpoint (1024px), with
the state nav available via a slide-in drawer.

- **Grid** (`Home.tsx:352`): `grid-cols-1 lg:grid-cols-[220px_1fr_300px]`. Below
  `lg`, only the feed column renders.
- **Side rails:** wrap `FeedSideNav` and `FeedRightRail` as `hidden lg:block`.
  The right rail is dropped on mobile; the left state nav moves into the drawer.
- **Drawer:** a Framer Motion slide-in panel that **reuses the existing
  `FeedSideNav` component** (no duplicate nav logic). Opened by a hamburger
  button rendered only below `lg`. Open/close state is shared (a small React
  context or state lifted to the layout) so the global `Nav` can toggle a
  Home-scoped panel; the hamburger only appears on the feed route. Closes on
  backdrop click, state selection, and `lg`+ resize.
- **Nav bar** (`Nav.tsx`): reduce container padding/gap on mobile
  (`px-4 gap-3` → `lg:px-8 lg:gap-8`); render "Post a Plate" as a compact
  icon-only `+` below `lg` and full-label above; keep "Sign in" compact. The
  search input keeps its existing `hidden md:flex`.

**Breakpoint rationale.** Full 3-column needs ~960px+ (520px rails + a usable
feed). `lg` (1024px) is the clean threshold; `md` tablets get the single-column
feed + drawer. This is adjustable.

**Out of scope.** No redesign of the rails' contents; no new navigation IA
beyond the drawer.

---

## Phase 2 — Leaderboard

This phase changes the leaderboard request contract, so frontend and backend
move together (🔌 CONTRACT).

### 2a. "This Year" filter (422)

**Problem.** `frontend/src/pages/Leaderboard.tsx:13` offers a `'year'` window,
but both backend endpoints validate
`window: Literal["day","week","month","all"]`
(`backend/app/api/v1/leaderboard.py:34,68`), so `window=year` returns a Pydantic
422. The page reads `active.data?.items ?? []` (`Leaderboard.tsx:188`) with no
error check, so the failure renders as "No plates ranked yet."

**Fix.**
- Backend: add `"year"` to the `Literal` on both endpoints and implement it as a
  rolling 365-day window, in the same `if window == ...` block that the other
  windows use (`text("interval '365 days'")`), consistent with day/week/month.
  Ranking (`ORDER BY Plate.score.desc(), Plate.created_at.desc()`) is unchanged.
- Frontend: extend the `LeaderboardWindow` type/union in
  `frontend/src/hooks/useApi.ts` to include `'year'`. The existing `'year'` chip
  value now matches the backend.

### 2b. "Upvotes" header vs net-score ranking

**Problem.** The column header reads `UPVOTES` (`Leaderboard.tsx:93`) and shows
`plate.upvotes` (`:70`, `:117`), but ranking is by `Plate.score` (net =
upvotes − downvotes). A plate with more upvotes can rank below one with fewer,
looking like a broken sort.

**Fix.** Keep net-score ranking (canonical across the app; counters are
trigger-maintained). Relabel the header `UPVOTES` → `SCORE` and display
`plate.score` in both the row and any mobile/condensed renderings. No backend
change.

### 2c. Error vs empty state

**Problem.** A failed leaderboard request is indistinguishable from a genuinely
empty leaderboard.

**Fix.** Use the query's `isError`/`error` state to render a distinct
"Couldn't load the leaderboard" branch, separate from the real empty state.
Defensive: this keeps any future request failure from masquerading as empty,
independent of 2a.

---

## Phase 3 — Rate limiting

Backend only. Two gaps: the commit endpoint is unthrottled, and the configured
IP limiter is never wired in.

### 3a. Enforce user AND IP (refactor `check_and_record`)

**Problem.** `backend/app/services/rate_limit.py` checks user **or** IP — its
loop uses `if user_id: ... elif ip: ...`, so when a `user_id` is present the IP
scope is never evaluated. IP throttling therefore cannot run alongside the
user-scoped limits that all authenticated endpoints use.

**Fix.** Refactor `check_and_record` to take separate per-user and per-IP limit
lists and evaluate each applicable scope independently, raising
`RateLimitedError` if **either** is exceeded. Record one `RateLimitEvent`
carrying both `user_id` and `ip` (the table already indexes both). Update the
existing call sites (sign, vote, comment) to the new signature; their current
behavior is preserved by passing only user limits.

### 3b. Rate-limit the commit endpoint

**Problem.** `backend/app/api/v1/plates.py:136` `create_plate` has only
`get_current_user` + `get_db` — no rate limiting. After one signed token a user
can create plates unbounded.

**Fix.** Add a rate-limit call to `create_plate` using its **own bucket**
(`"plate_create"`) so it doesn't share budget with `"upload"` (a normal flow is
1 sign + 1 commit; separate buckets keep each at the intended cap). Limits:
per-user `5/hr, 20/day` and per-IP `10/hr`. Inject `Request` to read the client
IP via the existing `get_client_ip`.

### 3c. Apply the IP limit at the sign step

**Problem.** `RATE_LIMIT_UPLOADS_PER_HOUR_IP = 10`
(`backend/app/core/config.py:27`) is defined and never referenced; the sign
endpoint already extracts `ip` but only passes user limits.

**Fix.** Add the per-IP limit (`10/hr`) to the sign endpoint's call alongside
its existing per-user limits.

### Config

Reuse the existing `RATE_LIMIT_UPLOADS_*` constants for both sign and commit
unless commit needs independent tuning, in which case add a parallel
`RATE_LIMIT_PLATES_*` set. Decide during planning; default is to reuse.

---

## Testing strategy

- **Phase 1 (manual/visual):** verify at 375px / 768px / 1280px — no horizontal
  scroll, "Post a Plate" and "Sign in" reachable, drawer opens/closes and
  filters by state, desktop layout unchanged.
- **Phase 2 (backend tests + manual):** `window=year` returns 200 with the
  365-day cutoff; only genuinely invalid windows 422. Manual: "This Year" chip
  loads results; the column reads SCORE and matches sort order; a forced request
  failure shows the error state, not the empty state.
- **Phase 3 (backend tests):** commit returns 429 after the per-user cap; the
  per-IP cap trips across distinct users from one IP; a normal single
  sign→commit flow stays under both caps; existing vote/comment limits unchanged
  after the signature refactor.

## Non-goals / constraints

- Do not touch the DB triggers that maintain `upvotes`/`downvotes`/`score`/
  `comment_count` (per CLAUDE.md).
- Keep rate limiting DB-backed (works across instances); no Redis.
- Preserve the `{ error: { code, message, details? } }` envelope and `/api/v1`
  routing.
