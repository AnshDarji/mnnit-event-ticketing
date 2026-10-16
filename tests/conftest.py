"""Service integration fixtures with actual HTTP routes and isolated SQL schemas.

Run against SQLite by default. Set TEST_POSTGRES_URL to a PostgreSQL database
to include the simultaneous final-seat test. Each test creates randomly named
schemas, so it never drops the application's auth/events/ticketing schemas.
"""

import os
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import CreateSchema, DropSchema

from backend.auth import main as auth
from backend.common.config import settings
from backend.common.db import get_session, normalize_url
from backend.common.models import Base, utcnow
from backend.events import main as events
from backend.ticketing import main as ticketing


@pytest.fixture
def engine():
    postgres_url = os.getenv("TEST_POSTGRES_URL")
    if postgres_url:
        raw = create_engine(normalize_url(postgres_url), pool_pre_ping=True)
        if raw.dialect.name != "postgresql":
            raise ValueError("TEST_POSTGRES_URL must point to PostgreSQL")
        suffix = uuid4().hex[:12]
        schemas = {name: f"pytest_{name}_{suffix}" for name in ("auth", "events", "ticketing")}
        with raw.begin() as connection:
            for schema in schemas.values():
                connection.execute(CreateSchema(schema))
        database = raw.execution_options(schema_translate_map=schemas)
    else:
        raw = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        database = raw.execution_options(schema_translate_map={"auth": None, "events": None, "ticketing": None})
        schemas = None
    Base.metadata.create_all(database)
    try:
        yield database
    finally:
        if schemas:
            with raw.begin() as connection:
                for schema in schemas.values():
                    connection.execute(DropSchema(schema, cascade=True))
        raw.dispose()


@pytest.fixture
def api(engine, monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "demo_auth_enabled", False)
    monkeypatch.setattr(settings, "pilot_role_selection", True)
    monkeypatch.setattr(settings, "google_client_id", "pytest.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "jwt_secret", "test-jwt-secret-unique-01234567890123456789")
    monkeypatch.setattr(settings, "qr_secret", "test-qr-secret-unique-01234567890123456789")
    monkeypatch.setattr(settings, "internal_secret", "test-internal-secret-unique-01234567890123456789")

    def session_override():
        with Session(engine) as session:
            yield session

    for service in (auth, events, ticketing):
        service.app.dependency_overrides[get_session] = session_override

    def google_identity(credential):
        return {"sub": credential, "email": f"{credential}@mnnit.ac.in", "email_verified": True, "hd": "mnnit.ac.in", "name": "Test Student"}

    monkeypatch.setattr(auth, "verify_google_credential", google_identity)

    try:
        with TestClient(auth.app) as auth_client, TestClient(events.app) as event_client, TestClient(ticketing.app) as ticket_client:
            async def get_user(user_id):
                response = auth_client.get(f"/internal/users/{user_id}", headers={"X-Internal-Secret": settings.internal_secret})
                if response.status_code != 200:
                    raise HTTPException(response.status_code, response.json()["detail"])
                return response.json()

            async def get_event(event_id):
                response = event_client.get(f"/internal/events/{event_id}", headers={"X-Internal-Secret": settings.internal_secret})
                if response.status_code != 200:
                    raise HTTPException(response.status_code, response.json()["detail"])
                return response.json()

            monkeypatch.setattr(events, "get_user", get_user)
            monkeypatch.setattr(ticketing, "get_user", get_user)
            monkeypatch.setattr(ticketing, "get_event", get_event)
            yield SimpleNamespace(auth=auth_client, events=event_client, tickets=ticket_client)
    finally:
        for service in (auth, events, ticketing):
            service.app.dependency_overrides.clear()


@pytest.fixture
def actor(api):
    def create(role="attendee", department="CSED", program="B.TECH", batch="2024"):
        signed_in = api.auth.post("/auth/google", json={"credential": f"student-{uuid4().hex}"})
        assert signed_in.status_code == 200, signed_in.text
        session = signed_in.json()
        headers = {"Authorization": f"Bearer {session['access_token']}"}
        updated = api.auth.put("/auth/me", json={"role": role, "department": department, "program": program, "batch": batch}, headers=headers)
        assert updated.status_code == 200, updated.text
        session = updated.json()
        return SimpleNamespace(user=session["user"], token=session["access_token"], headers={"Authorization": f"Bearer {session['access_token']}"})
    return create


@pytest.fixture
def event_payload():
    now = utcnow()
    return {"title": "Synthetic campus workshop", "description": "A synthetic workshop for testing the coursework pilot.", "venue": "Seminar Hall A", "capacity": 3, "starts_at": (now + timedelta(days=2)).isoformat(), "ends_at": (now + timedelta(days=2, hours=2)).isoformat(), "registration_deadline": (now + timedelta(days=1)).isoformat(), "classification": "Institute-level", "department_rules": [], "program_rules": [], "batch_rules": []}


@pytest.fixture
def create_event(api, actor, event_payload):
    def create(organizer=None, **changes):
        organizer = organizer or actor("organizer")
        response = api.events.post("/events", json={**event_payload, **changes}, headers=organizer.headers)
        assert response.status_code == 201, response.text
        return response.json()
    return create



