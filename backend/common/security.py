import base64
import hashlib
import hmac
import json
from datetime import timedelta

import jwt
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .models import utcnow

bearer = HTTPBearer(auto_error=False)
ROLES = {"attendee", "organizer", "gate_staff", "admin"}


def issue_token(user_id: str, role: str) -> str:
    now = utcnow()
    return jwt.encode({"sub": user_id, "role": role, "iat": now, "exp": now + timedelta(hours=2), "iss": "mnnit-pilot", "aud": "mnnit-api"}, settings.jwt_secret, algorithm="HS256")


def current_claims(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if credentials is None:
        raise HTTPException(401, "Sign in to continue")
    try:
        claims = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"], audience="mnnit-api", issuer="mnnit-pilot", options={"require": ["exp", "sub", "role", "iat"]})
        if claims["role"] not in ROLES:
            raise ValueError("Invalid role")
        return claims
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(401, "Your session expired. Please sign in again")


def require_roles(claims: dict, *roles: str):
    if claims["role"] not in roles:
        raise HTTPException(403, "Your selected role cannot perform this action")


def internal_access(x_internal_secret: str = Header(default="")):
    if not hmac.compare_digest(x_internal_secret, settings.internal_secret):
        raise HTTPException(403, "Internal service access required")


def sign_ticket(ticket_id: str, event_id: str, nonce: str) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"v": 1, "ticket_id": ticket_id, "event_id": event_id, "nonce": nonce}, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(settings.qr_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def verify_ticket(payload: str) -> dict:
    try:
        if len(payload) > 2000:
            raise ValueError()
        encoded, signature = payload.split(".")
        expected = hmac.new(settings.qr_secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError()
        data = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if data.get("v") != 1 or not all(isinstance(data.get(k), str) for k in ("ticket_id", "event_id", "nonce")):
            raise ValueError()
        return data
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        raise HTTPException(400, "Invalid or forged QR ticket")
