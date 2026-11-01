"""Background worker: claims pending emails and runs the pipeline, a few at a time.

Run with `python -m app.worker`. Several workers can share one database safely:
claiming is a conditional UPDATE, so an email is only ever processed by one of them.
"""

import contextlib
import signal
import time
from concurrent.futures import ThreadPoolExecutor, wait
from typing import Any

import structlog

from app.config import Settings, get_settings
from app.llm.provider import get_provider_chain
from app.log_config import configure_logging
from app.orchestration.graph import PipelineDeps, build_pipeline, run_pipeline
from app.storage import repository as repo
from app.storage.db import Database

log = structlog.get_logger()

CHAIN_REFRESH_SECONDS = 60.0


class Worker:
    def __init__(self, settings: Settings, db: Database | None = None) -> None:
        self.settings = settings
        self.db = db or Database(settings.DATABASE_URL)
        self._stop = False
        self._chain_built_at = 0.0
        self.deps: PipelineDeps | None = None
        self.pipeline: Any = None
        self.refresh_chain()

    def refresh_chain(self) -> None:
        """Rebuild the provider chain, e.g. once a local Ollama model has finished downloading."""
        chain = get_provider_chain(self.settings)
        previous = [c.provider for c in self.deps.chain] if self.deps else None
        self.deps = PipelineDeps(db=self.db, chain=chain, settings=self.settings)
        self.pipeline = build_pipeline(self.deps)
        self._chain_built_at = time.monotonic()
        current = [c.provider for c in chain]
        if previous is not None and previous != current:
            log.info("provider_chain_changed", providers=current or ["rules"])

    def process_batch(self, pool: ThreadPoolExecutor) -> int:
        if time.monotonic() - self._chain_built_at > CHAIN_REFRESH_SECONDS:
            self.refresh_chain()
        with self.db.session() as s:
            ids = repo.claim_pending(s, self.settings.WORKER_CONCURRENCY)
        assert self.deps is not None
        futures = [pool.submit(run_pipeline, self.deps, email_id, self.pipeline) for email_id in ids]
        wait(futures)
        return len(ids)

    def run_forever(self) -> None:
        self.db.create_all()
        with self.db.session() as s:
            recovered = repo.recover_in_flight(s)
        log.info(
            "worker_started",
            providers=[c.provider for c in self.deps.chain] if self.deps else ["rules"],
            concurrency=self.settings.WORKER_CONCURRENCY,
            recovered=recovered,
        )
        signal.signal(signal.SIGTERM, lambda *_: self.stop())
        with ThreadPoolExecutor(max_workers=self.settings.WORKER_CONCURRENCY) as pool:
            while not self._stop:
                try:
                    if self.process_batch(pool) == 0:
                        time.sleep(self.settings.WORKER_POLL_INTERVAL_SECONDS)
                except Exception:  # noqa: BLE001 - e.g. a locked DB; back off and keep going
                    log.exception("worker_loop_error")
                    time.sleep(self.settings.WORKER_POLL_INTERVAL_SECONDS * 2)

    def stop(self) -> None:
        self._stop = True


if __name__ == "__main__":
    configure_logging()
    with contextlib.suppress(KeyboardInterrupt):
        Worker(get_settings()).run_forever()
