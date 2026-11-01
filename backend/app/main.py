"""FastAPI app factory. Processing happens in the separate worker (app/worker.py)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import router
from app.config import Settings, get_settings
from app.ingestion.seed import seed_from_file
from app.log_config import configure_logging
from app.storage.db import Database


def create_app(settings: Settings | None = None, db: Database | None = None) -> FastAPI:
    settings = settings or get_settings()
    db = db or Database(settings.DATABASE_URL)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configure_logging()
        db.create_all()
        if settings.SEED_ON_STARTUP:
            seed_from_file(db, settings.SEED_FILE)
        yield

    app = FastAPI(title="Mail Risk Intelligence", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.db = db
    app.include_router(router)
    return app


app = create_app()
