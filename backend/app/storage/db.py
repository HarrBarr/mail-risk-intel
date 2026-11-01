"""Engine + session factory. SQLite runs in WAL mode so the API and worker can share one file."""

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.storage.models import Base


def make_engine(url: str) -> Engine:
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False, "timeout": 30}
        path = url.split("///", 1)[-1]
        if path and path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(url, connect_args=connect_args)

    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn, _record):  # type: ignore[no-untyped-def]
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA busy_timeout=30000")
            cur.close()

    return engine


class Database:
    def __init__(self, url: str) -> None:
        self.engine = make_engine(url)
        self._factory = sessionmaker(self.engine, expire_on_commit=False)

    def create_all(self) -> None:
        Base.metadata.create_all(self.engine)

    @contextmanager
    def session(self) -> Iterator[Session]:
        with self._factory() as session:
            try:
                yield session
                session.commit()
            except Exception:
                session.rollback()
                raise
