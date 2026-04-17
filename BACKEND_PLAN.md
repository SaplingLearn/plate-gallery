# PlateGallery — Backend Implementation Plan

**Stack:** Python 3.12 · FastAPI · Pydantic v2 · Supabase (Postgres + Auth + Storage) · async SQLAlchemy 2.x or `asyncpg` direct · Redis (optional, for rate limiting — can skip and use DB-based limiting for v1) · Deployed on a free tier host (Fly.io, Render, or Railway — see Phase 13)

**Role:** Everything that isn't the Supabase-native pieces (auth/storage) runs here — moderation pipeline, rate limiting, feed ranking, leaderboards, map aggregation, writes that touch multiple tables, anything that can't be trusted to the client.

This plan is paired with `FRONTEND_PLAN.md`. Every point marked **🔌 CONTRACT** has a matching marker in the frontend plan; they must stay in sync.

---

## Phase 0 — Foundation & Project Setup

### 0.1 Repo structure
Inside the forked `hack-bu/plate-gallery` repo:

```
/backend
  /app
    /api
      /v1
        __init__.py
        deps.py              # shared FastAPI dependencies (auth, db, rate-limit)
        users.py             # /users/sync, /me/*
        plates.py            # /plates/*
        uploads.py           # /uploads/*
        votes.py             # /plates/:id/vote
        comments.py          # /plates/:id/comments
        states.py            # /states/:code
        map.py               # /map/summary
        leaderboard.py       # /leaderboard/*
    /core
      config.py              # pydantic-settings
      logging.py
      errors.py              # exception handlers + error envelope
      security.py            # JWT verification
    /db
      session.py             # async engine + session factory
      models.py              # SQLAlchemy ORM models
      migrations/            # Alembic
    /services
      storage.py             # Supabase Storage wrapper (signed URLs, downloads)
      moderation/
        __init__.py
        pipeline.py          # orchestrates the moderation steps
        image_check.py       # is-this-a-plate + NSFW
        text_check.py        # offensive text check
        duplicate_check.py   # perceptual hash dedup
      ranking.py             # score formulas
      feed.py                # feed query builder (cursor pagination)
      rate_limit.py
    /schemas                 # Pydantic response/request models
      common.py
      user.py
      plate.py
      vote.py
      comment.py
      state.py
      leaderboard.py
    main.py                  # FastAPI app factory
  /tests
  pyproject.toml
  Dockerfile
  .env.example
  README.md
```

### 0.2 Tooling
- `uv` or `poetry` for dependency management (pick `uv` — faster, simpler).
- Runtime deps: `fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `python-jose[cryptography]` (JWT verification against Supabase JWKS), `httpx` (Supabase REST + outbound moderation APIs), `Pillow`, `imagehash` (perceptual hashing for dedupe), `python-multipart`.
- Optional moderation providers: `openai` (vision moderation) OR `google-cloud-vision` OR self-hosted `transformers` with a lightweight NSFW classifier. Pick **one** primary + a cheap rule-based fallback. See Phase 6.
- Dev deps: `ruff`, `mypy`, `pytest`, `pytest-asyncio`, `httpx` (test client), `respx` (HTTP mocking).

### 0.3 Configuration
`app/core/config.py` uses `pydantic-settings`:
```python
class Settings(BaseSettings):
    ENV: Literal["dev", "prod"] = "dev"
    DATABASE_URL: str                                  # postgresql+asyncpg://...
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: SecretStr               # stays server-side only
    SUPABASE_JWT_SECRET: SecretStr                     # or SUPABASE_JWKS_URL for asymmetric
    SUPABASE_STORAGE_BUCKET: str = "plates"
    OPENAI_API_KEY: SecretStr | None = None            # for vision moderation
    MODERATION_PROVIDER: Literal["openai", "google", "rule_based"] = "openai"
    CORS_ORIGINS: list[str] = []                       # explicit allowlist
    CORS_ORIGIN_REGEX: str | None = None               # for CF Pages preview URLs
    UPLOAD_MAX_BYTES: int = 10 * 1024 * 1024
    RATE_LIMIT_UPLOADS_PER_DAY: int = 20
    RATE_LIMIT_UPLOADS_PER_HOUR: int = 5
    RATE_LIMIT_VOTES_PER_MINUTE: int = 60
```

### 0.4 Local dev
- `docker-compose.yml` spins up a local Postgres for iteration (even though prod uses Supabase's managed Postgres). Alembic migrations run against both.
- `make dev` → `uvicorn app.main:app --reload --port 8000`.
- `.env.example` committed with dummy values. Real `.env` gitignored.

---

## Phase 1 — Error Envelope, Logging, App Factory

### 1.1 App factory (`app/main.py`)
- Single `create_app()` function that:
  - Instantiates `FastAPI(title="PlateGallery API", version="1.0.0", docs_url="/docs" if ENV=="dev" else None)`.
  - Registers routers under `/api/v1`.
  - Wires CORS middleware (see Phase 2.4).
  - Registers exception handlers.
  - Adds a `/healthz` endpoint returning `{status: "ok", version: ...}` — required for hosting platform health checks.

### 1.2 Error envelope (`app/core/errors.py`)
**🔌 CONTRACT** — every error response has this shape:
```json
{ "error": { "code": "string", "message": "human text", "details": {} } }
```

Define a base `AppError` exception with `status_code`, `code`, `message`, `details`, then subclass for common cases:
- `UnauthorizedError` (401, code `unauthorized`)
- `ForbiddenError` (403)
- `NotFoundError` (404)
- `ValidationError` (422, code `validation_error`, details carry field-level info)
- `RateLimitedError` (429, code `rate_limited`, sets `Retry-After` header)
- `ModerationRejectedError` (422, code `moderation_rejected`, details carry `{ reason, explanation }`)
- `ConflictError` (409, code `conflict`)

Exception handler converts any `AppError` to the envelope. Unhandled exceptions log full traceback and return a sanitized 500.

### 1.3 Structured logging
- JSON logs in prod, human-readable in dev.
- Every request gets a `request_id` (UUID4) generated by middleware, echoed back as `X-Request-ID`, attached to all log entries for that request.
- Log level `INFO` by default. Upload/moderation/vote events logged at `INFO` with structured fields (`user_id`, `plate_id`, `duration_ms`, `outcome`).

---

## Phase 2 — Auth & Request Dependencies

### 2.1 JWT verification (`app/core/security.py`)
Supabase issues JWTs. Two modes:
- **HS256** (simpler): verify with `SUPABASE_JWT_SECRET`.
- **RS256/ES256** (newer Supabase projects): fetch JWKS from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, cache for 1h, verify with public key.

Pick whichever the Supabase project is configured for; default to HS256 for speed.

```python
async def verify_jwt(token: str) -> SupabaseClaims:
    # decode, verify sig, check exp/iss/aud
    # raise UnauthorizedError on any failure
```

Claims model:
```python
class SupabaseClaims(BaseModel):
    sub: UUID                  # Supabase user ID
    email: EmailStr | None
    aud: str
    exp: int
    user_metadata: dict         # full_name, avatar_url from Google
    app_metadata: dict
```

### 2.2 Dependencies (`app/api/v1/deps.py`)

```python
async def get_db() -> AsyncSession: ...

async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User:
    # parse Bearer token, verify JWT, SELECT user from our DB
    # raise UnauthorizedError if missing/invalid/user not synced yet

async def get_current_user_optional(...) -> User | None:
    # same but returns None instead of raising
```

Every protected endpoint declares `user: User = Depends(get_current_user)`. Public-with-personalization endpoints (like the feed, which returns `user_vote` if logged in) use the optional variant.

### 2.3 User sync on first login
**🔌 CONTRACT** — `POST /api/v1/users/sync`
- No body needed (user info comes from the JWT).
- Upserts into `users` table: `id` = `claims.sub`, copies `email`, `display_name` (from `user_metadata.full_name` or email local-part), `avatar_url`.
- Returns the full `User` object.
- Idempotent — frontend can call it every session start without side effects beyond refreshing `avatar_url` etc.

### 2.4 CORS
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,             # prod + localhost
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,   # CF Pages previews
    allow_credentials=False,                          # we use Bearer tokens, not cookies
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID", "Retry-After"],
    max_age=600,
)
```

---

## Phase 3 — Database Schema & Migrations

### 3.1 Tables

```sql
-- users: mirrors Supabase auth.users for our relational joins
create table users (
  id            uuid primary key,                       -- matches auth.users.id
  email         text,
  display_name  text not null,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table states (
  code          char(2) primary key,                    -- 'MA', 'DC', etc.
  name          text not null,
  region        text not null                            -- 'Northeast', 'Midwest', ...
);
-- seed with 50 states + DC via a data migration

create type plate_status as enum ('approved', 'rejected');
create type rejection_reason as enum (
  'not_a_plate', 'explicit', 'offensive_text',
  'duplicate', 'spam_rate_limit', 'low_quality', 'other'
);

create table plates (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid references users(id) on delete set null,
  state_code        char(2) not null references states(code),
  plate_text        text not null,                       -- normalized uppercase
  caption           text,
  image_path        text not null,                       -- path in Supabase Storage
  image_width       int,
  image_height      int,
  image_phash       bigint,                              -- 64-bit perceptual hash
  status            plate_status not null,
  rejection_reason  rejection_reason,
  rejection_detail  text,
  upvotes           int not null default 0,
  downvotes         int not null default 0,
  score             int not null default 0,              -- upvotes - downvotes
  comment_count     int not null default 0,
  created_at        timestamptz not null default now(),
  approved_at       timestamptz
);
create index plates_feed_idx         on plates (status, created_at desc) where status = 'approved';
create index plates_state_feed_idx   on plates (status, state_code, created_at desc) where status = 'approved';
create index plates_score_idx        on plates (status, score desc, created_at desc) where status = 'approved';
create index plates_phash_idx        on plates (image_phash);

create table votes (
  user_id     uuid not null references users(id) on delete cascade,
  plate_id    uuid not null references plates(id) on delete cascade,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (user_id, plate_id)
);
create index votes_plate_idx on votes (plate_id);
create index votes_user_idx  on votes (user_id, created_at desc);

create table comments (
  id         uuid primary key default gen_random_uuid(),
  plate_id   uuid not null references plates(id) on delete cascade,
  author_id  uuid not null references users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index comments_plate_idx on comments (plate_id, created_at desc);

create table upload_tokens (
  token         text primary key,                        -- random 32-byte urlsafe
  user_id       uuid not null references users(id) on delete cascade,
  object_path   text not null,
  content_type  text not null,
  size_bytes    int not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  consumed_at   timestamptz
);
create index upload_tokens_user_idx on upload_tokens (user_id, created_at desc);

create table rate_limit_events (
  id          bigserial primary key,
  user_id     uuid references users(id) on delete cascade,
  ip          inet,
  bucket      text not null,                             -- 'upload', 'vote', 'comment'
  created_at  timestamptz not null default now()
);
create index rate_limit_user_bucket_time on rate_limit_events (user_id, bucket, created_at desc);
create index rate_limit_ip_bucket_time   on rate_limit_events (ip, bucket, created_at desc);
```

### 3.2 Denormalized counters
`upvotes`, `downvotes`, `score`, `comment_count` are maintained via database triggers or application transactions. Pick one approach and commit to it:
- **DB triggers** (recommended): a single trigger on `votes` insert/update/delete updates the `plates` row atomically. Same for `comments`. Eliminates drift.
- **App-level**: every vote mutation does both writes in a transaction. Requires more discipline; one missed path causes drift.

Go with triggers. Write them in the initial migration.

### 3.3 Alembic
- `alembic init` inside `/backend/app/db/migrations`.
- Initial migration creates all tables, enums, indexes, triggers, seeds `states`.
- Later migrations for nice-to-have features only.
- Migrations run automatically on deploy via a release command.

### 3.4 Supabase-native considerations
- We don't use Supabase RLS because all writes go through FastAPI with the service-role key. Reads of public data could bypass the backend via PostgREST, but the brief expects server-side moderation and logic, so the contract is: frontend only talks to FastAPI (except for Auth and Storage uploads).
- The storage bucket `plates` is **public read** (so frontend can load images directly by URL) but **write-only via signed URLs** issued by our backend.

---

## Phase 4 — Supabase Storage Integration

### 4.1 Bucket setup (one-time, via Supabase dashboard or SQL)
- Bucket name: `plates`.
- Public read enabled.
- No public write — only the service role can upload, and we only ever hand out short-lived signed upload URLs.
- File size limit: 10 MB (matches `UPLOAD_MAX_BYTES`).
- Allowed mime types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`.

### 4.2 Storage service wrapper (`app/services/storage.py`)

```python
class StorageService:
    async def create_signed_upload_url(
        self, object_path: str, expires_in: int = 600
    ) -> str: ...

    async def download_object(self, object_path: str) -> bytes: ...

    def public_url(self, object_path: str) -> str: ...

    def transform_url(
        self, object_path: str, *, width: int, quality: int = 75, format: str = "webp"
    ) -> str: ...

    async def delete_object(self, object_path: str) -> None: ...
```

Uses Supabase Storage REST API via `httpx.AsyncClient` with the service role key. Never exposes service key to the frontend.

### 4.3 Object path scheme
```
plates/{yyyy}/{mm}/{plate_id}.{ext}
```
Predictable, browsable, no hash-collision issues since `plate_id` is a UUID.

---

## Phase 5 — Upload Endpoint Flow

This is the critical path; it spans three endpoints and the moderation pipeline.

### 5.1 Step 1 — `POST /api/v1/uploads/sign`
**🔌 CONTRACT**

Request:
```json
{ "content_type": "image/jpeg", "file_size_bytes": 2400000, "client_hash": "sha256:..." }
```

Server logic:
1. Require auth.
2. Validate `content_type` in allowlist; `file_size_bytes <= UPLOAD_MAX_BYTES` and `> 1024`.
3. Check upload rate limit (Phase 7.1). If exceeded, `RateLimitedError` with `Retry-After`.
4. Generate a provisional `plate_id` (UUID4) and `object_path`.
5. Generate `upload_token` (32-byte urlsafe), insert into `upload_tokens` with 10-minute TTL.
6. Request signed upload URL from Supabase Storage for `object_path`.
7. Respond `{ upload_token, signed_url, object_path, expires_at }`.

The signed URL is what the client PUTs the file bytes to. Note: at this point, nothing is in our DB except the token record.

### 5.2 Step 2 (optional) — `POST /api/v1/uploads/ocr-hint`
**🔌 CONTRACT**

Request: `{ upload_token: string }`

Server logic:
1. Require auth.
2. Look up token, verify it belongs to this user, not consumed, not expired.
3. Download the uploaded object from Storage.
4. Run a cheap OCR pass — options: GPT-4o-mini vision with a terse prompt `"Read the vanity text on this license plate. Reply with only the characters, no spaces, or 'UNKNOWN'."`, or Google Vision text detection, or a local `easyocr` call.
5. Return `{ plate_text_guess: string | null, confidence: number }`.

Non-fatal — frontend ignores failures.

### 5.3 Step 3 — `POST /api/v1/plates` (the commit)
**🔌 CONTRACT**

Request:
```json
{
  "upload_token": "...",
  "object_path": "plates/2026/04/abc.jpg",
  "plate_text": "FARMLYF",
  "state_code": "NH",
  "caption": "Spotted in White Mountains"
}
```

Server logic (all in one transaction where possible):
1. Require auth.
2. Look up `upload_token`; verify owner, not consumed, not expired, matches `object_path`.
3. Validate `plate_text`: 1–8 chars, alphanumeric plus space/dash (state-variable but the brief doesn't get picky — use a permissive regex).
4. Validate `state_code` against `states` table.
5. Validate `caption`: ≤ 280 chars, strip control chars.
6. Normalize `plate_text` to uppercase, collapse whitespace.
7. **Run the moderation pipeline** (Phase 6). This is synchronous — the brief prohibits a manual queue.
8. If moderation **rejects**:
   - Mark token `consumed_at = now()`.
   - Insert a `plates` row with `status='rejected'` and the reason (so the user can see it in their profile).
   - Delete the object from Storage (optional — saves space).
   - Return 422 with `ModerationRejectedError` and details.
9. If moderation **approves**:
   - Compute perceptual hash; check for near-duplicates (Hamming distance ≤ 6 on `image_phash` within same `state_code` within last 90 days). If duplicate, reject as `duplicate`.
   - Insert `plates` row with `status='approved'`.
   - Mark token `consumed_at = now()`.
   - Return the full `Plate` response.

Timeouts: the whole endpoint has a hard 30s budget. Moderation calls have individual 10s timeouts.

### 5.4 Cleanup
A scheduled job (or on-demand cron) every hour:
- Deletes `upload_tokens` where `expires_at < now() - interval '1 day'`.
- Deletes orphaned Storage objects: files in `plates/...` bucket with no corresponding `plates` row and older than 1 day.

Can be a simple `@app.on_event` background task or a separate script invoked by the host's cron feature.

---

## Phase 6 — Moderation Pipeline

The brief says: automated, server-side, must reject non-plate images, explicit/offensive content, spam. Approach must be "up to us."

### 6.1 Pipeline architecture (`app/services/moderation/pipeline.py`)

```python
@dataclass
class ModerationResult:
    approved: bool
    reason: RejectionReason | None
    detail: str | None
    signals: dict  # raw scores for logging

class ModerationPipeline:
    def __init__(self, image_check, text_check, duplicate_check): ...
    async def run(self, image_bytes: bytes, plate_text: str, caption: str, state_code: str) -> ModerationResult: ...
```

Pipeline order (short-circuit on first rejection):
1. **Text check** — fastest and free. Run on `plate_text` and `caption`.
2. **Image check** — is-a-plate classification + NSFW classification.
3. **Duplicate check** — perceptual hash lookup.

### 6.2 Text check (`text_check.py`)
Two layers:
- **Rule-based slur list**: curated list of slurs and their common obfuscations (leet, spacing variants). Fast, zero-cost, catches obvious stuff. Rejects `offensive_text`.
- **LLM backup** for `caption` (not `plate_text` — too short to matter): one-shot call to OpenAI moderation endpoint (`omni-moderation-latest`) — free, returns category scores. Reject if `hate` or `sexual` > 0.5.

This layer also rejects `plate_text` that looks like spam (e.g., random strings of 8+ non-vowel consonants — unlikely to be a real plate). Loose heuristic; don't over-index.

### 6.3 Image check (`image_check.py`)
Primary path with a clear fallback:

**Option A — OpenAI Vision (recommended for v1).** Single call with a structured prompt:
```
"You are a license plate gallery moderator. Inspect this image and respond ONLY with JSON:
{
  \"is_license_plate\": bool,        // is a US vehicle license plate clearly visible?
  \"plate_matches\": bool,            // does it read approximately '<plate_text>'?
  \"is_explicit\": bool,              // sexual, gore, or extreme violence
  \"is_offensive_symbol\": bool,      // hate symbols, flags, explicit slurs visible
  \"quality_ok\": bool,               // readable, not blurry beyond recognition
  \"confidence\": number              // 0-1
}
No prose."
```
Parse the JSON. Reject in this order: `is_explicit` → `explicit`, `is_offensive_symbol` → `offensive_text`, `!is_license_plate` → `not_a_plate`, `!quality_ok` → `low_quality`. Ignore `plate_matches` for now (users can claim any text — not worth blocking on OCR mismatch).

**Option B — Google Vision API.** Safe search (adult/violence) + label detection (must include "License plate" or similar).

**Option C — Local rule-based fallback (always runs as a backstop).** Use `Pillow` to check:
- Dimensions ≥ 400px on the short edge.
- Not a near-solid color (very low stdev) — likely blank/corrupted.
- File parses cleanly.
This runs *before* the paid API so we don't waste calls on broken uploads.

Config flag `MODERATION_PROVIDER` picks A, B, or rule-only.

### 6.4 Duplicate check (`duplicate_check.py`)
- Compute `imagehash.phash()` → 64-bit integer.
- Query: `SELECT id FROM plates WHERE state_code = :code AND status = 'approved' AND created_at > now() - interval '90 days' AND image_phash <-> :new_hash <= 6`. (Use the `bit_count(new_hash # image_phash)` Hamming distance via `bit_count` function in Postgres 14+.)
- If any match, reject as `duplicate`.

### 6.5 Logging every decision
Every moderation run logs a single structured record:
```json
{
  "event": "moderation_decision",
  "plate_id": "...", "user_id": "...",
  "approved": false, "reason": "explicit",
  "signals": { "openai_explicit": 0.93, "text_hits": [] },
  "duration_ms": 1840
}
```
Enables auditing false positives and tuning thresholds.

### 6.6 Cost control
- OpenAI moderation endpoint is free; use it aggressively.
- Vision model calls cost money. Cap: hard daily budget via a simple counter in DB (`rate_limit_events` with bucket `moderation_spend`). Over budget → fall back to rule-based + text-only moderation and log a warning.

---

## Phase 7 — Rate Limiting & Spam Prevention

### 7.1 Upload rate limits
Per the brief. Enforced in `/uploads/sign` (not `/plates` — we don't want to waste storage on files that won't be allowed to commit):
- `RATE_LIMIT_UPLOADS_PER_HOUR` (default 5) per user
- `RATE_LIMIT_UPLOADS_PER_DAY` (default 20) per user
- IP-based backstop: 10/hour per IP (catches users cycling accounts)

Implementation (`app/services/rate_limit.py`):
```python
async def check_and_record(bucket: str, user_id: UUID, ip: str, limits: list[tuple[int, timedelta]]) -> None:
    # for each (count, window): SELECT count(*) FROM rate_limit_events
    #   WHERE user_id = :u AND bucket = :b AND created_at > now() - :window
    # if over → RateLimitedError with Retry-After = seconds until oldest event ages out
    # else INSERT row
```

DB-based is fine for v1. Move to Redis if the single-digit ms matters.

### 7.2 Vote rate limits
- 60 votes/minute/user. Cheap DB count.
- Same user voting on same plate more than once → just update the existing row (no new rate-limit event).

### 7.3 Comment rate limits
- 10 comments/minute/user, 100/day.

### 7.4 Response
**🔌 CONTRACT:** 429 response body matches error envelope, adds `Retry-After` header in seconds (integer). Frontend reads this to show a countdown.

---

## Phase 8 — Feed, State, and Plate Detail Endpoints

### 8.1 Feed query builder (`app/services/feed.py`)

**🔌 CONTRACT** — `GET /api/v1/plates?state=XX&sort=YY&cursor=ZZ&limit=24`

Query params:
- `state: str | None` — 2-letter code or 'DC'
- `sort: Literal["recent", "top_day", "top_week", "top_all"]` = `"recent"`
- `cursor: str | None` — opaque, base64-encoded
- `limit: int` = 24, max 48

Sort → ORDER BY:
- `recent` → `created_at DESC, id DESC`
- `top_day` → `score DESC, created_at DESC` WHERE `created_at > now() - interval '1 day'`
- `top_week` → same with week
- `top_all` → `score DESC, created_at DESC`

Cursor encoding: `base64url(json({ "created_at": "...", "id": "...", "score": N }))` — include whichever fields define the sort order. Paginate with a WHERE clause like `(created_at, id) < (:c_ts, :c_id)` for recent.

Always filter `status = 'approved'`.

### 8.2 Response shape
**🔌 CONTRACT** — exactly as specified in `FRONTEND_PLAN.md` Phase 4.4. `image_url` and `image_thumb_url` are built via `StorageService.transform_url(...)`.

`user_vote` is only populated if the request is authenticated — join `votes` in the query when `user_id` present, else return `0`.

Computing `user_vote` efficiently for a paginated feed: one extra query after the feed query, `SELECT plate_id, value FROM votes WHERE user_id = :u AND plate_id IN (:ids)`, then zip it in. Don't LEFT JOIN on the hot path.

### 8.3 `GET /api/v1/plates/:id`
Simple; adds `related_plates` — 4 more from same state, highest score, excluding self.

### 8.4 `GET /api/v1/states/:code`
Returns `{ state: {code, name}, hero_plate: Plate, top_10: Plate[], total_count: int }`.

Cache this at the API layer (simple in-memory LRU with 5-minute TTL keyed by state) — it's read a lot and changes slowly.

---

## Phase 9 — Voting Endpoint

### 9.1 `POST /api/v1/plates/:id/vote`
**🔌 CONTRACT**

Request: `{ value: 1 | -1 | 0 }` — 0 means retract.

Server logic (single transaction):
1. Require auth.
2. Rate-limit check (Phase 7.2).
3. Ensure plate exists and is `approved`.
4. If `value == 0`: `DELETE FROM votes WHERE user_id = :u AND plate_id = :p`.
5. Else: `INSERT ... ON CONFLICT (user_id, plate_id) DO UPDATE SET value = :v`.
6. The DB trigger on `votes` updates `plates.upvotes/downvotes/score`.
7. Return `{ score, upvotes, downvotes, user_vote }` (refetch the row).

No self-vote restriction — users can vote on their own plates. (Could add; not in brief.)

---

## Phase 10 — Map & Leaderboard Endpoints

### 10.1 `GET /api/v1/map/summary`
**🔌 CONTRACT**

```sql
SELECT s.code, s.name, count(p.id) AS plate_count,
       (SELECT id FROM plates p2
          WHERE p2.state_code = s.code AND p2.status = 'approved'
          ORDER BY p2.score DESC, p2.created_at DESC LIMIT 1) AS top_plate_id
FROM states s
LEFT JOIN plates p ON p.state_code = s.code AND p.status = 'approved'
GROUP BY s.code, s.name
ORDER BY s.code;
```

Cache in-memory for 60s. This is hit on every home page load and every map view.

### 10.2 `GET /api/v1/leaderboard/overall?window=...&limit=...`
**🔌 CONTRACT**

`window: Literal["day", "week", "month", "all"]`, `limit: int = 50, max 100`.

Query: approved plates, filter by `created_at > now() - window`, order by `score DESC, created_at DESC`, limit N.

Returns `{ items: Plate[], window: "week", generated_at: "..." }`. Cache 60s.

### 10.3 Ranking considerations (`app/services/ranking.py`)
For v1, raw `score = upvotes - downvotes` is fine. If time permits, implement a Reddit-hot-style decay:
```
hot_score = score / ((age_hours + 2) ^ 1.5)
```
Store as a generated column or compute on the fly for small result sets. Not critical for passing Spark's review.

---

## Phase 11 — Comments (Nice-to-Have)

### 11.1 `GET /api/v1/plates/:id/comments?cursor=...&limit=20`
Paginated by `(created_at DESC, id DESC)`.

### 11.2 `POST /api/v1/plates/:id/comments`
**🔌 CONTRACT** — Request: `{ body: string }` (1–500 chars).
1. Require auth.
2. Rate limit.
3. Run `body` through text moderation (same pipeline as captions).
4. Insert, trigger updates `plates.comment_count`.
5. Return the new `Comment`.

---

## Phase 12 — Profile / Me Endpoints

### 12.1 `GET /api/v1/me`
Returns the user row.

### 12.2 `GET /api/v1/me/plates?cursor=...`
Includes `rejected` plates too (so the user sees why their upload didn't go live). This is the **only** endpoint where non-approved plates are returned, and only to their author.

### 12.3 `GET /api/v1/me/votes?cursor=...`
Joins `votes` → `plates`, returns list of `{ plate: Plate, value: 1|-1, voted_at: ... }`.

---

## Phase 13 — Deployment

### 13.1 Hosting options (free tiers)
| Host | Pros | Cons |
|---|---|---|
| **Fly.io** | Generous free tier, global, good for FastAPI, easy secrets | Needs Docker |
| **Render** | Simple, auto-deploy from git, free web service | Free tier sleeps after 15 min idle |
| **Railway** | Easy, good DX | Free tier has $5/mo limit |

**Recommendation: Fly.io.** Provides a real always-on container, enough free resources for a student project, and plays nice with Cloudflare Pages in front.

### 13.2 Dockerfile
Multi-stage, small final image:
```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
RUN pip install uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY ./app ./app
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 13.3 `fly.toml` highlights
- Single `app` with 256–512MB memory.
- Health check on `/healthz`.
- Release command: `alembic upgrade head`.
- Secrets: `fly secrets set DATABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=...`.

### 13.4 Database
- Use Supabase's managed Postgres (free tier includes 500MB DB, enough for tens of thousands of plates).
- `DATABASE_URL` points at Supabase's connection string with `?pgbouncer=true&connection_limit=5` for pooled connections (the session pooler on port 6543).

### 13.5 CORS origins in prod
```
CORS_ORIGINS=https://platergallery.pages.dev,https://platergallery.com
CORS_ORIGIN_REGEX=^https://[a-z0-9-]+\.platergallery\.pages\.dev$
```

### 13.6 Observability
- Fly's built-in logs are fine for v1.
- Optional: wire up Sentry (free tier) with the FastAPI integration. Capture unhandled exceptions and slow requests.

---

## Phase 14 — Testing

### 14.1 Unit tests
- Moderation pipeline with mocked provider responses (happy path + each rejection reason).
- Rate limiter (fake clock).
- Cursor encode/decode round-trip.
- Ranking math.

### 14.2 Integration tests
- Spin up a throwaway Postgres via `testcontainers`.
- Each test gets a clean DB. Apply all migrations.
- Hit endpoints via `httpx.AsyncClient` against the in-process app.
- Fake Supabase Storage by patching `StorageService` with an in-memory impl.
- Fake Supabase Auth by issuing our own HS256 JWTs signed with `SUPABASE_JWT_SECRET`.

Key scenarios:
- Full upload happy path.
- Upload rate-limited.
- Moderation rejects (each reason).
- Vote → retract → vote again; counters stay consistent.
- Feed pagination across a large seed (500 plates).
- Map summary returns 51 rows with correct counts.

### 14.3 Contract tests
Shared JSON fixtures in `/contracts/*.json` consumed by both frontend MSW mocks and backend tests. Any schema change breaks both sides, which is the point.

---

## Phase 15 — Submission Prep

- `README.md` in `/backend` covers: setup, env vars, migrations, how moderation works (pipeline diagram), which provider is active, how to swap.
- Top-level `README.md` (the one in the parent repo) links to both `/frontend` and `/backend` READMEs and explains the architecture:
  - Frontend on Cloudflare Pages.
  - Backend on Fly.io.
  - Supabase for Auth + Storage + Postgres.
  - Why direct-to-Storage upload (bandwidth efficiency, user's POV latency).
- Open a PR from the fork to `hack-bu/plate-gallery`.

---

## Appendix A — Contract surface (what backend owes frontend)

Same table as frontend Appendix A. If any row changes here, update there.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/users/sync` | ✅ | Upsert user on first login |
| GET | `/api/v1/me` | ✅ | Current user profile |
| GET | `/api/v1/me/plates` | ✅ | User's own uploads (incl. rejected) |
| GET | `/api/v1/me/votes` | ✅ | User's voting history |
| GET | `/api/v1/plates` | ⬜ | Paginated feed, filterable, sortable |
| GET | `/api/v1/plates/:id` | ⬜ | Single plate detail |
| POST | `/api/v1/uploads/sign` | ✅ | Rate-limit check + signed Storage URL |
| POST | `/api/v1/uploads/ocr-hint` | ✅ | Optional OCR guess |
| POST | `/api/v1/plates` | ✅ | Finalize upload: moderate + publish |
| POST | `/api/v1/plates/:id/vote` | ✅ | Cast / change / retract vote |
| GET | `/api/v1/plates/:id/comments` | ⬜ | Comments list |
| POST | `/api/v1/plates/:id/comments` | ✅ | New comment |
| GET | `/api/v1/states/:code` | ⬜ | State page: hero + top-10 |
| GET | `/api/v1/map/summary` | ⬜ | Per-state aggregate for map |
| GET | `/api/v1/leaderboard/overall` | ⬜ | Time-windowed global top |

## Appendix B — Error codes (canonical list)

| Code | HTTP | Meaning |
|---|---|---|
| `unauthorized` | 401 | Missing/invalid/expired JWT |
| `forbidden` | 403 | Authenticated but not allowed |
| `not_found` | 404 | Resource doesn't exist |
| `validation_error` | 422 | Request body/params failed schema validation |
| `moderation_rejected` | 422 | Upload failed moderation (details.reason filled) |
| `rate_limited` | 429 | Too many requests (Retry-After header set) |
| `conflict` | 409 | e.g., duplicate upload token consumption |
| `upstream_error` | 502 | Supabase/moderation provider failure |
| `internal_error` | 500 | Unhandled — sanitized message |
