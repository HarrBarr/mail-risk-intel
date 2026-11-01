"""Output contracts for Agent A (extraction) and Agent B (risk + graph).

Both the LLM path and the rule-based fallback must produce these exact shapes,
so everything downstream (persistence, API, UI) is agnostic to who produced them.
Validators are deliberately forgiving about *format* (case, synonyms, stray
whitespace) and strict about *structure*: small free-tier models drift on the
former far more often than the latter.
"""

import re
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

RiskLevel = Literal["none", "low", "medium", "high"]
RISK_ORDER: dict[str, int] = {"none": 0, "low": 1, "medium": 2, "high": 3}

EntityType = Literal["person", "organization", "amount", "account", "location", "document", "other"]
FactType = Literal["amount", "date", "account", "reference", "url", "attachment", "other"]

_ENTITY_SYNONYMS = {
    "people": "person",
    "persons": "person",
    "individual": "person",
    "org": "organization",
    "orgs": "organization",
    "organisation": "organization",
    "company": "organization",
    "vendor": "organization",
    "money": "amount",
    "monetary_amount": "amount",
    "bank_account": "account",
    "account_number": "account",
    "place": "location",
    "address": "location",
    "file": "document",
    "attachment": "document",
}

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_ROUTING_PART = re.compile(r"routing(?:\s+(?:number|no\.?|#))?\s*:?\s*\d{9}", re.IGNORECASE)
_ACCOUNT_PART = re.compile(r"account(?:\s+(?:ending(?:\s+in)?|no\.?|number|#))?\s*:?\s*\d{3,}", re.IGNORECASE)

_PLACEHOLDER_TAGS = {"none", "n-a", "null", "no-risk", "routine"}  # models echo the level as a tag

_RISK_SYNONYMS = {"critical": "high", "severe": "high", "moderate": "medium", "minimal": "low"}


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


# ---------------------------------------------------------------- Agent A


class Attachment(BaseModel):
    filename: str
    summary: str = ""


class Fact(BaseModel):
    type: FactType = "other"
    value: str
    context: str = ""

    @field_validator("type", mode="before")
    @classmethod
    def _coerce_type(cls, value: object) -> str:
        slug = _slug(str(value or "other"))
        aliases = {
            "money": "amount",
            "account_number": "account",
            "reference_number": "reference",
            "link": "url",
            "invoice": "reference",
            "deadline": "date",
        }
        slug = aliases.get(slug, slug)
        return slug if slug in FactType.__args__ else "other"  # type: ignore[attr-defined]

    @field_validator("value", mode="before")
    @classmethod
    def _stringify(cls, value: object) -> str:
        return str(value)


class ExtractionResult(BaseModel):
    sender: str = ""
    recipients: list[str] = Field(default_factory=list)
    date: str | None = None
    subject: str = ""
    summary: str = Field(min_length=1)
    key_facts: list[Fact] = Field(default_factory=list)
    attachments: list[Attachment] = Field(default_factory=list)

    @field_validator("recipients", mode="before")
    @classmethod
    def _listify(cls, value: object) -> object:
        if isinstance(value, str):
            return [v.strip() for v in re.split(r"[;,]", value) if v.strip()]
        return value or []


# ---------------------------------------------------------------- Agent B


class RiskAssessment(BaseModel):
    level: RiskLevel
    rationale: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)

    @field_validator("level", mode="before")
    @classmethod
    def _coerce_level(cls, value: object) -> str:
        level = str(value or "").strip().lower()
        return _RISK_SYNONYMS.get(level, level)

    @field_validator("tags", mode="before")
    @classmethod
    def _slug_tags(cls, value: object) -> list[str]:
        tags = value if isinstance(value, list) else []
        seen: list[str] = []
        for tag in tags:
            slug = _slug(str(tag)).replace("_", "-")
            if slug and slug not in seen and slug not in _PLACEHOLDER_TAGS:
                seen.append(slug)
        return seen


class Entity(BaseModel):
    name: str = Field(min_length=1)
    type: EntityType = "other"
    attributes: dict[str, str] = Field(default_factory=dict)

    @field_validator("type", mode="before")
    @classmethod
    def _coerce_type(cls, value: object) -> str:
        slug = _slug(str(value or "other"))
        slug = _ENTITY_SYNONYMS.get(slug, slug)
        return slug if slug in EntityType.__args__ else "other"  # type: ignore[attr-defined]

    @field_validator("attributes", mode="before")
    @classmethod
    def _stringify_attrs(cls, value: object) -> dict[str, str]:
        if not isinstance(value, dict):
            return {}
        return {str(k): str(v) for k, v in value.items() if v not in (None, "")}

    @model_validator(mode="after")
    def _email_addresses_are_people(self) -> "Entity":
        """Small models often type a bare mailbox as 'other' or 'organization'."""
        if _EMAIL_RE.fullmatch(self.name.strip()) and self.type in ("other", "organization"):
            self.type = "person"
        if self.type == "person" and _EMAIL_RE.fullmatch(self.name.strip()):
            self.attributes.setdefault("email", self.name.strip().lower())
        return self


class Relationship(BaseModel):
    source: str = Field(min_length=1)
    type: str = Field(min_length=1)
    target: str = Field(min_length=1)
    confidence: float = Field(default=0.7, ge=0, le=1)

    @field_validator("type", mode="before")
    @classmethod
    def _slug_type(cls, value: object) -> str:
        return _slug(str(value or ""))

    @field_validator("confidence", mode="before")
    @classmethod
    def _clamp(cls, value: object) -> float:
        try:
            return min(1.0, max(0.0, float(value)))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return 0.7


class RiskGraphResult(BaseModel):
    risk: RiskAssessment
    entities: list[Entity] = Field(default_factory=list)
    relationships: list[Relationship] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _split_compound_accounts(cls, data: Any) -> Any:
        """'routing 044000037, account ending 6621' -> two account entities, so each can link across emails."""
        if not isinstance(data, dict) or not isinstance(data.get("entities"), list):
            return data
        entities, renamed = [], {}
        for ent in data["entities"]:
            name = str(ent.get("name", "")) if isinstance(ent, dict) else ""
            routing, account = _ROUTING_PART.search(name), _ACCOUNT_PART.search(name)
            if routing and account and str(ent.get("type", "")).lower() in ("account", "bank_account", "other"):
                parts = [routing.group(0), account.group(0)]
                entities += [{**ent, "name": part, "type": "account"} for part in parts]
                renamed[name.strip().lower()] = parts
            else:
                entities.append(ent)
        if not renamed:
            return data
        relationships = []
        for rel in data.get("relationships") or []:
            if not isinstance(rel, dict):
                continue
            src = renamed.get(str(rel.get("source", "")).strip().lower())
            dst = renamed.get(str(rel.get("target", "")).strip().lower())
            for s in src or [str(rel.get("source", ""))]:
                for t in dst or [str(rel.get("target", ""))]:
                    relationships.append({**rel, "source": s, "target": t})
        return {**data, "entities": entities, "relationships": relationships}

    @model_validator(mode="after")
    def _drop_dangling_relationships(self) -> "RiskGraphResult":
        """Relationships must point at listed entities; models sometimes invent endpoints."""
        names = {e.name.strip().lower() for e in self.entities}
        self.relationships = [
            r
            for r in self.relationships
            if r.source.strip().lower() in names
            and r.target.strip().lower() in names
            and r.source.strip().lower() != r.target.strip().lower()
        ]
        return self
