import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.orchestration.graph import PipelineDeps, run_pipeline
from app.storage.db import Database
from tests.test_ingestion import make_pdf


@pytest.fixture
def client(settings: Settings, db: Database):  # type: ignore[no-untyped-def]
    settings.SEED_ON_STARTUP = True
    with TestClient(create_app(settings, db)) as c:
        yield c


def process_all(db: Database, settings: Settings) -> None:
    deps = PipelineDeps(db=db, chain=[], settings=settings)
    for email_id in [f"E{n:03d}" for n in range(1, 11)]:
        run_pipeline(deps, email_id)


def test_health_reports_rules_mode_without_providers(client: TestClient) -> None:
    body = client.get("/api/health").json()
    assert body["mode"] == "rules" and body["providers"] == ["rules"]
    assert body["queue"] == {"pending": 10}


def test_seeded_inbox_lists_newest_first(client: TestClient) -> None:
    body = client.get("/api/emails").json()
    assert body["total"] == 10
    assert body["items"][0]["id"] == "E010" and body["items"][-1]["id"] == "E009"
    assert body["in_flight"] == 10 and body["items"][0]["date"].endswith("Z")
    assert all(item["status"] == "pending" and item["risk_level"] is None for item in body["items"])


def test_filters_and_search(client: TestClient, db: Database, settings: Settings) -> None:
    process_all(db, settings)
    high = client.get("/api/emails", params={"risk": "high"}).json()
    assert high["total"] == 6 and {i["risk_level"] for i in high["items"]} == {"high"}
    assert client.get("/api/emails", params={"q": "northgate"}).json()["total"] == 2
    assert client.get("/api/emails", params={"risk": "extreme"}).status_code == 422


def test_create_from_json_text(client: TestClient) -> None:
    resp = client.post("/api/emails", json={"raw_text": "From: a@b.com\nSubject: hi\n\nwire $10 now"})
    assert resp.status_code == 202
    detail = client.get(f"/api/emails/{resp.json()['id']}").json()
    assert detail["status"] == "pending" and detail["sender"] == "a@b.com" and detail["source"] == "paste"


def test_create_from_pdf_upload(client: TestClient) -> None:
    files = {"file": ("scan.pdf", make_pdf("Transfer $9,000 to account ending 1234"), "application/pdf")}
    resp = client.post("/api/emails", files=files)
    assert resp.status_code == 202
    assert "account ending 1234" in client.get(f"/api/emails/{resp.json()['id']}").json()["body"]


@pytest.mark.parametrize(
    ("kwargs", "status"),
    [
        ({"json": {"raw_text": ""}}, 422),
        ({"json": {"text": "wrong field"}}, 422),
        ({"files": {"file": ("x.docx", b"data", "application/octet-stream")}}, 422),
        ({"files": {"file": ("x.txt", b"", "text/plain")}}, 422),
        ({"content": b"hello", "headers": {"content-type": "text/plain"}}, 415),
    ],
)
def test_create_rejects_bad_input(client: TestClient, kwargs: dict, status: int) -> None:
    resp = client.post("/api/emails", **kwargs)
    assert resp.status_code == status
    assert isinstance(resp.json()["detail"], str)


def test_detail_after_processing_has_everything(client: TestClient, db: Database, settings: Settings) -> None:
    process_all(db, settings)
    detail = client.get("/api/emails/E004").json()
    assert detail["status"] == "done"
    assert detail["risk"]["level"] == "high" and detail["risk"]["provider"] == "rules"
    assert any(s["tag"] == "bank-detail-change" for s in detail["risk"]["signals"])
    assert detail["extraction"]["result"]["summary"]
    assert {e["type"] for e in detail["entities"]} >= {"organization", "amount", "account"}
    assert detail["relationships"] and all(r["source"] != "?" for r in detail["relationships"])
    assert [s["step"] for s in detail["steps"]] == ["extract", "assess", "persist"]


def test_unknown_email_is_404(client: TestClient) -> None:
    assert client.get("/api/emails/nope").status_code == 404
    assert client.post("/api/emails/nope/reprocess").status_code == 404


def test_reprocess_requeues_but_not_while_in_flight(client: TestClient, db: Database, settings: Settings) -> None:
    process_all(db, settings)
    assert client.post("/api/emails/E001/reprocess").status_code == 202
    assert client.get("/api/emails/E001").json()["status"] == "pending"
    with db.session() as s:
        from app.storage import repository as repo

        repo.claim_pending(s, 1)
    assert client.post("/api/emails/E001/reprocess").status_code == 409


def test_graph_aggregates_across_emails(client: TestClient, db: Database, settings: Settings) -> None:
    process_all(db, settings)
    graph = client.get("/api/graph").json()
    ids = {n["id"] for n in graph["nodes"]}
    assert all(e["source"] in ids and e["target"] in ids for e in graph["edges"])
    shared = next(n for n in graph["nodes"] if n["name"] == "account ending 6621")
    assert shared["email_ids"] == ["E004", "E009"] and shared["max_risk"] == "high"

    high_only = client.get("/api/graph", params={"min_risk": "high"}).json()
    assert 0 < len(high_only["nodes"]) < len(graph["nodes"])
