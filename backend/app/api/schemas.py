"""HTTP response/request models: the API contract the frontend validates against (with zod)."""

from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, Field

from app.agents.schemas import ExtractionResult


def _as_utc(value: datetime | None) -> datetime | None:
    return value.replace(tzinfo=UTC) if value is not None and value.tzinfo is None else value


UTCDateTime = Annotated[datetime, AfterValidator(_as_utc)]


Status = Literal["pending", "extracting", "assessing", "done", "failed"]
Level = Literal["none", "low", "medium", "high"]


class EmailSummary(BaseModel):
    id: str
    source: str
    sender: str
    subject: str
    date: UTCDateTime | None
    status: Status
    risk_level: Level | None
    risk_tags: list[str]
    summary: str | None
    processed_by: str | None  # provider of the risk step: groq | ollama | rules | ...
    error: str | None


class EmailList(BaseModel):
    items: list[EmailSummary]
    total: int
    in_flight: int  # mailbox-wide, ignoring filters: lets the UI keep polling under a risk filter


class Attachment(BaseModel):
    filename: str
    extracted_text: str


class SignalOut(BaseModel):
    tag: str
    weight: int
    evidence: str


class RiskOut(BaseModel):
    level: Level
    rationale: str
    tags: list[str]
    signals: list[SignalOut]
    provider: str
    model: str


class ExtractionOut(BaseModel):
    result: ExtractionResult
    provider: str
    model: str


class EntityOut(BaseModel):
    id: int
    name: str
    type: str
    attributes: dict[str, Any]


class RelationshipOut(BaseModel):
    id: int
    source_id: int
    target_id: int
    source: str
    target: str
    type: str
    confidence: float


class StepOut(BaseModel):
    run: int
    step: str
    provider: str
    model: str
    attempts: int
    latency_ms: int
    outcome: str
    error: str | None
    created_at: UTCDateTime


class EmailDetail(BaseModel):
    id: str
    source: str
    sender: str
    recipients: list[str]
    subject: str
    date: UTCDateTime | None
    status: Status
    error: str | None
    raw_content: str
    body: str
    attachments: list[Attachment]
    extraction: ExtractionOut | None
    risk: RiskOut | None
    entities: list[EntityOut]
    relationships: list[RelationshipOut]
    steps: list[StepOut]


class CreateEmailText(BaseModel):
    raw_text: str = Field(min_length=1, max_length=200_000)


class Accepted(BaseModel):
    id: str
    status: Status


class GraphNode(BaseModel):
    id: int
    name: str
    type: str
    attributes: dict[str, Any]
    email_ids: list[str]
    mention_count: int
    max_risk: Level


class GraphEdge(BaseModel):
    source: int
    target: int
    type: str
    email_ids: list[str]
    confidence: float


class Graph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class Health(BaseModel):
    status: Literal["ok"]
    mode: Literal["llm", "rules"]
    providers: list[str]  # the chain in order, always ending in 'rules'
    queue: dict[str, int]  # emails per status
