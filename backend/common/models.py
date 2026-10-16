
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


# Return the current UTC time for timestamp fields.
def utcnow():
    return datetime.now(timezone.utc)


# Generate a unique string ID using UUID4.
def uid():
    return str(uuid4())


# Base class for all SQLAlchemy ORM models.
class Base(DeclarativeBase):
    pass


# Store user authentication and profile information in the auth schema.
class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    # Unique identifier generated automatically for each user.
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)

    # Google account identifier and email must be unique.
    google_sub: Mapped[str] = mapped_column(String(255), unique=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)

    # Basic user profile details.
    name: Mapped[str] = mapped_column(String(120))
    picture: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Role and academic details, with defaults for optional information.
    role: Mapped[str] = mapped_column(String(20), default="attendee")
    department: Mapped[str] = mapped_column(String(40), default="")
    program: Mapped[str] = mapped_column(String(40), default="")
    batch: Mapped[str] = mapped_column(String(4), default="")

    # Record when the user account was created.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# Store event details and eligibility rules in the events schema.
class Event(Base):
    __tablename__ = "events"

    # Ensure event capacity is positive and assign the events schema.
    __table_args__ = (
        CheckConstraint("capacity > 0", name="positive_capacity"),
        {"schema": "events"},
    )

    # Unique event identifier generated automatically.
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)

    # General event information.
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    venue: Mapped[str] = mapped_column(String(160))
    capacity: Mapped[int] = mapped_column(Integer)

    # Event schedule and registration deadline.
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    registration_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # Classification and eligibility restrictions for participants.
    classification: Mapped[str] = mapped_column(String(40))
    department_rules: Mapped[list] = mapped_column(JSON, default=list)
    program_rules: Mapped[list] = mapped_column(JSON, default=list)
    batch_rules: Mapped[list] = mapped_column(JSON, default=list)

    # Store the organizer's ID and name.
    organizer_id: Mapped[str] = mapped_column(String(36))
    organizer_name: Mapped[str] = mapped_column(String(120))

    # Identify synthetic events and record their creation time.
    is_synthetic: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# Track booking capacity and the number of booked tickets per event.
class Inventory(Base):
    __tablename__ = "inventory"

    # Ensure booked tickets never exceed capacity or fall below zero.
    __table_args__ = (
        CheckConstraint(
            "booked >= 0 AND booked <= capacity",
            name="valid_inventory",
        ),
        {"schema": "ticketing"},
    )

    # Each event has one inventory record, identified by its event ID.
    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    capacity: Mapped[int] = mapped_column(Integer)
    booked: Mapped[int] = mapped_column(Integer, default=0)


# Store ticket bookings and attendee check-in information.
class Booking(Base):
    __tablename__ = "bookings"

    # Prevent the same user from booking the same event more than once.
    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="one_booking_per_user_event"),
        {"schema": "ticketing"},
    )

    # Generate a unique ID for each booking.
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)

    # Index event and user IDs to support efficient lookups.
    event_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)

    # Store attendee and event details with the booking.
    attendee_name: Mapped[str] = mapped_column(String(120))
    event_title: Mapped[str] = mapped_column(String(160))
    venue: Mapped[str] = mapped_column(String(160))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # Generate a unique nonce for ticket identification.
    ticket_nonce: Mapped[str] = mapped_column(String(36), default=uid)

    # Track booking status and optional check-in details.
    status: Mapped[str] = mapped_column(String(16), default="active")
    checked_in_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    checked_in_by: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # Record when the booking was created.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
