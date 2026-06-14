# Moderation reliability fixes — design

- **Date:** 2026-06-13
- **Status:** Approved (design); pending implementation plan
- **Scope:** Backend image-moderation pipeline + upload entry point, with one frontend edge.

## Problem

Users report bugs with image moderation on plate upload. The audit found the
moderation pipeline can fail on legitimate uploads and can falsely reject
distinct plates as duplicates.

### Root causes (audit findings)

1. **P0 — Gemini 2.5 Flash thinking tokens collide with `maxOutputTokens: 200`.**
   `GEMINI_MODEL` defaults to `gemini-2.5-flash`, which has thinking enabled by
   default. Thinking tokens count against `maxOutputTokens`. When the model
   spends the budget thinking, it returns `finishReason: "MAX_TOKENS"` with no
   `parts` in `content`. `check_image_gemini` then does
   `candidate["content"]["parts"][0]["text"]` (`image_check.py:215`), which
   raises `KeyError`/`IndexError` → `UpstreamError` → **502 on a good photo**.
   Intermittent, depending on how much the model "thinks".

2. **P1 — No explicit handling of `MAX_TOKENS` / missing `parts`.** The only
   `finishReason` handled is `SAFETY`. Other terminal states fall through to the
   crash above.

3. **P1 — Any Gemini hiccup blocks all uploads.** `check_image_gemini` raises
   `UpstreamError` on every failure (429 quota, 5xx, timeout, empty, malformed)
   with no retry and no fallback. Under quota exhaustion nobody can upload.

4. **P2 — False "duplicate" rejections.** `find_duplicate` uses Hamming
   distance ≤ 6 over a 64-bit perceptual hash. Different-but-similar plates
   (white plate, black text, similar framing) can fall within 6 bits.

5. **P2 — HEIC uploads blocked with an unhelpful message.** `/sign` allows only
   jpeg/png/webp. The frontend already converts HEIC via Safari, but the
   backend message is terse.

6. **P3 — OpenAI path hardcodes `data:image/jpeg`.** Same class of bug the
   recent Gemini fix addressed; latent because the prod provider is Gemini.

7. **Frontend edge — no `low_quality` message.** `Upload.tsx` maps most
   rejection reasons but `low_quality` falls to the generic message.

## Decisions (locked)

- **Fail open on unavailability.** If the AI moderator cannot return a verdict
  (timeout / 429 / 5xx / empty / malformed, even after retry), the upload is
  **approved**. Rule-based checks (decode, min size) and the duplicate check
  still apply. A genuine verdict (`explicit`, `not_a_plate`, …) still rejects.
- **HEIC:** keep the jpeg/png/webp allowlist; only improve the error message.
- **Duplicates:** tighten threshold 6 → 4 and log the nearest-neighbor distance
  for calibration.
- **`maxOutputTokens`: keep a cap of 800** (not removed). With `thinkingBudget:
  0` the JSON verdict is ~60–80 tokens, so 800 is ~10× headroom and retains a
  cost/runaway safety bound.

## Changes

### `backend/app/services/moderation/image_check.py`

- Add `"thinkingConfig": {"thinkingBudget": 0}` to `generationConfig`; raise
  `maxOutputTokens` 200 → 800. **Root-cause fix for P0.**
- After selecting the candidate, explicitly detect
  `finishReason in {"MAX_TOKENS", "RECITATION", "OTHER"}` and empty/missing
  `parts`: log with the finish reason, then raise `UpstreamError` so the
  pipeline's fail-open policy handles it uniformly. (P1)
- Add a bounded **retry** around the HTTP call: 2 attempts total (1 retry) with
  a short backoff (~1s) between them, retrying only transient failures (timeout,
  connect error, HTTP 429, HTTP 5xx). Do **not** retry 4xx. Per-attempt timeout
  20s → worst-case added latency ~41s. (P1)
- Extract `_detect_mime(image_bytes) -> str` from the existing inline logic and
  reuse it in both the Gemini and OpenAI paths; fixes the OpenAI
  `data:image/jpeg` hardcode (`:256`). (P3)

### `backend/app/services/moderation/pipeline.py`

- Wrap `check_image` in `try/except UpstreamError`:
  - Real verdict (`ok == False`) → reject as today.
  - `UpstreamError` → log a warning, set `signals={"image_check_skipped": True}`,
    and **continue** to the duplicate check instead of propagating the error.
  - Approval log line reflects the skip.
- Rule-based failures (corrupted / too small) return `ok == False` (not raised),
  so they still reject even in fail-open mode.

### `backend/app/services/moderation/duplicate_check.py`

- Default `threshold` 6 → 4.
- Query the nearest neighbor (order by distance, limit 1) within the existing
  state / approved / 90-day / non-null-phash filter; log the distance always;
  flag as duplicate only when distance ≤ threshold.
- Add a module logger.

### `backend/app/api/v1/uploads.py`

- Friendlier unsupported-type message naming JPEG/PNG/WebP and the HEIC→convert
  hint. Allowlist unchanged.

### `frontend/src/pages/Upload.tsx`

- Add a `low_quality` branch to the `moderation_rejected` message map, e.g.
  "The photo was too small or blurry to read the plate — try a sharper, closer
  shot."

## Tests (TDD — write first, watch fail, then implement)

- `backend/tests/test_image_moderation.py` (extend):
  - Request body includes `thinkingConfig.thinkingBudget == 0` and
    `maxOutputTokens == 800`.
  - `finishReason == "MAX_TOKENS"` with empty/missing `parts` → `UpstreamError`.
  - MIME detection sends `image/png` and `image/webp` (assert request body).
  - Retry: one 503 then 200 → success; two 503s → `UpstreamError`.
- `backend/tests/test_moderation_pipeline.py` (new):
  - `UpstreamError` from image check → `approved == True` with
    `image_check_skipped` signal; duplicate check still runs.
  - Real verdict still rejects.
  - Rule-based failure still rejects even in fail-open mode.
- `backend/tests/test_duplicate_check.py` (new or extend):
  - Distance 4 → duplicate; distance 5 → not a duplicate.
  - Nearest-neighbor distance is logged.

## Risks / tradeoffs

- **Misconfiguration also fails open.** The "API key not configured" path raises
  `UpstreamError`, so a misconfigured deploy will silently approve uploads. We
  keep that path at `ERROR` log level so it is visible. This is the accepted
  cost of the fail-open policy.
- **Added latency on outages.** Retries add up to ~40s worst case on a fully
  failing Gemini before the upload falls open. Acceptable for an upload action.

## Out of scope

- Full HEIC decode support (would need `pillow-heif` for PIL + phash).
- Making the duplicate threshold a config/env var.
- Persisting a "moderation skipped" status to the DB (decision was plain fail
  open, not flag-for-review). No schema change.
- Loosening the 400px minimum-image-size rule-based check.
