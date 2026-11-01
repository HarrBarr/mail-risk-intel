"""Opt-in: run real seed emails through the configured provider chain (`pytest -m live`).

Uses whatever .env / environment configures (GROQ_API_KEY, or OLLAMA_BASE_URL + OLLAMA_MODEL).
Asserts on structure and on the clear-cut cases only; free models are allowed to disagree
on the borderline ones.
"""

import pytest

from app.config import Settings
from app.ingestion.seed import seed_from_file
from app.llm.provider import get_provider_chain
from app.orchestration.graph import PipelineDeps, run_pipeline
from app.storage import repository as repo
from app.storage.db import Database
from tests.conftest import SEED_FILE

pytestmark = pytest.mark.live


@pytest.mark.parametrize(("email_id", "acceptable"), [("E008", {"high"}), ("E004", {"medium", "high"}),
                                                      ("E002", {"none", "low"})])  # fmt: skip
def test_real_provider(tmp_path, email_id: str, acceptable: set[str]) -> None:  # type: ignore[no-untyped-def]
    settings = Settings(DATABASE_URL=f"sqlite:///{tmp_path / 'live.db'}")
    chain = get_provider_chain(settings)
    if not chain:
        pytest.skip("no LLM provider configured")
    db = Database(settings.DATABASE_URL)
    db.create_all()
    seed_from_file(db, str(SEED_FILE))
    run_pipeline(PipelineDeps(db=db, chain=chain, settings=settings), email_id)
    with db.session() as s:
        email = repo.get_email(s, email_id)
        assert email is not None and email.status == "done"
        assert email.risk is not None and email.risk.provider != "rules", [st.error for st in email.steps]
        assert email.risk.level in acceptable, email.risk.rationale
