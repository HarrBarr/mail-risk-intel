"""Entity identity and deterministic graph enrichment, shared by the LLM and rules paths."""

import re

from app.agents.schemas import Entity, ExtractionResult, Relationship, RiskGraphResult
from app.agents.signals import PERSONAL_DOMAINS, domain_of, parse_amount, registered_domain

_ORG_SUFFIXES = r"\b(inc|incorporated|corp|corporation|llc|ltd|limited|co|plc|gmbh)\b\.?"
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")


def canonical_key(type_: str, name: str, attributes: dict[str, str]) -> str:
    """Dedup key: two mentions with the same (type, key) are the same real-world thing."""
    text = " ".join(name.lower().split())
    if type_ == "person":
        email = attributes.get("email") or (name if "@" in name else "")
        return email.strip().lower() if email else text
    if type_ == "organization":
        domain = attributes.get("domain", "")
        if "@" in text or re.fullmatch(r"[\w-]+(\.[\w-]+)*\.[a-z]{2,}", text):
            domain = domain_of(text) or text
        if domain:
            text = registered_domain(domain).split(".")[0]
        text = re.sub(_ORG_SUFFIXES, "", text)
        return re.sub(r"[^a-z0-9]+", " ", text).strip() or name.lower()
    if type_ == "amount":
        value = parse_amount(name.replace("USD", "$"))
        return f"usd:{value:.2f}" if value is not None else text
    if type_ == "account":
        digits = re.findall(r"\d{3,}", text)
        if digits:
            prefix = "routing" if "routing" in text else "acct"
            return f"{prefix}:{digits[-1]}"
    return text


def org_name_for_domain(host: str) -> str:
    label = registered_domain(host).split(".")[0]
    return " ".join(w.capitalize() for w in re.split(r"[-_]", label) if w)


def enrich_graph(result: RiskGraphResult, extraction: ExtractionResult) -> RiskGraphResult:
    """Guarantee the graph's backbone regardless of which agent produced it.

    Every sender/recipient mailbox becomes a person node, linked by `sent_email_to`, and every
    mailbox on a non-personal domain is linked `affiliated_with` the organisation owning that
    domain. LLM output varies run to run; this keeps cross-email joins (same vendor, same
    spoofed domain) stable. Existing entities are matched by canonical key, not by name.
    """
    entities = list(result.entities)
    relationships = list(result.relationships)
    by_key: dict[tuple[str, str], str] = {
        (e.type, canonical_key(e.type, e.name, e.attributes)): e.name for e in entities
    }
    existing_rels = {(r.source.lower(), r.type, r.target.lower()) for r in relationships}

    def ensure(name: str, type_: str, **attrs: str) -> str:
        key = (type_, canonical_key(type_, name, attrs))
        if key not in by_key:
            entities.append(Entity(name=name, type=type_, attributes=attrs))  # type: ignore[arg-type]
            by_key[key] = name
        return by_key[key]

    def link(source: str, type_: str, target: str, confidence: float) -> None:
        if (source.lower(), type_, target.lower()) not in existing_rels and source.lower() != target.lower():
            relationships.append(Relationship(source=source, type=type_, target=target, confidence=confidence))
            existing_rels.add((source.lower(), type_, target.lower()))

    mailboxes = [
        m.strip().lower() for m in [extraction.sender, *extraction.recipients] if _EMAIL_RE.fullmatch(m.strip())
    ]
    sender = extraction.sender.strip().lower()
    sender_node = ensure(sender, "person", email=sender) if sender in mailboxes else None
    for mailbox in dict.fromkeys(mailboxes):
        person = ensure(mailbox, "person", email=mailbox)
        if sender_node and person != sender_node:
            link(sender_node, "sent_email_to", person, 1.0)
        host = domain_of(mailbox)
        if host and host not in PERSONAL_DOMAINS:
            org = ensure(org_name_for_domain(host), "organization", domain=registered_domain(host))
            link(person, "affiliated_with", org, 0.6)
    return RiskGraphResult(risk=result.risk, entities=entities, relationships=relationships)
