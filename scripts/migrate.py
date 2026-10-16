
"""Apply each service's ordered SQL migrations; safe to run on every deployment."""

import argparse
from pathlib import Path

from sqlalchemy import text

from backend.common.db import get_engine
from backend.common.models import Base

SERVICES = ("auth", "events", "ticketing")
ROOT = Path(__file__).resolve().parents[1]


def get_migration_files(service: str):
    migration_dir = ROOT / "migrations" / service
    return sorted(migration_dir.glob("*.sql"))


def get_applied_migrations(connection, service: str):
    query = text(
        f'SELECT version FROM "{service}"._migrations'
    )
    return set(connection.execute(query).scalars())


def apply_migration(connection, service: str, file: Path):
    # Migration files are repository-owned SQL, never user input.
    statements = file.read_text(encoding="utf-8").split(";")

    for statement in statements:
        if statement.strip():
            connection.exec_driver_sql(statement)

    connection.execute(
        text(
            f'INSERT INTO "{service}"._migrations (version) '
            "VALUES (:version)"
        ),
        {"version": file.name},
    )

    print(f"Applied {service}/{file.name}")


def migrate(service: str):
    engine = get_engine()

    if engine.dialect.name == "sqlite":
        tables = [
            table
            for table in Base.metadata.sorted_tables
            if table.schema == service
        ]
        Base.metadata.create_all(engine, tables=tables)
        return

    with engine.begin() as connection:
        # Each service takes its own lock; parallel Render starts are safe.
        connection.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:name))"),
            {"name": f"mnnit-migrate-{service}"},
        )

        connection.execute(
            text(f'CREATE SCHEMA IF NOT EXISTS "{service}"')
        )

        connection.execute(
            text(
                f'CREATE TABLE IF NOT EXISTS "{service}"._migrations '
                "(version TEXT PRIMARY KEY, "
                "applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
            )
        )

        applied = get_applied_migrations(connection, service)

        for file in get_migration_files(service):
            if file.name in applied:
                continue

            apply_migration(connection, service, file)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--service",
        choices=[*SERVICES, "all"],
        default="all",
    )
    args = parser.parse_args()

    selected_services = (
        SERVICES if args.service == "all" else [args.service]
    )

    for service in selected_services:
        migrate(service)

    print("Database migrations are up to date")


if __name__ == "__main__":
    main()
