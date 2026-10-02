from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow():
    return datetime.now(timezone.utc)


def uid():
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    google_sub: Mapped[str] = mapped_column(String(255), unique=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    picture: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="attendee")
    department: Mapped[str] = mapped_column(String(40), default="")
    program: Mapped[str] = mapped_column(String(40), default="")
    batch: Mapped[str] = mapped_column(String(4), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (CheckConstraint("capacity > 0", name="positive_capacity"), {"schema": "events"})
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    venue: Mapped[str] = mapped_column(String(160))
    capacity: Mapped[int] = mapped_column(Integer)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    registration_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    classification: Mapped[str] = mapped_column(String(40))
    department_rules: Mapped[list] = mapped_column(JSON, default=list)
    program_rules: Mapped[list] = mapped_column(JSON, default=list)
    batch_rules: Mapped[list] = mapped_column(JSON, default=list)
    organizer_id: Mapped[str] = mapped_column(String(36))
    organizer_name: Mapped[str] = mapped_column(String(120))
    is_synthetic: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (CheckConstraint("booked >= 0 AND booked <= capacity", name="valid_inventory"), {"schema": "ticketing"})
    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    capacity: Mapped[int] = mapped_column(Integer)
    booked: Mapped[int] = mapped_column(Integer, default=0)


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="one_booking_per_user_event"), {"schema": "ticketing"})
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    event_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    attendee_name: Mapped[str] = mapped_column(String(120))
    event_title: Mapped[str] = mapped_column(String(160))
    venue: Mapped[str] = mapped_column(String(160))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ticket_nonce: Mapped[str] = mapped_column(String(36), default=uid)
    status: Mapped[str] = mapped_column(String(16), default="active")
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checked_in_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
