"""All reads/writes go through here: the API and the pipeline never build queries themselves."""

import contextlib
from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.agents.entities import canonical_key
from app.agents.schemas import RISK_ORDER, ExtractionResult, RiskGraphResult
from app.agents.signals import Signal, domain_of, registered_domain
from app.ingestion.parsers import RawEmail
from app.storage.models import (
    Email,
    EmailStatus,
    EntityMention,
    EntityRow,
    Extraction,
    ProcessingStep,
    RelationshipRow,
    RiskAssessmentRow,
)

# ----------------------------------------------------------------- emails


def insert_email(session: Session, raw: RawEmail) -> Email | None:
    """Insert unless an email with this id exists (makes seeding idempotent)."""
    if session.get(Email, raw.id) is not None:
        return None
    email = Email(
        id=raw.id,
        source=raw.source,
        raw_content=raw.raw_content,
        body=raw.body,
        attachments_json=raw.attachments,
        sender=raw.sender,
        recipients_json=raw.recipients,
        subject=raw.subject,
        date=raw.date,
        status=EmailStatus.PENDING,
    )
    session.add(email)
    return email


def to_raw(email: Email) -> RawEmail:
    return RawEmail(
        id=email.id,
        source=email.source,
        body=email.body,
        sender=email.sender,
        recipients=list(email.recipients_json or []),
        subject=email.subject,
        date=email.date,
        attachments=list(email.attachments_json or []),
    )


def list_emails(
    session: Session,
    *,
    risk: str | None = None,
    status: str | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[Email], int]:
    stmt = select(Email).options(selectinload(Email.risk), selectinload(Email.extraction))
    if risk:
        stmt = stmt.join(RiskAssessmentRow).where(RiskAssessmentRow.level == risk)
    if status:
        stmt = stmt.where(Email.status == status)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Email.subject).like(like),
                func.lower(Email.sender).like(like),
                func.lower(Email.body).like(like),
            )
        )
    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    stmt = stmt.order_by(Email.date.desc().nulls_last(), Email.created_at.desc()).limit(limit).offset(offset)
    return list(session.scalars(stmt)), total


def get_email(session: Session, email_id: str) -> Email | None:
    return session.get(
        Email,
        email_id,
        options=[selectinload(Email.risk), selectinload(Email.extraction), selectinload(Email.steps)],
    )


def claim_pending(session: Session, limit: int) -> list[str]:
    """Atomically move up to `limit` pending emails to 'extracting' and return their ids.

    Oldest first by email date, so history for a sender is in place before later mail is judged
    (history is mined from raw text, so this is a nicety, not a correctness requirement).
    """
    ids = list(
        session.scalars(
            select(Email.id)
            .where(Email.status == EmailStatus.PENDING)
            .order_by(Email.date.asc().nulls_last(), Email.created_at.asc())
            .limit(limit)
        )
    )
    claimed = []
    for email_id in ids:
        result = session.execute(
            update(Email)
            .where(Email.id == email_id, Email.status == EmailStatus.PENDING)
            .values(status=EmailStatus.EXTRACTING, error=None, attempts=Email.attempts + 1)
        )
        if result.rowcount:  # type: ignore[attr-defined]
            claimed.append(email_id)
    return claimed


def set_status(session: Session, email_id: str, status: str, error: str | None = None) -> None:
    session.execute(update(Email).where(Email.id == email_id).values(status=status, error=error))


def requeue(session: Session, email_id: str) -> bool:
    result = session.execute(
        update(Email)
        .where(Email.id == email_id, Email.status.not_in(EmailStatus.IN_FLIGHT))
        .values(status=EmailStatus.PENDING, error=None)
    )
    return bool(result.rowcount)  # type: ignore[attr-defined]


def requeue_all(session: Session) -> int:
    result = session.execute(
        update(Email).where(Email.status.not_in(EmailStatus.IN_FLIGHT)).values(status=EmailStatus.PENDING, error=None)
    )
    return int(result.rowcount)  # type: ignore[attr-defined]


def recover_in_flight(session: Session) -> int:
    """On worker start: anything left mid-pipeline by a crash goes back to pending."""
    result = session.execute(
        update(Email).where(Email.status.in_(EmailStatus.IN_FLIGHT)).values(status=EmailStatus.PENDING)
    )
    return int(result.rowcount)  # type: ignore[attr-defined]


def prior_from_same_domain(session: Session, email: Email) -> list[tuple[str, str]]:
    """(id, raw_content) of earlier emails from the sender's registered domain."""
    host = domain_of(email.sender)
    if not host:
        return []
    reg = registered_domain(host)
    stmt = select(Email.id, Email.raw_content, Email.sender).where(Email.id != email.id)
    if email.date is not None:
        stmt = stmt.where(Email.date < email.date)
    stmt = stmt.where(func.lower(Email.sender).like(f"%{reg}"))
    return [(i, raw) for i, raw, s in session.execute(stmt) if registered_domain(domain_of(s)) == reg]


def next_run_number(session: Session, email_id: str) -> int:
    return (session.scalar(select(func.max(ProcessingStep.run)).where(ProcessingStep.email_id == email_id)) or 0) + 1


def add_step(session: Session, email_id: str, run: int, **fields: Any) -> None:
    session.add(ProcessingStep(email_id=email_id, run=run, **fields))


# ----------------------------------------------------------------- results


def save_results(
    session: Session,
    email_id: str,
    extraction: ExtractionResult,
    extraction_meta: dict[str, str],
    graph: RiskGraphResult,
    risk_meta: dict[str, str],
    signals: list[Signal],
) -> None:
    """Replace this email's results (idempotent across reprocessing) and upsert global entities."""
    email = session.get(Email, email_id)
    if email is None:
        raise LookupError(email_id)

    session.query(RelationshipRow).filter_by(email_id=email_id).delete()
    session.query(EntityMention).filter_by(email_id=email_id).delete()
    session.query(Extraction).filter_by(email_id=email_id).delete()
    session.query(RiskAssessmentRow).filter_by(email_id=email_id).delete()
    session.flush()

    # Agent A can fill gaps the parser left (pasted text without headers).
    if not email.sender and extraction.sender:
        email.sender = extraction.sender
    if not email.recipients_json and extraction.recipients:
        email.recipients_json = extraction.recipients
    if not email.subject and extraction.subject:
        email.subject = extraction.subject
    if email.date is None and extraction.date:
        with contextlib.suppress(ValueError):
            email.date = datetime.fromisoformat(extraction.date.replace("Z", "+00:00"))

    session.add(
        Extraction(email_id=email_id, summary=extraction.summary, facts_json=extraction.model_dump(), **extraction_meta)
    )
    session.add(
        RiskAssessmentRow(
            email_id=email_id,
            level=graph.risk.level,
            rationale=graph.risk.rationale,
            tags_json=graph.risk.tags,
            signals_json=[{"tag": s.tag, "weight": s.weight, "evidence": s.evidence} for s in signals],
            **risk_meta,
        )
    )

    by_name: dict[str, int] = {}
    for ent in graph.entities:
        key = canonical_key(ent.type, ent.name, ent.attributes)
        row = session.scalar(select(EntityRow).where(EntityRow.type == ent.type, EntityRow.canonical_key == key))
        if row is None:
            row = EntityRow(type=ent.type, canonical_key=key, canonical_name=ent.name, attributes_json=ent.attributes)
            session.add(row)
            session.flush()
        else:
            # Prefer a human name over an email address once we learn one.
            if "@" in row.canonical_name and "@" not in ent.name:
                row.canonical_name = ent.name
            row.attributes_json = {**(row.attributes_json or {}), **ent.attributes}
        by_name[ent.name.strip().lower()] = row.id
        session.add(EntityMention(entity_id=row.id, email_id=email_id, surface_text=ent.name[:320]))

    for rel in graph.relationships:
        src, dst = by_name.get(rel.source.strip().lower()), by_name.get(rel.target.strip().lower())
        if src and dst and src != dst:
            session.add(
                RelationshipRow(
                    source_entity_id=src,
                    target_entity_id=dst,
                    type=rel.type,
                    email_id=email_id,
                    confidence=rel.confidence,
                )
            )
    email.status = EmailStatus.DONE
    email.error = None


def entities_for_email(session: Session, email_id: str) -> tuple[list[EntityRow], list[RelationshipRow]]:
    entity_ids = select(EntityMention.entity_id).where(EntityMention.email_id == email_id)
    entities = list(session.scalars(select(EntityRow).where(EntityRow.id.in_(entity_ids)).order_by(EntityRow.type)))
    rels = list(session.scalars(select(RelationshipRow).where(RelationshipRow.email_id == email_id)))
    return entities, rels


def prune_orphan_entities(session: Session) -> None:
    session.query(EntityRow).filter(~EntityRow.id.in_(select(EntityMention.entity_id))).delete(
        synchronize_session=False
    )


# ----------------------------------------------------------------- graph


def knowledge_graph(session: Session, min_risk: str | None = None) -> dict[str, Any]:
    """Aggregate all entities/relationships, optionally only from emails at or above `min_risk`."""
    level_of: dict[str, str] = dict(session.execute(select(RiskAssessmentRow.email_id, RiskAssessmentRow.level)).all())
    floor = RISK_ORDER.get(min_risk or "none", 0)
    allowed = {eid for eid, lvl in level_of.items() if RISK_ORDER.get(lvl, 0) >= floor}

    mentions: dict[int, set[str]] = defaultdict(set)
    for entity_id, email_id in session.execute(select(EntityMention.entity_id, EntityMention.email_id)):
        if email_id in allowed:
            mentions[entity_id].add(email_id)

    nodes = []
    for row in session.scalars(select(EntityRow).where(EntityRow.id.in_(list(mentions)))):
        emails = sorted(mentions[row.id])
        max_risk = max((level_of.get(e, "none") for e in emails), key=lambda lvl: RISK_ORDER.get(lvl, 0))
        nodes.append(
            {
                "id": row.id,
                "name": row.canonical_name,
                "type": row.type,
                "attributes": row.attributes_json or {},
                "email_ids": emails,
                "mention_count": len(emails),
                "max_risk": max_risk,
            }
        )

    edges: dict[tuple[int, int, str], dict[str, Any]] = {}
    for rel in session.scalars(select(RelationshipRow)):
        if rel.email_id not in allowed:
            continue
        key = (rel.source_entity_id, rel.target_entity_id, rel.type)
        edge = edges.setdefault(
            key,
            {
                "source": rel.source_entity_id,
                "target": rel.target_entity_id,
                "type": rel.type,
                "email_ids": [],
                "confidence": 0.0,
            },
        )
        edge["email_ids"].append(rel.email_id)
        edge["confidence"] = max(edge["confidence"], rel.confidence)
    return {"nodes": nodes, "edges": list(edges.values())}
