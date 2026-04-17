from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self) -> None:
        self._base = settings.SUPABASE_URL
        self._bucket = settings.SUPABASE_STORAGE_BUCKET
        self._service_key = settings.SUPABASE_SERVICE_ROLE_KEY.get_secret_value()

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_key,
            "Authorization": f"Bearer {self._service_key}",
        }

    async def create_signed_upload_url(self, object_path: str) -> str:
        url = f"{self._base}/storage/v1/object/upload/sign/{self._bucket}/{object_path}"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()
        signed_url = data.get("url", "")
        if signed_url.startswith("/"):
            signed_url = f"{self._base}/storage/v1{signed_url}"
        return signed_url

    async def download_object(self, object_path: str) -> bytes:
        url = f"{self._base}/storage/v1/object/{self._bucket}/{object_path}"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
        return resp.content

    def public_url(self, object_path: str) -> str:
        return f"{self._base}/storage/v1/object/public/{self._bucket}/{object_path}"

    def transform_url(
        self, object_path: str, *, width: int, quality: int = 75, format: str = "webp"
    ) -> str:
        return (
            f"{self._base}/storage/v1/render/image/public/{self._bucket}/{object_path}"
            f"?width={width}&quality={quality}&format={format}"
        )

    async def delete_object(self, object_path: str) -> None:
        url = f"{self._base}/storage/v1/object/{self._bucket}"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.delete(
                url, headers=self._headers(), json={"prefixes": [object_path]}
            )
            if resp.status_code not in (200, 204, 404):
                logger.warning("Failed to delete storage object %s: %s", object_path, resp.text)


storage_service = StorageService()
