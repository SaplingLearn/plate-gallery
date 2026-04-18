from __future__ import annotations

import base64
import logging
from uuid import UUID

import httpx
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ec import (
    EllipticCurvePublicNumbers,
    SECP256R1,
    SECP384R1,
    SECP521R1,
)
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings
from app.core.errors import UnauthorizedError

logger = logging.getLogger(__name__)

_jwks_cache: dict | None = None

_EC_CURVES = {"P-256": SECP256R1, "P-384": SECP384R1, "P-521": SECP521R1}


class SupabaseClaims(BaseModel):
    sub: UUID
    email: str | None = None
    aud: str = ""
    exp: int = 0
    user_metadata: dict = {}
    app_metadata: dict = {}


def _b64url_to_int(b64: str) -> int:
    b64 += "=" * (-len(b64) % 4)
    return int.from_bytes(base64.urlsafe_b64decode(b64), "big")


def _ec_jwk_to_pem(jwk_key: dict) -> str:
    crv = jwk_key.get("crv", "P-256")
    curve = _EC_CURVES.get(crv, SECP256R1)()
    pub = EllipticCurvePublicNumbers(_b64url_to_int(jwk_key["x"]), _b64url_to_int(jwk_key["y"]), curve)
    return pub.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()


async def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
    _jwks_cache = resp.json()
    return _jwks_cache


async def verify_jwt(token: str) -> SupabaseClaims:
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as e:
        logger.warning("JWT header decode failed: %s", e)
        raise UnauthorizedError("Invalid token")

    alg = header.get("alg", "")
    kid = header.get("kid")

    if alg == "HS256":
        secret = settings.SUPABASE_JWT_SECRET.get_secret_value()
        if not secret:
            raise UnauthorizedError("JWT verification not configured")
        key: str = secret
    elif alg in ("ES256", "RS256"):
        global _jwks_cache
        try:
            jwks = await _get_jwks()
        except Exception as e:
            logger.error("Failed to fetch JWKS: %s", e)
            raise UnauthorizedError("Could not verify token")

        keys = jwks.get("keys", [])
        jwk = next((k for k in keys if k.get("kid") == kid), None)
        if jwk is None:
            _jwks_cache = None
            try:
                jwks = await _get_jwks()
                jwk = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
            except Exception:
                pass
        if jwk is None:
            logger.warning("JWT kid %s not found in JWKS", kid)
            raise UnauthorizedError("Unknown signing key")
        key = _ec_jwk_to_pem(jwk)
    else:
        logger.warning("Unsupported JWT algorithm: %s", alg)
        raise UnauthorizedError("Unsupported token algorithm")

    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=[alg],
            audience="authenticated",
            options={"verify_exp": True},
        )
    except JWTError as e:
        logger.warning("JWT verification failed: %s", e)
        raise UnauthorizedError("Invalid or expired token")

    return SupabaseClaims(**payload)
