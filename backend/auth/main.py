from typing import Literal

from fastapi import Depends, HTTPException
from google.auth.exceptions import TransportError
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.common.application import application
from backend.common.config import settings
from backend.common.db import get_session
from backend.common.models import User
from backend.common.security import current_claims, internal_access, issue_token

app = application("MNNIT Auth Service")
Role = Literal["attendee", "organizer", "gate_staff", "admin"]


class GoogleLogin(BaseModel):
    credential: str = Field(min_length=1, max_length=10000)


class DemoLogin(BaseModel):
    role: Role = "attendee"


class ProfileUpdate(BaseModel):
    role: Role | None = None
    department: str | None = Field(default=None, max_length=40)
    program: str | None = Field(default=None, max_length=40)
    batch: str | None = Field(default=None, pattern=r"^(20\d{2})?$")

    @field_validator("department", "program", "batch", mode="before")
    @classmethod
    def normalize(cls, value):
        return value.strip().upper() if isinstance(value, str) else value


def user_dict(user: User) -> dict:
    return {key: getattr(user, key) for key in ("id", "email", "name", "picture", "role", "department", "program", "batch")}


def session_response(user: User):
    return {"access_token": issue_token(user.id, user.role), "token_type": "bearer", "expires_in": 7200, "user": user_dict(user)}


def verify_google_credential(credential: str) -> dict:
    if not settings.google_client_id:
        raise HTTPException(503, "Google sign-in is not configured yet")
    try:
        return id_token.verify_oauth2_token(credential, Request(), settings.google_client_id)
    except TransportError:
        raise HTTPException(503, "Google verification is temporarily unavailable")
    except ValueError:
        raise HTTPException(401, "Google sign-in could not be verified")


@app.post("/auth/google")
def google_login(body: GoogleLogin, db: Session = Depends(get_session)):
    identity = verify_google_credential(body.credential)
    email = str(identity.get("email", "")).lower()
    if identity.get("hd") != "mnnit.ac.in" or identity.get("email_verified") is not True or not email.endswith("@mnnit.ac.in"):
        raise HTTPException(403, "Use your MNNIT Google Workspace account (@mnnit.ac.in)")
    if not identity.get("sub"):
        raise HTTPException(401, "Google identity is missing")
    user = db.scalar(select(User).where(User.google_sub == identity["sub"]))
    if user is None:
        user = User(google_sub=identity["sub"], email=email, name=str(identity.get("name", email.split("@")[0]))[:120], picture=identity.get("picture"))
        db.add(user)
    else:
        user.email = email
        user.name = str(identity.get("name", user.name))[:120]
        user.picture = identity.get("picture")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Parallel sign-in requests can both try to create the same user.
        user = db.scalar(select(User).where(User.google_sub == identity["sub"]))
        if user is None:
            raise HTTPException(409, "This email is already linked to a different identity")
    db.refresh(user)
    return session_response(user)




@app.post("/auth/demo")
def demo_login(body: DemoLogin, db: Session = Depends(get_session)):
    if not settings.demo_auth_enabled or settings.environment == "production":
        raise HTTPException(404, "Not found")
    subject = f"local-demo-{body.role}"
    user = db.scalar(select(User).where(User.google_sub == subject))
    if user is None:
        user = User(google_sub=subject, email=f"demo-{body.role}@mnnit.ac.in", name=f"Demo {body.role.replace('_', ' ').title()}", role=body.role, department="CSED", program="B.TECH", batch="2024")
        db.add(user)
    user.role = body.role
    db.commit()
    db.refresh(user)
    return session_response(user)



def lookup_user(db, user_id):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    return user



@app.get("/auth/me")
def me(claims: dict = Depends(current_claims), db: Session = Depends(get_session)):
    return user_dict(lookup_user(db, claims["sub"]))




@app.put("/auth/me")
def update_me(body: ProfileUpdate, claims: dict = Depends(current_claims), db: Session = Depends(get_session)):
    user = lookup_user(db, claims["sub"])
    for key, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        if key == "role" and value != user.role and not settings.pilot_role_selection:
            raise HTTPException(403, "Role selection is disabled. Contact an administrator")
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return session_response(user)



@app.get("/internal/users/{user_id}", dependencies=[Depends(internal_access)])
def internal_user(user_id: str, db: Session = Depends(get_session)):
    return user_dict(lookup_user(db, user_id))
