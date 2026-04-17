from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENV: Literal["dev", "prod"] = "dev"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/plategallery"
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: SecretStr = SecretStr("")
    SUPABASE_JWT_SECRET: SecretStr = SecretStr("")
    SUPABASE_STORAGE_BUCKET: str = "plates"
    OPENAI_API_KEY: SecretStr | None = None
    GEMINI_API_KEY: SecretStr | None = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    MODERATION_PROVIDER: Literal["openai", "gemini", "rule_based"] = "gemini"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    CORS_ORIGIN_REGEX: str | None = None
    UPLOAD_MAX_BYTES: int = 10 * 1024 * 1024
    UPLOAD_MIN_BYTES: int = 1024
    RATE_LIMIT_UPLOADS_PER_DAY: int = 20
    RATE_LIMIT_UPLOADS_PER_HOUR: int = 5
    RATE_LIMIT_UPLOADS_PER_HOUR_IP: int = 10
    RATE_LIMIT_VOTES_PER_MINUTE: int = 60
    RATE_LIMIT_COMMENTS_PER_MINUTE: int = 10
    RATE_LIMIT_COMMENTS_PER_DAY: int = 100


settings = Settings()
