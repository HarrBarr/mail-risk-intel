"""Relational model.

Entities and relationships are *global* (deduplicated across emails) so the
knowledge graph is a plain aggregate query; `entity_mentions` and
`relationships.email_id` keep provenance back to the email each fact came from.
New entity or relationship kinds need no schema change: `type` is free text
and per-type detail lives in `attributes_json`.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    type_annotation_map = {dict[str, Any]: JSON, list[Any]: JSON}


class EmailStatus:
    PENDING = "pending"
    EXTRACTING = "extracting"
    ASSESSING = "assessing"
    DONE = "done"
    FAILED = "failed"
    IN_FLIGHT = (EXTRACTING, ASSESSING)


class Email(Base):
    __tablename__ = "emails"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source: Mapped[str] = mapped_column(String(16))  # seed | paste | txt | pdf | eml
    raw_content: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text, default="")
    attachments_json: Mapped[list[Any]] = mapped_column(default=list)
    sender: Mapped[str] = mapped_column(String(320), default="")
    recipients_json: Mapped[list[Any]] = mapped_column(default=list)
    subject: Mapped[str] = mapped_column(String(998), default="")
    date: Mapped[datetime | None] = mapped_column(default=None)
    status: Mapped[str] = mapped_column(String(16), default=EmailStatus.PENDING, index=True)
    error: Mapped[str | None] = mapped_column(Text, default=None)
    attempts: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    extraction: Mapped["Extraction | None"] = relationship(
        back_populates="email", cascade="all, delete-orphan", uselist=False
    )
    risk: Mapped["RiskAssessmentRow | None"] = relationship(
        back_populates="email", cascade="all, delete-orphan", uselist=False
    )
    steps: Mapped[list["ProcessingStep"]] = relationship(cascade="all, delete-orphan", order_by="ProcessingStep.id")


class Extraction(Base):
    __tablename__ = "extractions"

    email_id: Mapped[str] = mapped_column(ForeignKey("emails.id", ondelete="CASCADE"), primary_key=True)
    summary: Mapped[str] = mapped_column(Text)
    facts_json: Mapped[dict[str, Any]] = mapped_column()  # full ExtractionResult payload
    provider: Mapped[str] = mapped_column(String(32))
    model: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    email: Mapped[Email] = relationship(back_populates="extraction")


class RiskAssessmentRow(Base):
    __tablename__ = "risk_assessments"

    email_id: Mapped[str] = mapped_column(ForeignKey("emails.id", ondelete="CASCADE"), primary_key=True)
    level: Mapped[str] = mapped_column(String(8), index=True)
    rationale: Mapped[str] = mapped_column(Text)
    tags_json: Mapped[list[Any]] = mapped_column(default=list)
    signals_json: Mapped[list[Any]] = mapped_column(default=list)  # deterministic signals fed to Agent B
    provider: Mapped[str] = mapped_column(String(32))
    model: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    email: Mapped[Email] = relationship(back_populates="risk")


class EntityRow(Base):
    __tablename__ = "entities"
    __table_args__ = (UniqueConstraint("type", "canonical_key", name="uq_entity_type_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(32), index=True)
    canonical_key: Mapped[str] = mapped_column(String(320))  # normalised dedup key
    canonical_name: Mapped[str] = mapped_column(String(320))  # display name
    attributes_json: Mapped[dict[str, Any]] = mapped_column(default=dict)


class EntityMention(Base):
    __tablename__ = "entity_mentions"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id", ondelete="CASCADE"), index=True)
    email_id: Mapped[str] = mapped_column(ForeignKey("emails.id", ondelete="CASCADE"), index=True)
    surface_text: Mapped[str] = mapped_column(String(320))


class RelationshipRow(Base):
    __tablename__ = "relationships"
    __table_args__ = (Index("ix_rel_endpoints", "source_entity_id", "target_entity_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source_entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id", ondelete="CASCADE"))
    target_entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(64))
    email_id: Mapped[str] = mapped_column(ForeignKey("emails.id", ondelete="CASCADE"), index=True)
    confidence: Mapped[float] = mapped_column(default=0.7)


class ProcessingStep(Base):
    """One row per pipeline step per run: who handled it, how long, how many tries, what failed."""

    __tablename__ = "processing_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    email_id: Mapped[str] = mapped_column(ForeignKey("emails.id", ondelete="CASCADE"), index=True)
    run: Mapped[int] = mapped_column()
    step: Mapped[str] = mapped_column(String(32))  # extract | assess | persist
    provider: Mapped[str] = mapped_column(String(32), default="")
    model: Mapped[str] = mapped_column(String(128), default="")
    attempts: Mapped[int] = mapped_column(default=1)
    latency_ms: Mapped[int] = mapped_column(default=0)
    outcome: Mapped[str] = mapped_column(String(16))  # ok | repaired | fallback | error
    error: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
