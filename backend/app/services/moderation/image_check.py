from __future__ import annotations

import io
import logging
from dataclasses import dataclass

from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)


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
    "You are a license plate gallery moderator. Inspect this image and "
    "respond ONLY with JSON (no prose, no code fences):\n"
    '{"is_license_plate": bool, "is_explicit": bool, "is_offensive_symbol": bool, '
    '"quality_ok": bool, "confidence": number}'
)


def _interpret_moderation_json(raw: str) -> ImageCheckResult:
    """Parse the model's JSON verdict and translate it into an ImageCheckResult."""
    import json

    content = raw.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[-1].rsplit("```", 1)[0]
    result = json.loads(content)

    if result.get("is_explicit"):
        return ImageCheckResult(ok=False, reason="explicit", detail="Explicit content detected")
    if result.get("is_offensive_symbol"):
        return ImageCheckResult(
            ok=False, reason="offensive_text", detail="Offensive symbol detected"
        )
    if not result.get("is_license_plate", True):
        return ImageCheckResult(
            ok=False, reason="not_a_plate", detail="No license plate visible in image"
        )
    if not result.get("quality_ok", True):
        return ImageCheckResult(ok=False, reason="low_quality", detail="Image quality too low")
    return ImageCheckResult(ok=True)


async def check_image_gemini(image_bytes: bytes, plate_text: str) -> ImageCheckResult:
    """Use Gemini Flash (free tier) to validate the image."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return ImageCheckResult(ok=True)

    try:
        import base64

        import httpx

        b64 = base64.b64encode(image_bytes).decode()
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.GEMINI_MODEL}:generateContent"
        )
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                headers={"x-goog-api-key": api_key.get_secret_value()},
                json={
                    "contents": [
                        {
                            "parts": [
                                {"text": MODERATION_PROMPT},
                                {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
                            ]
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0,
                        "responseMimeType": "application/json",
                        "maxOutputTokens": 200,
                    },
                },
            )
            resp.raise_for_status()
            payload = resp.json()
            text = payload["candidates"][0]["content"]["parts"][0]["text"]

        return _interpret_moderation_json(text)

    except Exception as e:
        logger.warning("Gemini vision check failed, falling back to approve: %s", e)
        return ImageCheckResult(ok=True)


async def check_image_openai(image_bytes: bytes, plate_text: str) -> ImageCheckResult:
    """Use OpenAI Vision to validate the image."""
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return ImageCheckResult(ok=True)

    try:
        import base64

        import httpx

        b64 = base64.b64encode(image_bytes).decode()
        async with httpx.AsyncClient(timeout=10) as client:
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
                                        "url": f"data:image/jpeg;base64,{b64}",
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

        return _interpret_moderation_json(text)

    except Exception as e:
        logger.warning("OpenAI vision check failed, falling back to approve: %s", e)
        return ImageCheckResult(ok=True)


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
