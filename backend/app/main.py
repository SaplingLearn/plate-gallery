from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import AppError, app_error_handler, unhandled_error_handler
from app.core.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.session import engine
    from app.db.models import Base
    from app.services.storage import storage_service
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await storage_service.ensure_bucket_public()
    yield


def create_app() -> FastAPI:
    setup_logging()

    app = FastAPI(
        lifespan=lifespan,
        title="PlateGallery API",
        version="1.0.0",
        docs_url="/docs" if settings.ENV == "dev" else None,
        redoc_url="/redoc" if settings.ENV == "dev" else None,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_origin_regex=settings.CORS_ORIGIN_REGEX,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Retry-After"],
        max_age=600,
    )

    # Exception handlers
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)

    # Health check
    @app.get("/healthz")
    async def healthz() -> dict:
        return {"status": "ok", "version": "1.0.0"}

    # Register routers
    from app.api.v1.comments import router as comments_router
    from app.api.v1.favorites import router as favorites_router
    from app.api.v1.leaderboard import router as leaderboard_router
    from app.api.v1.map import router as map_router
    from app.api.v1.me import router as me_router
    from app.api.v1.plates import router as plates_router
    from app.api.v1.states import router as states_router
    from app.api.v1.uploads import router as uploads_router
    from app.api.v1.users import router as users_router
    from app.api.v1.votes import router as votes_router

    app.include_router(users_router, prefix="/api/v1")
    app.include_router(plates_router, prefix="/api/v1")
    app.include_router(uploads_router, prefix="/api/v1")
    app.include_router(votes_router, prefix="/api/v1")
    app.include_router(favorites_router, prefix="/api/v1")
    app.include_router(comments_router, prefix="/api/v1")
    app.include_router(states_router, prefix="/api/v1")
    app.include_router(map_router, prefix="/api/v1")
    app.include_router(leaderboard_router, prefix="/api/v1")
    app.include_router(me_router, prefix="/api/v1")

    return app


app = create_app()
