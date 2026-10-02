from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from .config import settings


def normalize_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


@lru_cache
def get_engine():
    url = normalize_url(settings.database_url)
    options = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False, "timeout": 30}
    engine = create_engine(url, **options)
    if url.startswith("sqlite"):
        engine = engine.execution_options(schema_translate_map={"auth": None, "events": None, "ticketing": None})
    return engine


def get_session():
    with Session(get_engine()) as session:
        yield session
