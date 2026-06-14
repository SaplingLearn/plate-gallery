# Moderation Reliability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop legitimate plate uploads from failing in moderation, and stop distinct plates from being falsely rejected as duplicates.

**Architecture:** Fix the root cause of Gemini failures (thinking tokens starving `maxOutputTokens`), make the vision call resilient (bounded retry) and the pipeline fail *open* when the provider can't return a verdict, tighten duplicate detection, and ensure every logged error has a graceful handling path (no log-and-crash, no uncaught 500, no silent swallow).

**Tech Stack:** FastAPI / async SQLAlchemy / httpx / Pillow / pytest + respx (backend); React 19 + TypeScript + Vite (frontend).

**Spec:** `docs/superpowers/specs/2026-06-13-moderation-reliability-fixes-design.md`

---

## Execution notes (read first)

**Parallelism (subagent-driven).** Tasks 1–5 each touch a *different* file with no shared state, so they can be dispatched as **parallel subagents (Wave 1)**. Task 2's tests mock `check_image`, so it does not depend on Task 1's internals even though they are logically related. Tasks 6 then 7 run **after** Wave 1 completes, sequentially (Wave 2 → Wave 3), because Task 6 audits the files the others changed and Task 7 runs the whole suite.

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | 1, 2, 3, 4, 5 | parallel subagents (distinct files) |
| 2 | 6 | solo (cross-file audit) |
| 3 | 7 | solo (full verification) |

**Commits.** This repo's `CLAUDE.md` says *don't commit unless the user asks* — and user instructions override the skill's "frequent commits" default. Each task ends with a **commit step that is GATED**: stage the changes and only run `git commit` if the user has approved committing for this work. Otherwise leave staged/working changes for review. The commit commands are written out so they're ready when approval is given.

**Error-handling requirement (cross-cutting).** The user asked that *every error which is logged / surfaces in a console* also has real handling. Each task below makes its logged-error sites end in a defined outcome (fail open, reject with a reason, non-fatal continue, or a user-facing message). Task 6 is a dedicated audit that proves no logged error in the upload/moderation path can crash, bubble to an uncaught 500, or vanish silently.

---

## File structure

| File | Responsibility | Task |
|------|----------------|------|
| `backend/app/services/moderation/image_check.py` | Vision provider calls; thinking disabled; bounded retry; MIME detection; raise `UpstreamError` on no-verdict | 1 |
| `backend/app/services/moderation/pipeline.py` | Orchestration; fail open when image check is unavailable | 2 |
| `backend/app/services/moderation/duplicate_check.py` | pHash duplicate lookup; threshold 4; log nearest distance | 3 |
| `backend/app/api/v1/uploads.py` | `/sign` entry point; friendlier unsupported-format message | 4 |
| `frontend/src/pages/Upload.tsx` | Upload UI; `low_quality` message; console logging of unexpected errors | 5 |
| `backend/tests/test_image_moderation.py` | Extended Gemini tests (retry, thinking config, MIME, MAX_TOKENS) | 1 |
| `backend/tests/test_moderation_pipeline.py` | New: fail-open / reject pipeline tests | 2 |
| `backend/tests/test_duplicate_check.py` | New: threshold + distance-logging tests | 3 |

---

## Task 1: Harden the Gemini vision call (image_check.py)

**Files:**
- Modify: `backend/app/services/moderation/image_check.py`
- Test: `backend/tests/test_image_moderation.py`

Addresses spec P0 (thinking tokens vs `maxOutputTokens`), P1 (MAX_TOKENS / retry), P3 (OpenAI MIME parity), and makes every logged error here end in `UpstreamError` (handled by the pipeline in Task 2).

- [ ] **Step 1: Write failing tests for request shape, MIME, MAX_TOKENS, and retry**

Add these to `backend/tests/test_image_moderation.py`. First add this import near the top (after the existing imports):

```python
from app.services.moderation import image_check
```

Add a WebP helper next to the existing `_png_bytes`:

```python
def _webp_bytes(size: tuple[int, int] = (600, 400), color: str = "green") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="WEBP")
    return buf.getvalue()
```

Add these tests inside `class TestCheckImageGemini`:

```python
    @respx.mock
    async def test_request_disables_thinking_and_raises_token_cap(self, gemini_key):
        route = respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(
            return_value=httpx.Response(
                200,
                json=_gemini_reply(
                    {
                        "is_license_plate": True,
                        "is_explicit": False,
                        "is_offensive_symbol": False,
                        "quality_ok": True,
                        "confidence": 0.95,
                    }
                ),
            )
        )
        await check_image_gemini(_png_bytes(), "ABC123")
        body = json.loads(route.calls.last.request.content)
        assert body["generationConfig"]["thinkingConfig"]["thinkingBudget"] == 0
        assert body["generationConfig"]["maxOutputTokens"] == 800

    @respx.mock
    async def test_request_sends_detected_mime(self, gemini_key):
        route = respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(
            return_value=httpx.Response(
                200,
                json=_gemini_reply(
                    {
                        "is_license_plate": True,
                        "is_explicit": False,
                        "is_offensive_symbol": False,
                        "quality_ok": True,
                        "confidence": 0.9,
                    }
                ),
            )
        )
        await check_image_gemini(_webp_bytes(), "ABC123")
        body = json.loads(route.calls.last.request.content)
        assert body["contents"][0]["parts"][1]["inline_data"]["mime_type"] == "image/webp"

    @respx.mock
    async def test_max_tokens_with_no_parts_raises_upstream(self, gemini_key):
        respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(
            return_value=httpx.Response(
                200,
                json={"candidates": [{"content": {"role": "model"}, "finishReason": "MAX_TOKENS"}]},
            )
        )
        with pytest.raises(UpstreamError):
            await check_image_gemini(_png_bytes(), "ABC123")

    @respx.mock
    async def test_retries_on_503_then_succeeds(self, gemini_key, monkeypatch):
        monkeypatch.setattr(image_check, "_RETRY_BACKOFF_SECONDS", 0)
        route = respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(
            side_effect=[
                httpx.Response(503, json={"error": "overloaded"}),
                httpx.Response(
                    200,
                    json=_gemini_reply(
                        {
                            "is_license_plate": True,
                            "is_explicit": False,
                            "is_offensive_symbol": False,
                            "quality_ok": True,
                            "confidence": 0.9,
                        }
                    ),
                ),
            ]
        )
        result = await check_image_gemini(_png_bytes(), "ABC123")
        assert result.ok
        assert route.call_count == 2

    @respx.mock
    async def test_retries_exhausted_raises_upstream(self, gemini_key, monkeypatch):
        monkeypatch.setattr(image_check, "_RETRY_BACKOFF_SECONDS", 0)
        route = respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(return_value=httpx.Response(503, json={"error": "overloaded"}))
        with pytest.raises(UpstreamError):
            await check_image_gemini(_png_bytes(), "ABC123")
        assert route.call_count == 2
```

Also update the existing `test_http_error_raises_upstream` to disable backoff (500 is now retryable, so without this it sleeps 1s):

```python
    @respx.mock
    async def test_http_error_raises_upstream(self, gemini_key, monkeypatch):
        monkeypatch.setattr(image_check, "_RETRY_BACKOFF_SECONDS", 0)
        respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(return_value=httpx.Response(500, json={"error": "down"}))
        with pytest.raises(UpstreamError):
            await check_image_gemini(_png_bytes(), "ABC123")
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `cd backend && pytest tests/test_image_moderation.py -k "thinking or detected_mime or max_tokens or retries" -v`
Expected: FAIL (e.g. `AttributeError: module ... has no attribute '_RETRY_BACKOFF_SECONDS'`, and assertion errors on `thinkingConfig` / `maxOutputTokens`).

- [ ] **Step 3: Add module constants and the `_detect_mime` helper**

In `image_check.py`, add `import asyncio` to the imports (top of file, with the other stdlib imports). Then add these module-level constants just below `logger = logging.getLogger(__name__)`:

```python
RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 2
_RETRY_BACKOFF_SECONDS = 1.0
```

Add this helper just above `check_image_gemini` (it replaces the inline MIME block):

```python
def _detect_mime(image_bytes: bytes) -> str:
    """Best-effort image MIME detection for vision API calls."""
    try:
        fmt = Image.open(io.BytesIO(image_bytes)).format or ""
    except Exception:
        return "image/jpeg"
    return {
        "JPEG": "image/jpeg",
        "PNG": "image/png",
        "WEBP": "image/webp",
        "GIF": "image/gif",
        "HEIC": "image/heic",
    }.get(fmt, "image/jpeg")
```

- [ ] **Step 4: Replace the body of `check_image_gemini`**

Replace the entire `check_image_gemini` function (from its `async def` through its final `return`) with:

```python
async def check_image_gemini(image_bytes: bytes, plate_text: str) -> ImageCheckResult:
    """Use Gemini Flash to validate the image. Raises UpstreamError when the
    provider cannot return a verdict; callers fail open."""
    api_key = settings.GEMINI_API_KEY
    if not api_key or not api_key.get_secret_value():
        logger.error("MODERATION_PROVIDER=gemini but GEMINI_API_KEY is not set")
        raise UpstreamError(
            "Image moderation service is not configured. Please try again later."
        )

    mime_type = _detect_mime(image_bytes)
    b64 = base64.b64encode(image_bytes).decode()
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent"
    )
    request_body = {
        "contents": [
            {
                "parts": [
                    {"text": MODERATION_PROMPT},
                    {"inline_data": {"mime_type": mime_type, "data": b64}},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "maxOutputTokens": 800,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    payload = None
    for attempt in range(_MAX_ATTEMPTS):
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    url,
                    headers={"x-goog-api-key": api_key.get_secret_value()},
                    json=request_body,
                )
        except httpx.HTTPError as e:
            if attempt + 1 < _MAX_ATTEMPTS:
                logger.warning(
                    "Gemini request error (attempt %d/%d), retrying: %s",
                    attempt + 1, _MAX_ATTEMPTS, e,
                )
                await asyncio.sleep(_RETRY_BACKOFF_SECONDS)
                continue
            logger.error(
                "Gemini vision request failed after %d attempts: %s", _MAX_ATTEMPTS, e
            )
            raise UpstreamError(
                "Image moderation service is temporarily unavailable. Please try again."
            ) from e

        if resp.status_code in RETRYABLE_STATUS:
            if attempt + 1 < _MAX_ATTEMPTS:
                logger.warning(
                    "Gemini returned retryable %s (attempt %d/%d), retrying: %s",
                    resp.status_code, attempt + 1, _MAX_ATTEMPTS, resp.text[:500],
                )
                await asyncio.sleep(_RETRY_BACKOFF_SECONDS)
                continue
            logger.error(
                "Gemini returned %s after %d attempts: %s",
                resp.status_code, _MAX_ATTEMPTS, resp.text[:500],
            )
            raise UpstreamError(
                "Image moderation service is temporarily unavailable. Please try again."
            )

        if not resp.is_success:
            logger.error("Gemini returned %s: %s", resp.status_code, resp.text[:500])
            raise UpstreamError(
                "Image moderation service returned an error. Please try again later."
            )

        payload = resp.json()
        break
    else:
        raise UpstreamError(
            "Image moderation service is temporarily unavailable. Please try again."
        )

    prompt_feedback = payload.get("promptFeedback") or {}
    block_reason = prompt_feedback.get("blockReason")
    if block_reason:
        logger.info("Gemini blocked prompt: %s", block_reason)
        reason = "explicit" if block_reason in {"SAFETY", "PROHIBITED_CONTENT"} else "other"
        return ImageCheckResult(
            ok=False,
            reason=reason,
            detail=f"Content blocked by safety filter ({block_reason})",
        )

    candidates = payload.get("candidates") or []
    if not candidates:
        logger.error("Gemini returned no candidates: %s", payload)
        raise UpstreamError(
            "Image moderation service returned an unexpected response. Please try again."
        )

    candidate = candidates[0]

    finish_reason = candidate.get("finishReason")
    if finish_reason == "SAFETY":
        return ImageCheckResult(
            ok=False, reason="explicit", detail="Content blocked by safety filter"
        )

    safety_reject = _check_safety_ratings(candidate)
    if safety_reject:
        return safety_reject

    parts = (candidate.get("content") or {}).get("parts") or []
    if not parts or finish_reason in {"MAX_TOKENS", "RECITATION", "OTHER"}:
        logger.error(
            "Gemini returned no usable text (finishReason=%s): %s", finish_reason, payload
        )
        raise UpstreamError(
            "Image moderation service returned an incomplete response. Please try again."
        )

    try:
        text = parts[0]["text"]
    except (KeyError, IndexError) as e:
        logger.error("Gemini response missing text: %s (%s)", payload, e)
        raise UpstreamError(
            "Image moderation service returned an unexpected response. Please try again."
        ) from e

    try:
        return _interpret_moderation_json(text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Gemini returned invalid JSON: %r (%s)", text, e)
        raise UpstreamError(
            "Image moderation service returned an unexpected response. Please try again."
        ) from e
```

- [ ] **Step 5: Fix the OpenAI MIME hardcode (P3 parity)**

In `check_image_openai`, change the image URL line:

```python
                                        "url": f"data:image/jpeg;base64,{b64}",
```

to:

```python
                                        "url": f"data:{_detect_mime(image_bytes)};base64,{b64}",
```

- [ ] **Step 6: Run the full moderation test file**

Run: `cd backend && pytest tests/test_image_moderation.py -v`
Expected: PASS (all existing tests + the 5 new ones). No test should take ~1s+ (backoff is patched to 0 in the retrying tests).

- [ ] **Step 7: Stage and (if approved) commit**

```bash
git add backend/app/services/moderation/image_check.py backend/tests/test_image_moderation.py
# GATED: only if user approved committing
git commit -m "fix(moderation): disable Gemini thinking, add retry + MIME detection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Fail open when image moderation is unavailable (pipeline.py)

**Files:**
- Modify: `backend/app/services/moderation/pipeline.py`
- Test: `backend/tests/test_moderation_pipeline.py` (new)

Implements the fail-open policy: a real verdict still rejects; an `UpstreamError` (provider can't decide) is logged and the upload is approved, with rule-based + duplicate checks still applied.

- [ ] **Step 1: Write the failing pipeline tests**

Create `backend/tests/test_moderation_pipeline.py`:

```python
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd backend && pytest tests/test_moderation_pipeline.py -v`
Expected: `test_fails_open_on_upstream_error` FAILS (currently `UpstreamError` propagates out of `run_moderation`); the other two should pass already.

- [ ] **Step 3: Add the fail-open handling**

In `pipeline.py`, add the import at the top with the other `app` imports:

```python
from app.core.errors import UpstreamError
```

Replace the existing image-check block (the `# 2. Image check` section) with:

```python
    # 2. Image check — fail open if the provider cannot return a verdict
    image_check_skipped = False
    try:
        image_result = await check_image(image_bytes, plate_text)
    except UpstreamError as e:
        logger.warning("moderation image check unavailable, failing open: %s", e)
        image_check_skipped = True
    else:
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
```

Then replace the final approval block at the end of `run_moderation`:

```python
    duration = int((time.monotonic() - start) * 1000)
    logger.info(
        "moderation_decision approved=true image_check_skipped=%s duration_ms=%d",
        image_check_skipped,
        duration,
    )
    return ModerationResult(
        approved=True, phash=phash, signals={"image_check_skipped": image_check_skipped}
    )
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd backend && pytest tests/test_moderation_pipeline.py -v`
Expected: PASS (all three).

- [ ] **Step 5: Stage and (if approved) commit**

```bash
git add backend/app/services/moderation/pipeline.py backend/tests/test_moderation_pipeline.py
# GATED: only if user approved committing
git commit -m "fix(moderation): fail open when image check is unavailable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Tighten duplicate detection + log distance (duplicate_check.py)

**Files:**
- Modify: `backend/app/services/moderation/duplicate_check.py`
- Test: `backend/tests/test_duplicate_check.py` (new)

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_duplicate_check.py`:

```python
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd backend && pytest tests/test_duplicate_check.py -v`
Expected: FAIL — current query has no `dist` column and default threshold is 6, so `test_beyond_threshold_is_not_duplicate`, `test_logs_nearest_distance`, and `test_default_threshold_is_four` fail.

- [ ] **Step 3: Rewrite `find_duplicate`**

In `duplicate_check.py`, add a logger after the imports:

```python
import logging

logger = logging.getLogger(__name__)
```

Replace the entire `find_duplicate` function with:

```python
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
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd backend && pytest tests/test_duplicate_check.py -v`
Expected: PASS (all five).

- [ ] **Step 5: Stage and (if approved) commit**

```bash
git add backend/app/services/moderation/duplicate_check.py backend/tests/test_duplicate_check.py
# GATED: only if user approved committing
git commit -m "fix(moderation): tighten dup threshold to 4 and log nearest distance

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Friendlier unsupported-format message (uploads.py)

**Files:**
- Modify: `backend/app/api/v1/uploads.py`

No endpoint test harness exists in this repo, so this string-only change is verified by lint + manual check (the reject *logic* is unchanged).

- [ ] **Step 1: Update the message**

In `sign_upload`, replace:

```python
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(
            f"Unsupported file type: {content_type}",
            {"allowed": list(ALLOWED_CONTENT_TYPES)},
        )
```

with:

```python
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(
            "Unsupported image format. Please upload a JPEG, PNG, or WebP. "
            "iPhone HEIC photos usually convert automatically — if not, set "
            "Camera → Formats to “Most Compatible,” or export as JPEG.",
            {"allowed": sorted(ALLOWED_CONTENT_TYPES), "received": content_type},
        )
```

- [ ] **Step 2: Lint and confirm imports/syntax are clean**

Run: `cd backend && ruff check app/api/v1/uploads.py`
Expected: no errors. (If `ruff` is not installed, run `python -c "import ast; ast.parse(open('app/api/v1/uploads.py').read())"` — expected: no output.)

- [ ] **Step 3: Stage and (if approved) commit**

```bash
git add backend/app/api/v1/uploads.py
# GATED: only if user approved committing
git commit -m "fix(uploads): clearer message for unsupported image formats

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Frontend rejection message + error logging (Upload.tsx)

**Files:**
- Modify: `frontend/src/pages/Upload.tsx`

No frontend test runner exists; verify with `npm run build` + `npm run lint` + manual. This task fully owns `Upload.tsx` (Task 6 will not touch it).

- [ ] **Step 1: Add the `low_quality` rejection message**

In the `moderation_rejected` branch of `handleSubmit`'s `catch`, add a `low_quality` line before the final fallback string. Replace:

```tsx
          reason === 'offensive_text' ? 'The plate text was flagged as offensive.' :
          'This upload was rejected by our moderation system.'
```

with:

```tsx
          reason === 'offensive_text' ? 'The plate text was flagged as offensive.' :
          reason === 'low_quality' ? 'The photo was too small or blurry to read the plate — try a sharper, closer shot.' :
          'This upload was rejected by our moderation system.'
```

- [ ] **Step 2: Log unexpected errors to the console (handled + visible)**

In the same `catch (err)`, the final `else` branch currently shows a generic message but logs nothing. Replace:

```tsx
      } else {
        setErrorHeadline('Something went wrong.')
        setErrorMessage(err instanceof Error ? err.message : 'Please try again.')
        setStep('error')
      }
```

with:

```tsx
      } else {
        console.error('Plate upload failed:', err)
        setErrorHeadline('Something went wrong.')
        setErrorMessage(
          err instanceof Error && err.message ? err.message : 'Please try again.'
        )
        setStep('error')
      }
```

- [ ] **Step 3: Build and lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: build succeeds (tsc + vite), eslint reports no new errors.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open the upload flow, and confirm the page compiles and renders. (A full rejected-upload path needs the backend; functional verification of the message happens in Task 7's manual notes.)

- [ ] **Step 5: Stage and (if approved) commit**

```bash
git add frontend/src/pages/Upload.tsx
# GATED: only if user approved committing
git commit -m "fix(upload): add low_quality rejection message and log unexpected errors

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Error-handling completeness audit (Wave 2, solo)

**Files:**
- Read/verify: all files touched in Wave 1 + `backend/app/api/v1/plates.py`, `backend/app/services/storage.py`, `backend/app/core/errors.py`
- Possibly modify: any file with a logged error that lacks graceful handling

Goal: prove that every error logged or surfaced to a console in the upload/moderation path ends in a defined outcome. This is a verification task with a concrete checklist; only make a change if a gap is found.

- [ ] **Step 1: Enumerate every logged error in the path**

Run:
```bash
cd backend && grep -rn "logger\.\(error\|warning\|exception\)" app/services/moderation app/api/v1/uploads.py app/api/v1/plates.py app/services/storage.py app/core/errors.py
grep -rn "console\." ../frontend/src/pages/Upload.tsx
```

- [ ] **Step 2: Confirm each site against this expected-handling table**

Verify by reading each site that its outcome matches:

| Site | Expected handling |
|------|-------------------|
| `image_check.py` — API key missing | `logger.error` → raises `UpstreamError` → **pipeline fails open** (Task 2) |
| `image_check.py` — retryable status / network error | `logger.warning` retry, then `logger.error` → `UpstreamError` → **fail open** |
| `image_check.py` — non-retryable 4xx | `logger.error` → `UpstreamError` → **fail open** |
| `image_check.py` — no candidates / MAX_TOKENS / missing text / bad JSON | `logger.error` → `UpstreamError` → **fail open** |
| `image_check.py` — `blockReason` set | `logger.info` → returns reject verdict (handled) |
| `pipeline.py` — phash compute failure | `logger.warning` → `phash=None`, duplicate check skipped, continues (handled) |
| `pipeline.py` — image check unavailable | `logger.warning` → fail open (handled) |
| `duplicate_check.py` — nearest distance | `logger.info` → telemetry only (handled) |
| `plates.py` — `download_object` failure | caught → `ValidationError` user message (`plates.py:178-181`) |
| `uploads.py` — signed-URL failure | `logger.error` → `ValidationError` user message |
| `storage.py` — bucket-public / delete failures | `logger.warning` → non-fatal, continues (handled) |
| `errors.py` — `unhandled_error_handler` | `logger.exception` → 500 envelope; this is the safety net, not a normal path |
| `Upload.tsx` — `console.error` (Task 5) | accompanied by graceful error UI (handled) |

- [ ] **Step 3: Confirm the moderation path cannot reach the 500 safety net**

Verify in `plates.py:create_plate` that the only call that can raise `UpstreamError` is `run_moderation`, and that `run_moderation` no longer propagates `UpstreamError` (Task 2 catches it around `check_image`; `check_text` and `find_duplicate` do not raise `UpstreamError`). Confirm `download_object` is wrapped (`try/except → ValidationError`). Result: no moderation/upload error reaches `unhandled_error_handler`.

Run the moderation suite as evidence:
```bash
cd backend && pytest tests/test_moderation_pipeline.py tests/test_image_moderation.py -q
```
Expected: PASS. If any site in Step 2 does not match its expected handling, fix it inline (e.g., wrap an unguarded call) and re-run.

- [ ] **Step 4: Stage and (if approved) commit any fixes**

```bash
# Only if Step 3 required a change:
git add -A
# GATED: only if user approved committing
git commit -m "fix(moderation): ensure all logged errors have graceful handling

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Full verification (Wave 3, solo)

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run: `cd backend && pytest -q`
Expected: PASS, no errors. Note the wall-clock time is not inflated by retry sleeps (backoff patched to 0 in retry tests).

- [ ] **Step 2: Lint the backend (if ruff present)**

Run: `cd backend && ruff check app tests`
Expected: no errors. (Skip if ruff is not configured.)

- [ ] **Step 3: Build + lint the frontend**

Run: `cd frontend && npm run build && npm run lint`
Expected: build succeeds; eslint reports no new errors.

- [ ] **Step 4: Manual smoke test (requires running backend + frontend)**

With `backend/.env` configured (`MODERATION_PROVIDER=gemini`, valid `GEMINI_API_KEY`):
- Upload a real plate photo → expect **approved** and redirect to the plate page (previously could 502).
- Upload a non-plate photo (e.g. a landscape) → expect **rejected** with "We couldn't find a license plate in this photo."
- (Optional outage simulation) Temporarily set `GEMINI_API_KEY` to an invalid value and upload a real plate → expect **approved** (fail open) with a `failing open` warning in the backend logs.

- [ ] **Step 5: Final staged review / commit summary**

```bash
git status
git diff --staged --stat
# GATED: only if user approved committing — otherwise leave staged for review
```

---

## Self-review (completed by plan author)

- **Spec coverage:** P0 thinking/tokens → Task 1 Step 4 (`thinkingConfig`, `maxOutputTokens: 800`). P1 MAX_TOKENS/empty parts → Task 1 Step 4 + test. P1 retry → Task 1 Steps 3–4 + tests. P1 fail open → Task 2. P2 duplicate threshold + logging → Task 3. P2 HEIC message → Task 4. P3 OpenAI MIME parity → Task 1 Step 5. Frontend `low_quality` → Task 5. Risk "misconfig fails open" → preserved (API-key-missing raises `UpstreamError` at `ERROR` level → fail open) and audited in Task 6. Error-handling-everywhere requirement → Task 6.
- **Type/name consistency:** `_RETRY_BACKOFF_SECONDS`, `_MAX_ATTEMPTS`, `RETRYABLE_STATUS`, `_detect_mime`, `image_check_skipped` signal key, and `find_duplicate(..., threshold=4)` are used identically in implementation and tests.
- **No placeholders:** every code/test step contains complete code and exact commands with expected output.
