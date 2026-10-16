from contextlib import asynccontextmanager
import hmac

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import settings
from .db import get_engine

# # Creates a FastAPI application with configurable database connectivity and startup validation.
# Restricts public API access in production using a gateway secret, while allowing health checks and internal routes.
# Provides a health endpoint to verify that the service and database are running.

def application(title: str, database: bool = True):
    @asynccontextmanager
    async def lifespan(app):
        settings.validate()
        yield

    app = FastAPI(title=title, version="1.0.0", lifespan=lifespan)

    if database:
        @app.middleware("http")
        async def gateway_only(request, call_next):
            # Render free services have public URLs. Keep their public API
            # behind the gateway's rate limit; internal routes have their own key.
            if settings.environment == "production" and request.url.path != "/health" and not request.url.path.startswith("/internal/"):
                if not hmac.compare_digest(request.headers.get("X-Gateway-Secret", ""), settings.internal_secret):
                    return JSONResponse({"detail": "Use the API gateway"}, status_code=403)
            return await call_next(request)

    @app.get("/health")
    def health():
        if database:
            with get_engine().connect() as connection:
                connection.execute(text("SELECT 1"))
        return {"status": "ok", "service": title}

    return app
