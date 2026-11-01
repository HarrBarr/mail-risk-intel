"""Rule-based stand-ins for Agent A and Agent B.

Used when every configured LLM provider is unavailable or keeps returning
invalid output. Results are coarser than the LLM's but structurally identical,
and are labelled provider='rules' so the UI can say so.
"""

import re

from app.agents.schemas import (
    Attachment,
    Entity,
    ExtractionResult,
    Fact,
    Relationship,
    RiskAssessment,
    RiskGraphResult,
)
from app.agents.signals import (
    ACCOUNT_RE,
    DATE_RE,
    REFERENCE_RE,
    ROUTING_RE,
    URL_RE,
    Signal,
    find_amounts,
    score_to_level,
)
from app.ingestion.parsers import RawEmail

ORG_SUFFIX_RE = re.compile(
    r"\b((?:[A-Z][a-zA-Z]+\s){0,2}[A-Z][a-zA-Z]+\s(?:Corp|Corporation|Inc|Industries|LLC|Ltd|Suppliers|Group|Partners))\b\.?"
)


def _first_sentences(text: str, limit: int = 240) -> str:
    text = " ".join(text.split())
    sentences = re.split(r"(?<=[.!?])\s+", text)
    out = ""
    for s in sentences:
        if len(out) + len(s) > limit and out:
            break
        out = f"{out} {s}".strip()
    return out or text[:limit] or "(empty email)"


def extract(email: RawEmail) -> ExtractionResult:
    text = email.raw_content
    facts: list[Fact] = []
    facts += [Fact(type="amount", value=a) for a in find_amounts(text)]
    facts += [Fact(type="account", value=f"account ending {a}") for a in dict.fromkeys(ACCOUNT_RE.findall(text))]
    facts += [Fact(type="account", value=f"routing {r}") for r in dict.fromkeys(ROUTING_RE.findall(text))]
    facts += [Fact(type="reference", value=r) for r in dict.fromkeys(REFERENCE_RE.findall(text))]
    facts += [Fact(type="url", value=u) for u in dict.fromkeys(URL_RE.findall(text))]
    facts += [Fact(type="date", value=d) for d in dict.fromkeys(m.group(0) for m in DATE_RE.finditer(email.body))]
    return ExtractionResult(
        sender=email.sender,
        recipients=email.recipients,
        date=email.date.isoformat() if email.date else None,
        subject=email.subject,
        summary=_first_sentences(email.body),
        key_facts=facts,
        attachments=[
            Attachment(filename=a["filename"], summary=_first_sentences(a["extracted_text"], 160))
            for a in email.attachments
        ],
    )


def assess(extraction: ExtractionResult, signals: list[Signal], body: str = "") -> RiskGraphResult:
    score = sum(s.weight for s in signals)
    level = score_to_level(score)
    tags = list(dict.fromkeys(s.tag for s in signals))
    if signals:
        rationale = (
            "Rule-based assessment (no LLM available). Signals: "
            + "; ".join(f"{s.tag} ({s.evidence})" for s in signals)
            + "."
        )
    else:
        rationale = "Rule-based assessment (no LLM available): no risk indicators matched."

    entities: dict[str, Entity] = {}
    relationships: list[Relationship] = []

    def add(name: str, type_: str, **attrs: str) -> str:
        key = name.strip().lower()
        if key not in entities:
            entities[key] = Entity(name=name, type=type_, attributes=attrs)  # type: ignore[arg-type]
        return name

    def link(source: str, rel: str, target: str, confidence: float = 0.6) -> None:
        relationships.append(Relationship(source=source, type=rel, target=target, confidence=confidence))

    # Mailboxes, their organisations and sent_email_to edges are added by entities.enrich_graph.
    sender = extraction.sender
    if sender:
        add(sender, "person", email=sender)

    text = " ".join([body, *(a.summary for a in extraction.attachments)])
    for org in dict.fromkeys(m.strip() for m in ORG_SUFFIX_RE.findall(text)):
        add(org, "organization")

    payment = any(s.tag in {"wire-request", "payment-change"} for s in signals)
    for fact in extraction.key_facts:
        if fact.type == "amount":
            add(fact.value, "amount")
            if sender and payment:
                link(sender, "requests_payment_of", fact.value, 0.5)
        elif fact.type == "account":
            add(fact.value, "account")
            if sender and payment:
                link(sender, "references_account", fact.value, 0.5)

    return RiskGraphResult(
        risk=RiskAssessment(level=level, rationale=rationale, tags=tags),  # type: ignore[arg-type]
        entities=list(entities.values()),
        relationships=relationships,
    )
