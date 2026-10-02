CREATE TABLE IF NOT EXISTS events.events (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    venue VARCHAR(160) NOT NULL,
    capacity INTEGER NOT NULL CONSTRAINT positive_capacity CHECK (capacity > 0),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    registration_deadline TIMESTAMPTZ NOT NULL,
    classification VARCHAR(40) NOT NULL,
    department_rules JSON NOT NULL DEFAULT '[]',
    program_rules JSON NOT NULL DEFAULT '[]',
    batch_rules JSON NOT NULL DEFAULT '[]',
    organizer_id VARCHAR(36) NOT NULL,
    organizer_name VARCHAR(120) NOT NULL,
    is_synthetic BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
