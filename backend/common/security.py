
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


# Extract bearer tokens from the Authorization header without
# automatically rejecting requests that do not contain one.
bearer = HTTPBearer(auto_error=False)

# Define the roles permitted to access the application.
ROLES = {"attendee", "organizer", "gate_staff", "admin"}


def issue_token(user_id: str, role: str) -> str:
    # Get the current UTC time to set the token's issue and expiry times.
    now = utcnow()

    # Generate a signed JWT containing the user identity, role,
    # issue time, expiration time, issuer, and intended audience.
    return jwt.encode(
        {
            "sub": user_id,
            "role": role,
            "iat": now,
            "exp": now + timedelta(hours=2),
            "iss": "mnnit-pilot",
            "aud": "mnnit-api",
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def current_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    # Reject requests that do not provide bearer credentials.
    if credentials is None:
        raise HTTPException(401, "Sign in to continue")

    try:
        # Verify the JWT signature, expiration, audience, and issuer.
        # Also require the essential identity and timing claims.
        claims = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience="mnnit-api",
            issuer="mnnit-pilot",
            options={"require": ["exp", "sub", "role", "iat"]},
        )

        # Ensure the token contains a role recognized by the application.
        if claims["role"] not in ROLES:
            raise ValueError("Invalid role")

        # Return the verified claims for use by protected endpoints.
        return claims

    except (jwt.PyJWTError, ValueError):
        # Reject invalid, expired, or otherwise unacceptable tokens.
        raise HTTPException(
            401,
            "Your session expired. Please sign in again",
        )


def require_roles(claims: dict, *roles: str):
    # Allow the action only if the user's role matches an allowed role.
    if claims["role"] not in roles:
        raise HTTPException(
            403,
            "Your selected role cannot perform this action",
        )


def internal_access(x_internal_secret: str = Header(default="")):
    # Compare the supplied internal-service secret securely.
    if not hmac.compare_digest(x_internal_secret, settings.internal_secret):
        # Reject requests that do not have the correct internal secret.
        raise HTTPException(403, "Internal service access required")


def sign_ticket(ticket_id: str, event_id: str, nonce: str) -> str:
    # Serialize the ticket details into compact JSON and encode them
    # using URL-safe Base64, removing any trailing padding characters.
    payload = base64.urlsafe_b64encode(
        json.dumps(
            {
                "v": 1,
                "ticket_id": ticket_id,
                "event_id": event_id,
                "nonce": nonce,
            },
            separators=(",", ":"),
        ).encode()
    ).decode().rstrip("=")

    # Generate an HMAC-SHA256 signature using the QR ticket secret.
    signature = hmac.new(
        settings.qr_secret.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()

    # Return the encoded ticket payload and signature separated by a dot.
    return f"{payload}.{signature}"


def verify_ticket(payload: str) -> dict:
    try:
        # Reject oversized ticket strings before processing them.
        if len(payload) > 2000:
            raise ValueError()

        # Split the ticket into its encoded data and signature.
        encoded, signature = payload.split(".")

        # Recalculate the expected signature using the server's secret.
        expected = hmac.new(
            settings.qr_secret.encode(),
            encoded.encode(),
            hashlib.sha256,
        ).hexdigest()

        # Reject tickets whose signatures do not match.
        if not hmac.compare_digest(signature, expected):
            raise ValueError()

        # Restore Base64 padding, decode the payload, and parse its JSON.
        data = json.loads(
            base64.urlsafe_b64decode(
                encoded + "=" * (-len(encoded) % 4)
            )
        )

        # Validate the ticket version and ensure all required identifiers
        # are present as strings.
        if data.get("v") != 1 or not all(
            isinstance(data.get(k), str)
            for k in ("ticket_id", "event_id", "nonce")
        ):
            raise ValueError()

        # Return the validated ticket details.
        return data

    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        # Reject malformed, invalid, or forged QR tickets.
        raise HTTPException(400, "Invalid or forged QR ticket")
