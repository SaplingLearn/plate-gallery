from __future__ import annotations

import io
import json

import httpx
import pytest
import respx
from PIL import Image
from pydantic import SecretStr

from app.core.config import settings
from app.core.errors import UpstreamError
from app.services.moderation import image_check
from app.services.moderation.image_check import (
    _check_safety_ratings,
    _interpret_moderation_json,
    check_image,
    check_image_gemini,
    rule_based_check,
)


def _png_bytes(size: tuple[int, int] = (600, 400), color: str = "blue") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def _webp_bytes(size: tuple[int, int] = (600, 400), color: str = "green") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="WEBP")
    return buf.getvalue()


def _gemini_reply(body: dict) -> dict:
    return {
        "candidates": [
            {
                "content": {"parts": [{"text": json.dumps(body)}]},
                "finishReason": "STOP",
                "safetyRatings": [],
            }
        ]
    }


class TestRuleBasedCheck:
    def test_rejects_corrupted_bytes(self):
        result = rule_based_check(b"not an image")
        assert not result.ok
        assert result.reason == "low_quality"

    def test_rejects_tiny_image(self):
        result = rule_based_check(_png_bytes((100, 100)))
        assert not result.ok
        assert result.reason == "low_quality"

    def test_accepts_large_image(self):
        result = rule_based_check(_png_bytes((800, 600)))
        assert result.ok


class TestInterpretModerationJson:
    def test_approves_valid_plate(self):
        result = _interpret_moderation_json(
            json.dumps(
                {
                    "is_license_plate": True,
                    "is_explicit": False,
                    "is_offensive_symbol": False,
                    "quality_ok": True,
                    "confidence": 0.95,
                }
            )
        )
        assert result.ok

    def test_rejects_non_plate(self):
        result = _interpret_moderation_json(
            json.dumps(
                {
                    "is_license_plate": False,
                    "is_explicit": False,
                    "is_offensive_symbol": False,
                    "quality_ok": True,
                    "confidence": 0.9,
                }
            )
        )
        assert not result.ok
        assert result.reason == "not_a_plate"

    def test_rejects_explicit(self):
        result = _interpret_moderation_json(
            json.dumps(
                {
                    "is_license_plate": True,
                    "is_explicit": True,
                    "is_offensive_symbol": False,
                    "quality_ok": True,
                    "confidence": 0.9,
                }
            )
        )
        assert not result.ok
        assert result.reason == "explicit"

    def test_rejects_offensive_symbol(self):
        result = _interpret_moderation_json(
            json.dumps(
                {
                    "is_license_plate": True,
                    "is_explicit": False,
                    "is_offensive_symbol": True,
                    "quality_ok": True,
                    "confidence": 0.9,
                }
            )
        )
        assert not result.ok
        assert result.reason == "offensive_text"

    def test_rejects_low_quality(self):
        result = _interpret_moderation_json(
            json.dumps(
                {
                    "is_license_plate": True,
                    "is_explicit": False,
                    "is_offensive_symbol": False,
                    "quality_ok": False,
                    "confidence": 0.9,
                }
            )
        )
        assert not result.ok
        assert result.reason == "low_quality"

    def test_missing_is_license_plate_defaults_to_reject(self):
        result = _interpret_moderation_json(
            json.dumps(
                {
                    "is_explicit": False,
                    "is_offensive_symbol": False,
                    "quality_ok": True,
                }
            )
        )
        assert not result.ok
        assert result.reason == "not_a_plate"

    def test_strips_code_fences(self):
        wrapped = '```json\n{"is_license_plate": true, "is_explicit": false, ' \
                  '"is_offensive_symbol": false, "quality_ok": true}\n```'
        result = _interpret_moderation_json(wrapped)
        assert result.ok

    def test_malformed_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            _interpret_moderation_json("not json")


class TestSafetyRatings:
    def test_no_ratings_returns_none(self):
        assert _check_safety_ratings({"safetyRatings": []}) is None

    def test_high_sexual_content_rejects(self):
        result = _check_safety_ratings(
            {
                "safetyRatings": [
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "probability": "HIGH"}
                ]
            }
        )
        assert result is not None
        assert result.reason == "explicit"

    def test_medium_hate_speech_rejects(self):
        result = _check_safety_ratings(
            {
                "safetyRatings": [
                    {"category": "HARM_CATEGORY_HATE_SPEECH", "probability": "MEDIUM"}
                ]
            }
        )
        assert result is not None
        assert result.reason == "offensive_text"

    def test_low_probability_passes(self):
        result = _check_safety_ratings(
            {
                "safetyRatings": [
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "probability": "LOW"}
                ]
            }
        )
        assert result is None


@pytest.fixture
def gemini_key(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", SecretStr("test-key"))
    monkeypatch.setattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")


class TestCheckImageGemini:
    async def test_missing_key_raises_upstream(self, monkeypatch):
        monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
        with pytest.raises(UpstreamError):
            await check_image_gemini(_png_bytes(), "ABC123")

    async def test_empty_key_raises_upstream(self, monkeypatch):
        monkeypatch.setattr(settings, "GEMINI_API_KEY", SecretStr(""))
        with pytest.raises(UpstreamError):
            await check_image_gemini(_png_bytes(), "ABC123")

    @respx.mock
    async def test_approves_valid_plate(self, gemini_key):
        respx.post(
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
        result = await check_image_gemini(_png_bytes(), "ABC123")
        assert result.ok

    @respx.mock
    async def test_rejects_non_plate(self, gemini_key):
        respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(
            return_value=httpx.Response(
                200,
                json=_gemini_reply(
                    {
                        "is_license_plate": False,
                        "is_explicit": False,
                        "is_offensive_symbol": False,
                        "quality_ok": True,
                        "confidence": 0.8,
                    }
                ),
            )
        )
        result = await check_image_gemini(_png_bytes(), "ABC123")
        assert not result.ok
        assert result.reason == "not_a_plate"

    @respx.mock
    async def test_rejects_explicit(self, gemini_key):
        respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(
            return_value=httpx.Response(
                200,
                json=_gemini_reply(
                    {
                        "is_license_plate": True,
                        "is_explicit": True,
                        "is_offensive_symbol": False,
                        "quality_ok": True,
                        "confidence": 0.9,
                    }
                ),
            )
        )
        result = await check_image_gemini(_png_bytes(), "ABC123")
        assert not result.ok
        assert result.reason == "explicit"

    @respx.mock
    async def test_block_reason_in_prompt_feedback(self, gemini_key):
        respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(
            return_value=httpx.Response(
                200,
                json={"promptFeedback": {"blockReason": "SAFETY"}, "candidates": []},
            )
        )
        result = await check_image_gemini(_png_bytes(), "ABC123")
        assert not result.ok
        assert result.reason == "explicit"

    @respx.mock
    async def test_safety_rating_rejects_before_parsing(self, gemini_key):
        respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(
            return_value=httpx.Response(
                200,
                json={
                    "candidates": [
                        {
                            "content": {"parts": [{"text": "{}"}]},
                            "finishReason": "STOP",
                            "safetyRatings": [
                                {
                                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                                    "probability": "HIGH",
                                }
                            ],
                        }
                    ]
                },
            )
        )
        result = await check_image_gemini(_png_bytes(), "ABC123")
        assert not result.ok
        assert result.reason == "explicit"

    @respx.mock
    async def test_http_error_raises_upstream(self, gemini_key, monkeypatch):
        monkeypatch.setattr(image_check, "_RETRY_BACKOFF_SECONDS", 0)
        respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(return_value=httpx.Response(500, json={"error": "down"}))
        with pytest.raises(UpstreamError):
            await check_image_gemini(_png_bytes(), "ABC123")

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

    @respx.mock
    async def test_empty_candidates_raises_upstream(self, gemini_key):
        respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(return_value=httpx.Response(200, json={"candidates": []}))
        with pytest.raises(UpstreamError):
            await check_image_gemini(_png_bytes(), "ABC123")

    @respx.mock
    async def test_malformed_json_raises_upstream(self, gemini_key):
        respx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        ).mock(
            return_value=httpx.Response(
                200,
                json={
                    "candidates": [
                        {
                            "content": {"parts": [{"text": "totally not json"}]},
                            "finishReason": "STOP",
                        }
                    ]
                },
            )
        )
        with pytest.raises(UpstreamError):
            await check_image_gemini(_png_bytes(), "ABC123")


class TestCheckImageDispatch:
    async def test_rule_based_short_circuits_on_corrupted(self, monkeypatch):
        monkeypatch.setattr(settings, "MODERATION_PROVIDER", "gemini")
        result = await check_image(b"not an image", "ABC")
        assert not result.ok
        assert result.reason == "low_quality"

    async def test_rule_based_provider_skips_ai(self, monkeypatch):
        monkeypatch.setattr(settings, "MODERATION_PROVIDER", "rule_based")
        result = await check_image(_png_bytes(), "ABC")
        assert result.ok
