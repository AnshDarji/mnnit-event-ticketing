import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).lower() == "true"


@dataclass
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./pilot.db")
    jwt_secret: str = os.getenv("JWT_SECRET", "local-development-jwt-change-before-deploy")
    qr_secret: str = os.getenv("QR_SECRET", "local-development-qr-change-before-deploy")
    internal_secret: str = os.getenv("INTERNAL_SECRET", "local-development-internal-change-before-deploy")
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    environment: str = os.getenv("ENVIRONMENT", "development")
    demo_auth_enabled: bool = flag("DEMO_AUTH_ENABLED")
    pilot_role_selection: bool = flag("PILOT_ROLE_SELECTION", "true")
    auth_service_url: str = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")
    event_service_url: str = os.getenv("EVENT_SERVICE_URL", "http://localhost:8002")
    ticketing_service_url: str = os.getenv("TICKETING_SERVICE_URL", "http://localhost:8003")

    def validate(self) -> None:
        if self.environment == "production":
            for name in ("jwt_secret", "qr_secret", "internal_secret"):
                value = getattr(self, name)
                if len(value) < 32 or value.startswith(("local-development", "replace-with")):
                    raise RuntimeError(f"Set a unique {name.upper()} of at least 32 characters")
            if len({self.jwt_secret, self.qr_secret, self.internal_secret}) != 3:
                raise RuntimeError("JWT_SECRET, QR_SECRET, and INTERNAL_SECRET must be different")
            if self.demo_auth_enabled:
                raise RuntimeError("DEMO_AUTH_ENABLED must be false in production")
            if not self.google_client_id:
                raise RuntimeError("GOOGLE_CLIENT_ID is required in production")


settings = Settings()
