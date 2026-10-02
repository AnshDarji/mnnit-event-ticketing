from datetime import datetime, timezone
from typing import Literal

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.common.application import application
from backend.common.clients import get_user
from backend.common.db import get_session
from backend.common.models import Event, utcnow
from backend.common.security import current_claims, internal_access, require_roles

app = application("MNNIT Event Service")


class EventCreate(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=10, max_length=10000)
    venue: str = Field(min_length=2, max_length=160)
    capacity: int = Field(ge=1, le=10000)
    starts_at: datetime
    ends_at: datetime
    registration_deadline: datetime
    classification: Literal["Institute-level", "Departmental", "Club / Society", "Open / Cross-department", "Restricted"]
    department_rules: list[str] = Field(default_factory=list, max_length=50)
    program_rules: list[str] = Field(default_factory=list, max_length=50)
    batch_rules: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("title", "description", "venue")
    @classmethod
    def clean_text(cls, value):
        return value.strip()

    @field_validator("starts_at", "ends_at", "registration_deadline")
    @classmethod
    def aware(cls, value):
        if value.tzinfo is None:
            raise ValueError("Include a timezone in event dates")
        return value.astimezone(timezone.utc)

    @field_validator("department_rules", "program_rules", "batch_rules")
    @classmethod
    def clean_rules(cls, values):
        result = sorted(set(v.strip().upper() for v in values if v.strip()))
        if any(len(v) > 40 for v in result):
            raise ValueError("Eligibility values must be 40 characters or shorter")
        return result

    @model_validator(mode="after")
    def valid_dates(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("The end must be after the start")
        if self.registration_deadline > self.starts_at:
            raise ValueError("Registration must close by the event start")
        if self.registration_deadline <= utcnow():
            raise ValueError("Registration deadline must be in the future")
        if len(self.title) < 3 or len(self.venue) < 2 or len(self.description) < 10:
            raise ValueError("Complete the title, description, and venue")
        if any(len(v) != 4 or not v.isdigit() or not v.startswith("20") for v in self.batch_rules):
            raise ValueError("Batch must be a four-digit admission year")
        return self


def event_dict(event: Event):
    result = {key: getattr(event, key) for key in ("id", "title", "description", "venue", "capacity", "classification", "department_rules", "program_rules", "batch_rules", "organizer_id", "organizer_name", "is_synthetic")}
    for key in ("starts_at", "ends_at", "registration_deadline", "created_at"):
        date = getattr(event, key)
        result[key] = date.replace(tzinfo=timezone.utc).isoformat() if date.tzinfo is None else date.isoformat()
    return result


@app.get("/events")
def list_events(q: str = Query(default="", max_length=100), classification: str | None = None, db: Session = Depends(get_session)):
    query = select(Event).order_by(Event.starts_at.asc())
    if q.strip():
        query = query.where(or_(Event.title.ilike(f"%{q.strip()}%"), Event.description.ilike(f"%{q.strip()}%")))
    if classification:
        query = query.where(Event.classification == classification)
    return {"items": [event_dict(event) for event in db.scalars(query.limit(200)).all()]}


@app.post("/events", status_code=201)
async def create_event(body: EventCreate, claims: dict = Depends(current_claims), db: Session = Depends(get_session)):
    require_roles(claims, "organizer", "admin")
    organizer = await get_user(claims["sub"])
    event = Event(**body.model_dump(), organizer_id=claims["sub"], organizer_name=organizer["name"], is_synthetic=True)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event_dict(event)


def lookup_event(db, event_id):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(404, "Event not found")
    return event


@app.get("/events/{event_id}")
def event_detail(event_id: str, db: Session = Depends(get_session)):
    return event_dict(lookup_event(db, event_id))


@app.get("/internal/events/{event_id}", dependencies=[Depends(internal_access)])
def internal_event(event_id: str, db: Session = Depends(get_session)):
    return event_dict(lookup_event(db, event_id))
