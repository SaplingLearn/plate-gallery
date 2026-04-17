from __future__ import annotations

import logging
from uuid import UUID

from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings
from app.core.errors import UnauthorizedError

logger = logging.getLogger(__name__)


class SupabaseClaims(BaseModel):
    sub: UUID
    email: str | None = None
    aud: str = ""
    exp: int = 0
    user_metadata: dict = {}
    app_metadata: dict = {}


async def verify_jwt(token: str) -> SupabaseClaims:
    secret = settings.SUPABASE_JWT_SECRET.get_secret_value()
    if not secret:
        raise UnauthorizedError("JWT verification not configured")
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_exp": True},
        )
    except JWTError as e:
        logger.warning("JWT verification failed: %s", e)
        raise UnauthorizedError("Invalid or expired token")
    return SupabaseClaims(**payload)
