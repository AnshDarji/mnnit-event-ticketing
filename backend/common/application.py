
from contextlib import asynccontextmanager
import hmac

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import settings
from .db import get_engine


def application(title: str, database: bool = True):
    # Validate application settings during startup and manage the app's lifespan.
    @asynccontextmanager
    async def lifespan(app):
        settings.validate()
        yield

    # Create the FastAPI application with the provided title and lifespan handler.
    app = FastAPI(title=title, version="1.0.0", lifespan=lifespan)

    if database:
        # In production, restrict public API access to requests coming through
        # the API gateway, while allowing health checks and internal routes.
        @app.middleware("http")
        async def gateway_only(request, call_next):
            # Render free services have public URLs, so protect the API
            # using a gateway secret and rely on the gateway for rate limiting.
            if (
                settings.environment == "production"
                and request.url.path != "/health"
                and not request.url.path.startswith("/internal/")
            ):
                # Compare the supplied secret securely to prevent timing attacks.
                if not hmac.compare_digest(
                    request.headers.get("X-Gateway-Secret", ""),
                    settings.internal_secret,
                ):
                    # Reject requests that do not provide the expected secret.
                    return JSONResponse(
                        {"detail": "Use the API gateway"},
                        status_code=403,
                    )

            # Continue processing the request if it passes the checks.
            return await call_next(request)

    # Expose a health endpoint to verify that the service is running
    # and, when enabled, that the database connection works.
    @app.get("/health")
    def health():
        if database:
            # Execute a lightweight query to check database connectivity.
            with get_engine().connect() as connection:
                connection.execute(text("SELECT 1"))

        # Return the service status and its configured title.
        return {"status": "ok", "service": title}

    # Return the configured FastAPI application instance.
    return app
