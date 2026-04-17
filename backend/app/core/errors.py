from __future__ import annotations

import logging
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}
        self.headers = headers or {}
        super().__init__(message)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(401, "unauthorized", message)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(403, "forbidden", message)


class NotFoundError(AppError):
    def __init__(self, message: str = "Not found"):
        super().__init__(404, "not_found", message)


class ValidationError(AppError):
    def __init__(self, message: str = "Validation error", details: dict[str, Any] | None = None):
        super().__init__(422, "validation_error", message, details)


class ModerationRejectedError(AppError):
    def __init__(self, reason: str, explanation: str):
        super().__init__(
            422,
            "moderation_rejected",
            "Upload rejected by moderation",
            {"reason": reason, "explanation": explanation},
        )


class RateLimitedError(AppError):
    def __init__(self, retry_after: int, message: str = "Rate limit exceeded"):
        super().__init__(
            429, "rate_limited", message, headers={"Retry-After": str(retry_after)}
        )


class ConflictError(AppError):
    def __init__(self, message: str = "Conflict"):
        super().__init__(409, "conflict", message)


class UpstreamError(AppError):
    def __init__(self, message: str = "Upstream service error"):
        super().__init__(502, "upstream_error", message)


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
        headers=exc.headers,
    )


async def unhandled_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "An unexpected error occurred",
                "details": {},
            }
        },
    )
