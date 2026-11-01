import json
from pathlib import Path
from typing import Any

import pytest
from langchain_core.messages import AIMessage

from app.config import Settings
from app.ingestion.seed import seed_from_file
from app.llm import invoke
from app.llm.provider import LLMClient
from app.storage.db import Database

SEED_FILE = Path(__file__).resolve().parents[2] / "data" / "mock_mailbox_data.json"


@pytest.fixture(autouse=True)
def _no_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(invoke, "BACKOFF_SECONDS", 0)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None,  # type: ignore[call-arg]
        LLM_PROVIDER="none",
        LLM_FALLBACK_CHAIN="rules",
        DATABASE_URL=f"sqlite:///{tmp_path / 'test.db'}",
        SEED_FILE=str(SEED_FILE),
        SEED_ON_STARTUP=False,
        LLM_MAX_RETRIES=2,
    )


@pytest.fixture
def db(settings: Settings) -> Database:
    database = Database(settings.DATABASE_URL)
    database.create_all()
    return database


@pytest.fixture
def seeded_db(db: Database, settings: Settings) -> Database:
    seed_from_file(db, settings.SEED_FILE)
    return db


@pytest.fixture
def seed_items() -> list[dict[str, Any]]:
    return json.loads(SEED_FILE.read_text())["emails"]


class ScriptedChat:
    """Stands in for a LangChain chat model. Each call pops the next scripted reply.

    A reply is either a string (returned as the model's text) or an exception instance (raised).
    """

    def __init__(self, replies: list[str | BaseException]) -> None:
        self.replies = list(replies)
        self.calls: list[list[Any]] = []

    def invoke(self, messages: list[Any]) -> AIMessage:
        self.calls.append(messages)
        if not self.replies:
            raise AssertionError("ScriptedChat ran out of replies")
        reply = self.replies.pop(0)
        if isinstance(reply, BaseException):
            raise reply
        return AIMessage(reply)


def fake_client(name: str, replies: list[str | BaseException]) -> LLMClient:
    return LLMClient(provider=name, model=f"{name}-fake", chat=ScriptedChat(replies))  # type: ignore[arg-type]


EXTRACTION_OK = json.dumps(
    {
        "sender": "billing@northgate-suppliers.com",
        "recipients": ["accounts-payable@arcline.com"],
        "date": "2026-06-04T11:20:00Z",
        "subject": "Invoice #NS-4471",
        "summary": "Northgate asks AP to pay invoice NS-4471 to a new bank account.",
        "key_facts": [
            {"type": "amount", "value": "$47,300", "context": "invoice total"},
            {"type": "account", "value": "account ending 9902", "context": "new account"},
        ],
        "attachments": [{"filename": "invoice_NS-4471.pdf", "summary": "The invoice."}],
    }
)

RISK_OK = json.dumps(
    {
        "risk": {
            "level": "high",
            "rationale": "Vendor bank details changed together with a larger invoice.",
            "tags": ["payment-change", "financial-anomaly"],
        },
        "entities": [
            {
                "name": "Northgate Suppliers Inc.",
                "type": "organization",
                "attributes": {"domain": "northgate-suppliers.com"},
            },
            {"name": "account ending 9902", "type": "account", "attributes": {}},
            {"name": "$47,300", "type": "amount", "attributes": {}},
        ],
        "relationships": [
            {
                "source": "Northgate Suppliers Inc.",
                "type": "owns_account",
                "target": "account ending 9902",
                "confidence": 0.8,
            },
            {
                "source": "Northgate Suppliers Inc.",
                "type": "requests_payment_of",
                "target": "$47,300",
                "confidence": 0.9,
            },
        ],
    }
)

RISK_LOW = json.dumps(
    {
        "risk": {"level": "low", "rationale": "Looks like a routine notice.", "tags": []},
        "entities": [],
        "relationships": [],
    }
)
