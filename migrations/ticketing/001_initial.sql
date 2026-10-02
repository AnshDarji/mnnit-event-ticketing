CREATE TABLE IF NOT EXISTS ticketing.inventory (
    event_id VARCHAR(36) PRIMARY KEY,
    capacity INTEGER NOT NULL,
    booked INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT valid_inventory CHECK (booked >= 0 AND booked <= capacity)
);
CREATE TABLE IF NOT EXISTS ticketing.bookings (
    id VARCHAR(36) PRIMARY KEY,
    event_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    attendee_name VARCHAR(120) NOT NULL,
    event_title VARCHAR(160) NOT NULL,
    venue VARCHAR(160) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ticket_nonce VARCHAR(36) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    checked_in_at TIMESTAMPTZ,
    checked_in_by VARCHAR(36),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT one_booking_per_user_event UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_bookings_event_id ON ticketing.bookings(event_id);
CREATE INDEX IF NOT EXISTS ix_bookings_user_id ON ticketing.bookings(user_id);
