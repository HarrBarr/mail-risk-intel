"""Orchestration: the LangGraph pipeline under happy path, timeouts, garbage output and total outage."""

import httpx
import pytest

from app.config import Settings
from app.orchestration.graph import PipelineDeps, run_pipeline
from app.storage import repository as repo
from app.storage.db import Database
from tests.conftest import EXTRACTION_OK, RISK_LOW, RISK_OK, fake_client


def _run(db: Database, settings: Settings, chain: list, email_id: str = "E004"):  # type: ignore[no-untyped-def]
    run_pipeline(PipelineDeps(db=db, chain=chain, settings=settings), email_id)
    with db.session() as s:
        email = repo.get_email(s, email_id)
        assert email is not None
        steps = {st.step: st for st in email.steps}
        return email, steps


def test_happy_path_persists_extraction_risk_and_graph(seeded_db: Database, settings: Settings) -> None:
    client = fake_client("groq", [EXTRACTION_OK, RISK_OK])
    email, steps = _run(seeded_db, settings, [client])

    assert email.status == "done"
    assert email.risk is not None and email.risk.level == "high" and email.risk.provider == "groq"
    assert steps["extract"].outcome == "ok" and steps["assess"].outcome == "ok"
    # Deterministic history check found the account change against E009 and passed it to Agent B.
    assert any(sig["tag"] == "bank-detail-change" for sig in email.risk.signals_json)
    agent_b_prompt = client.chat.calls[1][1].content  # type: ignore[attr-defined]
    assert "E009" in agent_b_prompt and "6621" in agent_b_prompt
    with seeded_db.session() as s:
        entities, rels = repo.entities_for_email(s, "E004")
    assert {e.type for e in entities} == {"organization", "account", "amount", "person"}
    assert {r.type for r in rels} == {"owns_account", "requests_payment_of", "sent_email_to", "affiliated_with"}
    # The LLM's "Northgate Suppliers Inc." and the domain-derived org merged into one node.
    orgs = sorted(e.canonical_name for e in entities if e.type == "organization")
    assert orgs == ["Arcline", "Northgate Suppliers Inc."]


def test_garbage_output_gets_one_repair_retry(seeded_db: Database, settings: Settings) -> None:
    client = fake_client("groq", ["Sure! Here is the data you asked for.", EXTRACTION_OK, RISK_OK])
    email, steps = _run(seeded_db, settings, [client])

    assert email.status == "done"
    assert steps["extract"].outcome == "repaired" and steps["extract"].attempts == 2
    repair_turn = client.chat.calls[1][-1].content  # type: ignore[attr-defined]
    assert "rejected by the validator" in repair_turn


def test_schema_violation_is_repaired_with_validator_error(seeded_db: Database, settings: Settings) -> None:
    bad_level = RISK_OK.replace('"level": "high"', '"level": "catastrophic"')
    client = fake_client("groq", [EXTRACTION_OK, bad_level, RISK_OK])
    email, steps = _run(seeded_db, settings, [client])

    assert steps["assess"].outcome == "repaired"
    assert "level" in client.chat.calls[2][-1].content  # type: ignore[attr-defined]
    assert email.risk is not None and email.risk.level == "high"


def test_timeouts_retry_then_fall_through_to_next_provider(seeded_db: Database, settings: Settings) -> None:
    timeout = httpx.ReadTimeout("timed out")
    primary = fake_client("groq", [timeout, timeout, timeout])  # 1 try + LLM_MAX_RETRIES=2
    secondary = fake_client("ollama", [EXTRACTION_OK, RISK_OK])
    email, steps = _run(seeded_db, settings, [primary, secondary])

    assert email.status == "done"
    assert steps["extract"].provider == "ollama"
    assert steps["extract"].attempts == 4  # 3 on groq + 1 on ollama
    assert "ReadTimeout" in (steps["extract"].error or "")
    # Sticky failover: Agent B goes straight to ollama instead of waiting out groq's timeouts again.
    assert steps["assess"].provider == "ollama" and steps["assess"].attempts == 1
    assert len(primary.chat.calls) == 3  # type: ignore[attr-defined]


def test_permanent_error_skips_provider_without_retrying(seeded_db: Database, settings: Settings) -> None:
    class Unauthorized(Exception):
        status_code = 401

    primary = fake_client("groq", [Unauthorized("bad key"), Unauthorized("bad key")])
    secondary = fake_client("ollama", [EXTRACTION_OK, RISK_OK])
    _email, steps = _run(seeded_db, settings, [primary, secondary])

    assert steps["extract"].attempts == 2  # 1 on groq (no retry for 401) + 1 on ollama


def test_persistent_garbage_falls_back_to_rules(seeded_db: Database, settings: Settings) -> None:
    client = fake_client("groq", ["nope", "still nope", "{}", "{}"])
    email, steps = _run(seeded_db, settings, [client], email_id="E008")

    assert email.status == "done"
    assert steps["extract"].outcome == "fallback" and steps["extract"].provider == "rules"
    assert steps["assess"].outcome == "fallback"
    assert email.risk is not None and email.risk.level == "high" and email.risk.provider == "rules"


def test_no_providers_runs_rules_only(seeded_db: Database, settings: Settings) -> None:
    email, steps = _run(seeded_db, settings, [], email_id="E002")
    assert email.status == "done"
    assert email.risk is not None and email.risk.level == "none"
    assert steps["extract"].provider == "rules" and steps["extract"].attempts == 0


def test_safety_floor_raises_llm_none_or_low_on_strong_signals(seeded_db: Database, settings: Settings) -> None:
    client = fake_client("groq", [EXTRACTION_OK, RISK_LOW])
    email, _ = _run(seeded_db, settings, [client], email_id="E008")  # spoofed domain + phishing phrases

    assert email.risk is not None and email.risk.level == "medium"
    assert "Raised from 'low'" in email.risk.rationale
    assert "spoofed-domain" in email.risk.tags_json


def test_safety_floor_leaves_benign_mail_alone(seeded_db: Database, settings: Settings) -> None:
    client = fake_client("groq", [EXTRACTION_OK, RISK_LOW])
    email, _ = _run(seeded_db, settings, [client], email_id="E002")
    assert email.risk is not None and email.risk.level == "low"


def test_unexpected_error_marks_email_failed_not_crash(
    seeded_db: Database, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom(*_a, **_k):  # type: ignore[no-untyped-def]
        raise RuntimeError("disk full")

    monkeypatch.setattr(repo, "save_results", boom)
    email, steps = _run(seeded_db, settings, [], email_id="E002")
    assert email.status == "failed"
    assert "disk full" in (email.error or "")
    assert steps["pipeline"].outcome == "error"


def test_reprocessing_is_idempotent(seeded_db: Database, settings: Settings) -> None:
    for _ in range(2):
        _run(seeded_db, settings, [fake_client("groq", [EXTRACTION_OK, RISK_OK])])
    with seeded_db.session() as s:
        entities, rels = repo.entities_for_email(s, "E004")
        email = repo.get_email(s, "E004")
        assert email is not None
        assert {st.run for st in email.steps} == {1, 2}
    assert len(entities) == 6 and len(rels) == 5
