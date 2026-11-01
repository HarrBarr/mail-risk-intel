"""The rule-based fallback on the seed set, and entity canonicalisation."""

import pytest

from app.agents import fallback
from app.agents.entities import canonical_key
from app.agents.signals import detect, history_from_texts, is_lookalike
from app.ingestion.parsers import from_seed

EXPECTED = {
    "E001": "high", "E002": "none", "E003": "high", "E004": "high", "E005": "high",
    "E006": "high", "E007": "none", "E008": "high", "E009": "none", "E010": "medium",
}  # fmt: skip


def test_fallback_scores_seed_set_sensibly(seed_items: list[dict]) -> None:
    emails = [from_seed(item) for item in seed_items]
    for email in emails:
        prior = [(o.id, o.raw_content) for o in emails
                 if o.sender == email.sender and o.date and email.date and o.date < email.date]  # fmt: skip
        signals = detect(email.raw_content, email.sender, email.recipients, "arcline.com",
                         history_from_texts("", prior))  # fmt: skip
        result = fallback.assess(fallback.extract(email), signals, email.body)
        assert result.risk.level == EXPECTED[email.id], (email.id, [s.tag for s in signals])


def test_bank_change_needs_history(seed_items: list[dict]) -> None:
    e004, e009 = from_seed(seed_items[3]), from_seed(seed_items[8])
    with_history = detect(e004.raw_content, e004.sender, e004.recipients, "arcline.com",
                          history_from_texts("northgate-suppliers.com", [("E009", e009.raw_content)]))  # fmt: skip
    without = detect(e004.raw_content, e004.sender, e004.recipients, "arcline.com", None)
    assert {"bank-detail-change", "financial-anomaly"} <= {s.tag for s in with_history}
    assert not {"bank-detail-change", "financial-anomaly"} & {s.tag for s in without}


@pytest.mark.parametrize(
    ("domain", "expected"),
    [
        ("arclne-corp.com", True),
        ("arclline-portal.com", True),
        ("arcline-secure.net", True),
        ("arcline.com", False),
        ("mail.arcline.com", False),
        ("partnerlogistics.com", False),
        ("northgate-suppliers.com", False),
    ],
)
def test_lookalike_domains(domain: str, expected: bool) -> None:
    assert is_lookalike(domain, "arcline.com") is expected


@pytest.mark.parametrize(
    ("type_", "a", "b"),
    [
        ("organization", "Northgate Suppliers Inc.", "northgate suppliers"),
        ("organization", "Meridian Corp", "Meridian Corporation"),
        ("amount", "$47,300", "$47,300.00"),
        ("amount", "$1.2M", "$1,200,000"),
        ("account", "account ending 6621", "Acct ****6621"),
        ("person", "d.moreno@arcline.com", "D.Moreno@arcline.com"),
    ],
)
def test_canonical_keys_merge_variants(type_: str, a: str, b: str) -> None:
    assert canonical_key(type_, a, {}) == canonical_key(type_, b, {})


def test_person_key_prefers_email_attribute() -> None:
    assert canonical_key("person", "James", {"email": "J@x.com"}) == canonical_key("person", "j@x.com", {})


def test_routing_and_account_numbers_stay_distinct() -> None:
    assert canonical_key("account", "routing 044000037", {}) != canonical_key("account", "account ending 0037", {})
