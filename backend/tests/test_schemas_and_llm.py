import json

import httpx
import pytest
from pydantic import ValidationError

from app.agents.schemas import ExtractionResult, RiskGraphResult
from app.llm.invoke import LLMCallError, _retry_after, invoke_text, is_transient, parse_json_object
from tests.conftest import fake_client

# ----------------------------------------------------------------- JSON extraction


@pytest.mark.parametrize(
    "text",
    [
        '{"a": 1}',
        'Here you go:\n```json\n{"a": 1}\n```',
        'Sure! {"a": 1} Hope that helps.',
    ],
)
def test_parse_json_object_tolerates_wrapping(text: str) -> None:
    assert parse_json_object(text) == {"a": 1}


@pytest.mark.parametrize("text", ["", "no json here", "[1, 2]", '{"a": '])
def test_parse_json_object_rejects_garbage(text: str) -> None:
    with pytest.raises(ValueError):
        parse_json_object(text)


# ----------------------------------------------------------------- schemas


def test_risk_schema_normalises_synonyms_and_tags() -> None:
    result = RiskGraphResult.model_validate(
        {
            "risk": {
                "level": "Critical",
                "rationale": "x",
                "tags": ["Financial Anomaly", "urgency", "URGENCY", "None"],
            },
            "entities": [{"name": "Acme", "type": "Company"}, {"name": "$5", "type": "money"}],
            "relationships": [],
        }
    )
    assert result.risk.level == "high"
    assert result.risk.tags == ["financial-anomaly", "urgency"]
    assert [e.type for e in result.entities] == ["organization", "amount"]


def test_risk_schema_rejects_unknown_level_and_missing_rationale() -> None:
    with pytest.raises(ValidationError):
        RiskGraphResult.model_validate({"risk": {"level": "catastrophic", "rationale": "x"}})
    with pytest.raises(ValidationError):
        RiskGraphResult.model_validate({"risk": {"level": "low"}})


def test_dangling_and_self_relationships_are_dropped() -> None:
    result = RiskGraphResult.model_validate(
        {
            "risk": {"level": "low", "rationale": "x"},
            "entities": [{"name": "A", "type": "person"}, {"name": "B", "type": "organization"}],
            "relationships": [
                {"source": "A", "type": "Employed By", "target": "B"},
                {"source": "A", "type": "knows", "target": "Ghost"},
                {"source": "A", "type": "is", "target": "a"},
            ],
        }
    )
    assert [(r.source, r.type, r.target) for r in result.relationships] == [("A", "employed_by", "B")]


def test_extraction_accepts_comma_separated_recipients_and_requires_summary() -> None:
    ok = ExtractionResult.model_validate({"summary": "s", "recipients": "a@x.com; b@y.com"})
    assert ok.recipients == ["a@x.com", "b@y.com"]
    with pytest.raises(ValidationError):
        ExtractionResult.model_validate({"summary": ""})


# ----------------------------------------------------------------- transport errors


class _Status(Exception):
    def __init__(self, code: int, headers: dict[str, str] | None = None) -> None:
        super().__init__(f"HTTP {code}")
        self.status_code = code
        self.response = httpx.Response(code, headers=headers or {})


@pytest.mark.parametrize(
    ("exc", "transient"),
    [
        (_Status(429), True),
        (_Status(503), True),
        (_Status(401), False),
        (_Status(400), False),
        (httpx.ReadTimeout("t"), True),
        (httpx.ConnectError("c"), True),
        (TimeoutError(), True),
        (ValueError("bad"), False),
    ],
)
def test_error_classification(exc: Exception, transient: bool) -> None:
    assert is_transient(exc) is transient


def test_retry_after_header_is_read() -> None:
    assert _retry_after(_Status(429, {"retry-after": "7"})) == 7.0
    assert _retry_after(_Status(429)) is None


def test_invoke_retries_rate_limit_then_succeeds() -> None:
    client = fake_client("groq", [_Status(429, {"retry-after": "0"}), json.dumps({"ok": True})])
    text, attempts, _ = invoke_text(client, [], max_retries=2)
    assert json.loads(text) == {"ok": True} and attempts == 2


def test_invoke_gives_up_after_max_retries() -> None:
    client = fake_client("groq", [_Status(503)] * 3)
    with pytest.raises(LLMCallError) as info:
        invoke_text(client, [], max_retries=2)
    assert info.value.attempts == 3 and info.value.provider == "groq"
