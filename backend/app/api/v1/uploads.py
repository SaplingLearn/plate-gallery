from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_client_ip, get_current_user
from app.core.config import settings
from app.core.errors import ValidationError
from app.db.models import UploadToken, User
from app.db.session import get_db
from app.services.rate_limit import check_and_record
from app.services.storage import storage_service

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


class UploadSignRequest:
    def __init__(self, content_type: str, file_size_bytes: int, client_hash: str = ""):
        self.content_type = content_type
        self.file_size_bytes = file_size_bytes
        self.client_hash = client_hash


@router.post("/sign")
async def sign_upload(
    body: dict,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    content_type = body.get("content_type", "")
    file_size_bytes = body.get("file_size_bytes", 0)

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(
            f"Unsupported file type: {content_type}",
            {"allowed": list(ALLOWED_CONTENT_TYPES)},
        )
    if file_size_bytes < settings.UPLOAD_MIN_BYTES:
        raise ValidationError("File too small")
    if file_size_bytes > settings.UPLOAD_MAX_BYTES:
        max_mb = settings.UPLOAD_MAX_BYTES // (1024 * 1024)
        raise ValidationError(f"File too large. Maximum {max_mb} MB.")

    # Rate limit
    ip = get_client_ip(request)
    await check_and_record(
        db,
        bucket="upload",
        user_id=user.id,
        ip=ip,
        limits=[
            (settings.RATE_LIMIT_UPLOADS_PER_HOUR, timedelta(hours=1)),
            (settings.RATE_LIMIT_UPLOADS_PER_DAY, timedelta(days=1)),
        ],
    )

    # Generate plate ID and object path
    plate_id = uuid.uuid4()
    now = datetime.now(UTC)
    ext = content_type.split("/")[-1]
    if ext == "jpeg":
        ext = "jpg"
    object_path = f"plates/{now.year}/{now.month:02d}/{plate_id}.{ext}"

    # Generate upload token
    upload_token = secrets.token_urlsafe(32)
    expires_at = now + timedelta(minutes=10)

    token_record = UploadToken(
        token=upload_token,
        user_id=user.id,
        object_path=object_path,
        content_type=content_type,
        size_bytes=file_size_bytes,
        expires_at=expires_at,
    )
    db.add(token_record)

    # Get signed upload URL from Supabase
    try:
        signed_url = await storage_service.create_signed_upload_url(object_path)
    except Exception:
        raise ValidationError("Failed to create upload URL. Please try again.")

    await db.commit()

    return {
        "upload_token": upload_token,
        "signed_url": signed_url,
        "object_path": object_path,
        "expires_at": expires_at.isoformat(),
    }


@router.post("/ocr-hint")
async def ocr_hint(
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Optional OCR guess for plate text. Non-fatal."""
    # This is a nice-to-have feature. For v1, return a null guess.
    return {"plate_text_guess": None, "confidence": 0.0}
