"""Load the seed mailbox once. Idempotent: emails that already exist are skipped."""

import json
from pathlib import Path

import structlog

from app.ingestion.parsers import from_seed
from app.storage import repository as repo
from app.storage.db import Database

log = structlog.get_logger()


def seed_from_file(db: Database, path: str) -> int:
    file = Path(path)
    if not file.exists():
        log.warning("seed_file_missing", path=path)
        return 0
    items = json.loads(file.read_text())["emails"]
    added = 0
    with db.session() as session:
        for item in items:
            if repo.insert_email(session, from_seed(item)) is not None:
                added += 1
    log.info("seeded", added=added, total=len(items))
    return added
