import base64
import io
from datetime import datetime, timezone

import qrcode
import qrcode.image.svg
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.common.application import application
from backend.common.clients import get_event, get_user
from backend.common.db import get_session
from backend.common.models import Booking, Inventory, uid, utcnow
from backend.common.security import current_claims, require_roles, sign_ticket, verify_ticket

app = application("MNNIT Ticketing Service")


class BookRequest(BaseModel):
    event_id: str = Field(min_length=1, max_length=36)


class ScanRequest(BookRequest):
    qr_payload: str = Field(min_length=1, max_length=2000)


def as_date(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def ticket_dict(ticket: Booking):
    result = {key: getattr(ticket, key) for key in ("id", "event_id", "event_title", "venue", "status")}
    result["starts_at"] = as_date(ticket.starts_at).isoformat()
    result["checked_in_at"] = as_date(ticket.checked_in_at).isoformat() if ticket.checked_in_at else None
    if ticket.status == "active":
        payload = sign_ticket(ticket.id, ticket.event_id, ticket.ticket_nonce)
        svg = qrcode.make(payload, image_factory=qrcode.image.svg.SvgPathImage, border=4)
        buffer = io.BytesIO()
        svg.save(buffer)
        result["qr_payload"] = payload
        result["qr_data_url"] = "data:image/svg+xml;base64," + base64.b64encode(buffer.getvalue()).decode()
    else:
        result["qr_payload"] = None
        result["qr_data_url"] = None
    return result


def check_eligibility(event: dict, user: dict):
    for field, label in (("department", "department"), ("program", "program"), ("batch", "admission batch")):
        allowed = event.get(f"{field}_rules", [])
        actual = str(user.get(field, "")).strip().upper()
        if allowed and actual not in {str(item).strip().upper() for item in allowed}:
            raise HTTPException(403, f"Your {label} does not meet this event's eligibility rules. Check your profile")


@app.post("/tickets/book", status_code=201)
async def book(body: BookRequest, claims: dict = Depends(current_claims), db: Session = Depends(get_session)):
    event = await get_event(body.event_id)
    user = await get_user(claims["sub"])
    if as_date(event["registration_deadline"]) <= utcnow() or as_date(event["starts_at"]) <= utcnow():
        raise HTTPException(409, "Registration for this event has closed")
    check_eligibility(event, user)
    try:
        # Capacity and booking status change in one database transaction. The
        # conditional UPDATE serializes competing requests for the final seat.
        insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else pg_insert
        db.execute(insert(Inventory).values(event_id=body.event_id, capacity=event["capacity"], booked=0).on_conflict_do_nothing(index_elements=["event_id"]))
        ticket = db.scalar(select(Booking).where(Booking.event_id == body.event_id, Booking.user_id == claims["sub"]).with_for_update())
        if ticket and ticket.status == "active":
            raise HTTPException(409, "You already have a ticket for this event")
        reserved = db.execute(update(Inventory).where(Inventory.event_id == body.event_id, Inventory.booked < Inventory.capacity).values(booked=Inventory.booked + 1))
        if reserved.rowcount != 1:
            raise HTTPException(409, "This event is full")
        if ticket is None:
            ticket = Booking(event_id=body.event_id, user_id=claims["sub"], attendee_name=user["name"], event_title=event["title"], venue=event["venue"], starts_at=as_date(event["starts_at"]))
            db.add(ticket)
        else:
            ticket.status = "active"
            ticket.ticket_nonce = uid()
            ticket.checked_in_at = None
            ticket.checked_in_by = None
            ticket.attendee_name = user["name"]
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "You already have a ticket for this event")
    except HTTPException:
        db.rollback()
        raise
    db.refresh(ticket)
    return ticket_dict(ticket)


@app.get("/tickets/me")
def my_tickets(claims: dict = Depends(current_claims), db: Session = Depends(get_session)):
    tickets = db.scalars(select(Booking).where(Booking.user_id == claims["sub"]).order_by(Booking.created_at.desc())).all()
    return {"items": [ticket_dict(ticket) for ticket in tickets]}


@app.post("/tickets/{ticket_id}/cancel")
def cancel(ticket_id: str, claims: dict = Depends(current_claims), db: Session = Depends(get_session)):
    ticket = db.scalar(select(Booking).where(Booking.id == ticket_id, Booking.user_id == claims["sub"]).with_for_update())
    if ticket is None:
        raise HTTPException(404, "Ticket not found")
    if ticket.checked_in_at:
        raise HTTPException(409, "A checked-in ticket cannot be cancelled")
    if ticket.status == "cancelled":
        return ticket_dict(ticket)
    if as_date(ticket.starts_at) <= utcnow():
        raise HTTPException(409, "Cancellation has closed because the event has started")
    changed = db.execute(update(Booking).where(Booking.id == ticket_id, Booking.status == "active", Booking.checked_in_at.is_(None)).values(status="cancelled"))
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Ticket status changed. Refresh and try again")
    db.execute(update(Inventory).where(Inventory.event_id == ticket.event_id, Inventory.booked > 0).values(booked=Inventory.booked - 1))
    db.commit()
    db.refresh(ticket)
    return ticket_dict(ticket)


@app.get("/tickets/events/{event_id}/stats")
async def event_stats(event_id: str, claims: dict = Depends(current_claims), db: Session = Depends(get_session)):
    event = await get_event(event_id)
    active = (Booking.event_id == event_id, Booking.status == "active")
    registrations = db.scalar(select(func.count()).select_from(Booking).where(*active)) or 0
    check_ins = db.scalar(select(func.count()).select_from(Booking).where(*active, Booking.checked_in_at.is_not(None))) or 0
    return {"registrations": registrations, "check_ins": check_ins, "capacity": event["capacity"], "remaining": event["capacity"] - registrations, "attendance_percentage": round(check_ins / registrations * 100, 1) if registrations else 0}


@app.post("/tickets/check-in")
async def check_in(body: ScanRequest, claims: dict = Depends(current_claims), db: Session = Depends(get_session)):
    require_roles(claims, "gate_staff", "organizer", "admin")
    data = verify_ticket(body.qr_payload)
    if data["event_id"] != body.event_id:
        raise HTTPException(400, "This ticket belongs to a different event")
    event = await get_event(body.event_id)
    if claims["role"] == "organizer" and event["organizer_id"] != claims["sub"]:
        raise HTTPException(403, "Organizers can check in only their own events")
    if as_date(event["ends_at"]) <= utcnow():
        raise HTTPException(409, "This event has ended")
    ticket = db.scalar(select(Booking).where(Booking.id == data["ticket_id"], Booking.event_id == body.event_id).with_for_update())
    if ticket is None or ticket.ticket_nonce != data["nonce"]:
        raise HTTPException(400, "This QR ticket is no longer valid")
    if ticket.status != "active":
        raise HTTPException(409, "This ticket was cancelled")
    if ticket.checked_in_at:
        raise HTTPException(409, "This ticket has already been checked in")
    now = utcnow()
    changed = db.execute(update(Booking).where(Booking.id == ticket.id, Booking.status == "active", Booking.ticket_nonce == data["nonce"], Booking.checked_in_at.is_(None)).values(checked_in_at=now, checked_in_by=claims["sub"]))
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "This ticket has already been checked in or cancelled")
    db.commit()
    return {"message": "Check-in successful", "ticket_id": ticket.id, "attendee_name": ticket.attendee_name, "checked_in_at": now.isoformat()}
