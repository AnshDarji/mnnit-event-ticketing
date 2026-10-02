"""Apply each service's ordered SQL migrations; safe to run on every deployment."""
import argparse
from pathlib import Path

from sqlalchemy import text

from backend.common.db import get_engine
from backend.common.models import Base

SERVICES = ("auth", "events", "ticketing")
ROOT = Path(__file__).resolve().parents[1]


def migrate(service: str):
    engine = get_engine()
    if engine.dialect.name == "sqlite":
        tables = [table for table in Base.metadata.sorted_tables if table.schema == service]
        Base.metadata.create_all(engine, tables=tables)
        return
    with engine.begin() as connection:
        # Each service takes its own lock; parallel Render starts are safe.
        connection.execute(text("SELECT pg_advisory_xact_lock(hashtext(:name))"), {"name": f"mnnit-migrate-{service}"})
        connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{service}"'))
        connection.execute(text(f'CREATE TABLE IF NOT EXISTS "{service}"._migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'))
        applied = set(connection.execute(text(f'SELECT version FROM "{service}"._migrations')).scalars())
        for file in sorted((ROOT / "migrations" / service).glob("*.sql")):
            if file.name in applied:
                continue
            # Migration files are repository-owned SQL, never user input.
            for statement in file.read_text(encoding="utf-8").split(";"):
                if statement.strip():
                    connection.exec_driver_sql(statement)
            connection.execute(text(f'INSERT INTO "{service}"._migrations (version) VALUES (:version)'), {"version": file.name})
            print(f"Applied {service}/{file.name}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--service", choices=[*SERVICES, "all"], default="all")
    args = parser.parse_args()
    for service in SERVICES if args.service == "all" else [args.service]:
        migrate(service)
    print("Database migrations are up to date")


if __name__ == "__main__":
    main()
