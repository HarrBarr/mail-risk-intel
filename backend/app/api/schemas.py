"""HTTP response/request models: the API contract the frontend validates against (with zod)."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.agents.schemas import ExtractionResult

Status = Literal["pending", "extracting", "assessing", "done", "failed"]
Level = Literal["none", "low", "medium", "high"]


class EmailSummary(BaseModel):
    id: str
    source: str
    sender: str
    subject: str
    date: datetime | None
    status: Status
    risk_level: Level | None
    risk_tags: list[str]
    summary: str | None
    processed_by: str | None  # provider of the risk step: groq | ollama | rules | ...
    error: str | None


class EmailList(BaseModel):
    items: list[EmailSummary]
    total: int


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
    created_at: datetime


class EmailDetail(BaseModel):
    id: str
    source: str
    sender: str
    recipients: list[str]
    subject: str
    date: datetime | None
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
