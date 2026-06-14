from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
from dataclasses import dataclass

import httpx
from PIL import Image

from app.core.config import settings
from app.core.errors import UpstreamError

logger = logging.getLogger(__name__)

RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 2
_RETRY_BACKOFF_SECONDS = 1.0


@dataclass
class ImageCheckResult:
    ok: bool
    reason: str | None = None
    detail: str | None = None


def rule_based_check(image_bytes: bytes) -> ImageCheckResult:
    """Basic rule-based image validation."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()
        img = Image.open(io.BytesIO(image_bytes))
    except Exception:
        return ImageCheckResult(ok=False, reason="low_quality", detail="Image file is corrupted")

    width, height = img.size
    short_edge = min(width, height)
    if short_edge < 400:
        return ImageCheckResult(
            ok=False,
            reason="low_quality",
            detail=f"Image too small ({width}x{height}). Minimum 400px on short edge.",
        )

    return ImageCheckResult(ok=True)


MODERATION_PROMPT = (
    "You are a moderator for a vanity license plate gallery. Every approved image "
    "MUST prominently show a real vehicle license plate (the metal/plastic plate "
    "mounted on a car, truck, motorcycle, or trailer). Plates of food, decorative "
    "wall plaques, name plates, printed screenshots, drawings, or generated "
    "artwork are NOT license plates for this purpose.\n\n"
    "Evaluate the image on these fields and return a strict JSON object:\n"
    "- is_license_plate (bool): true only if a real vehicle license plate is the "
    "clear subject and its characters are legible.\n"
    "- is_explicit (bool): true if the image contains nudity, sexual content, "
    "graphic gore, or other NSFW material.\n"
    "- is_offensive_symbol (bool): true if it contains hate symbols, slurs, or "
    "extremist iconography (swastikas, KKK imagery, etc.).\n"
    "- quality_ok (bool): false if severely blurry, cropped, obstructed, or too "
    "dark to read the plate.\n"
    "- confidence (number 0-1): your confidence in the verdict.\n\n"
    'Respond ONLY with JSON in this exact shape, no prose, no code fences:\n'
    '{"is_license_plate": bool, "is_explicit": bool, "is_offensive_symbol": bool, '
    '"quality_ok": bool, "confidence": number}'
)


HARMFUL_SAFETY_CATEGORIES = {
    "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    "HARM_CATEGORY_DANGEROUS_CONTENT",
    "HARM_CATEGORY_HATE_SPEECH",
    "HARM_CATEGORY_HARASSMENT",
}

BLOCKED_PROBABILITIES = {"HIGH", "MEDIUM"}


def _check_safety_ratings(candidate: dict) -> ImageCheckResult | None:
    """Return a reject result if Gemini safety ratings flag the image."""
    ratings = candidate.get("safetyRatings") or []
    for rating in ratings:
        category = rating.get("category")
        probability = rating.get("probability")
        if category in HARMFUL_SAFETY_CATEGORIES and probability in BLOCKED_PROBABILITIES:
            if category == "HARM_CATEGORY_SEXUALLY_EXPLICIT":
                return ImageCheckResult(
                    ok=False, reason="explicit", detail="Sexual content detected"
                )
            if category in {"HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_HARASSMENT"}:
                return ImageCheckResult(
                    ok=False,
                    reason="offensive_text",
                    detail="Hateful or harassing content detected",
                )
            return ImageCheckResult(
                ok=False, reason="explicit", detail="Unsafe content detected"
            )
    return None


def _interpret_moderation_json(raw: str) -> ImageCheckResult:
    """Parse the model's JSON verdict and translate it into an ImageCheckResult."""
    content = raw.strip()
    # Strip code fences
    if "```" in content:
        for part in content.split("```"):
            part = part.strip().lstrip("json").strip()
            if part.startswith("{"):
                content = part
                break
    # Skip any preamble before the JSON object
    if not content.startswith("{"):
        start = content.find("{")
        if start != -1:
            content = content[start:]
    result = json.loads(content)

    if result.get("is_explicit"):
        return ImageCheckResult(ok=False, reason="explicit", detail="Explicit content detected")
    if result.get("is_offensive_symbol"):
        return ImageCheckResult(
            ok=False, reason="offensive_text", detail="Offensive symbol detected"
        )
    if not result.get("is_license_plate", False):
        return ImageCheckResult(
            ok=False, reason="not_a_plate", detail="No license plate visible in image"
        )
    if not result.get("quality_ok", True):
        return ImageCheckResult(ok=False, reason="low_quality", detail="Image quality too low")
    return ImageCheckResult(ok=True)


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
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "is_license_plate": {"type": "BOOLEAN"},
                    "is_explicit": {"type": "BOOLEAN"},
                    "is_offensive_symbol": {"type": "BOOLEAN"},
                    "quality_ok": {"type": "BOOLEAN"},
                    "confidence": {"type": "NUMBER"},
                },
                "required": [
                    "is_license_plate",
                    "is_explicit",
                    "is_offensive_symbol",
                    "quality_ok",
                    "confidence",
                ],
            },
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


async def check_image_openai(image_bytes: bytes, plate_text: str) -> ImageCheckResult:
    """Use OpenAI Vision to validate the image. Raises UpstreamError when the
    provider cannot return a verdict; callers fail open."""
    api_key = settings.OPENAI_API_KEY
    if not api_key or not api_key.get_secret_value():
        logger.error("MODERATION_PROVIDER=openai but OPENAI_API_KEY is not set")
        raise UpstreamError(
            "Image moderation service is not configured. Please try again later."
        )

    b64 = base64.b64encode(image_bytes).decode()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key.get_secret_value()}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": MODERATION_PROMPT},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{_detect_mime(image_bytes)};base64,{b64}",
                                        "detail": "low",
                                    },
                                },
                            ],
                        }
                    ],
                    "max_tokens": 200,
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, IndexError) as e:
        logger.error("OpenAI vision request failed: %s", e)
        raise UpstreamError(
            "Image moderation service is temporarily unavailable. Please try again."
        ) from e

    try:
        return _interpret_moderation_json(text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("OpenAI returned invalid JSON: %r (%s)", text, e)
        raise UpstreamError(
            "Image moderation service returned an unexpected response. Please try again."
        ) from e


async def check_image(image_bytes: bytes, plate_text: str) -> ImageCheckResult:
    """Run image checks based on configured provider."""
    basic = rule_based_check(image_bytes)
    if not basic.ok:
        return basic

    if settings.MODERATION_PROVIDER == "gemini":
        return await check_image_gemini(image_bytes, plate_text)
    if settings.MODERATION_PROVIDER == "openai":
        return await check_image_openai(image_bytes, plate_text)

    return ImageCheckResult(ok=True)
