from collections import Counter
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.schemas import ExtractionResult
from app.api import schemas as s
from app.config import Settings
from app.ingestion.parsers import IngestionError, from_text, from_upload
from app.llm.provider import get_provider_chain
from app.storage import repository as repo
from app.storage.db import Database
from app.storage.models import Email

router = APIRouter(prefix="/api")


def get_db(request: Request) -> Database:
    return request.app.state.db  # type: ignore[no-any-return]


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings  # type: ignore[no-any-return]


def session_dep(db: Annotated[Database, Depends(get_db)]):  # type: ignore[no-untyped-def]
    with db.session() as session:
        yield session


SessionDep = Annotated[Session, Depends(session_dep)]


# ----------------------------------------------------------------- health


@router.get("/health", response_model=s.Health)
def health(session: SessionDep, settings: Annotated[Settings, Depends(get_settings_dep)]) -> s.Health:
    chain = [c.provider for c in get_provider_chain(settings)]
    queue = Counter(session.scalars(select(Email.status)))
    return s.Health(status="ok", mode="llm" if chain else "rules", providers=[*chain, "rules"], queue=dict(queue))


# ----------------------------------------------------------------- emails


def _summary(email: Email) -> s.EmailSummary:
    return s.EmailSummary(
        id=email.id,
        source=email.source,
        sender=email.sender,
        subject=email.subject,
        date=email.date,
        status=email.status,  # type: ignore[arg-type]
        risk_level=email.risk.level if email.risk else None,  # type: ignore[arg-type]
        risk_tags=list(email.risk.tags_json) if email.risk else [],
        summary=email.extraction.summary if email.extraction else None,
        processed_by=email.risk.provider if email.risk else None,
        error=email.error,
    )


@router.get("/emails", response_model=s.EmailList)
def list_emails(
    session: SessionDep,
    risk: Annotated[s.Level | None, Query()] = None,
    status_: Annotated[s.Status | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> s.EmailList:
    items, total = repo.list_emails(session, risk=risk, status=status_, q=q, limit=limit, offset=offset)
    return s.EmailList(items=[_summary(e) for e in items], total=total)


@router.post("/emails", response_model=s.Accepted, status_code=status.HTTP_202_ACCEPTED)
async def create_email(
    request: Request, session: SessionDep, settings: Annotated[Settings, Depends(get_settings_dep)]
) -> s.Accepted:
    """JSON `{"raw_text": "..."}` or multipart with a `file` field (.txt / .pdf / .eml)."""
    content_type = request.headers.get("content-type", "")
    try:
        if content_type.startswith("multipart/form-data"):
            form = await request.form()
            upload = form.get("file")
            if upload is None or isinstance(upload, str):
                raise IngestionError("Attach a file in the 'file' field.")
            data = await upload.read(settings.MAX_UPLOAD_BYTES + 1)
            raw = from_upload(upload.filename or "", data, settings.MAX_UPLOAD_BYTES)
        elif content_type.startswith("application/json"):
            try:
                body = s.CreateEmailText.model_validate_json(await request.body())
            except ValidationError as exc:
                raise IngestionError('Body must be JSON like {"raw_text": "..."} with non-empty text.') from exc
            raw = from_text(body.raw_text)
        else:
            raise HTTPException(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                "Send application/json {raw_text} or multipart/form-data with a file.",
            )
    except IngestionError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc

    repo.insert_email(session, raw)
    return s.Accepted(id=raw.id, status="pending")


@router.get("/emails/{email_id}", response_model=s.EmailDetail)
def get_email(email_id: str, session: SessionDep) -> s.EmailDetail:
    email = repo.get_email(session, email_id)
    if email is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Email not found")
    entities, rels = repo.entities_for_email(session, email_id)
    names = {e.id: e.canonical_name for e in entities}
    latest_run = max((st.run for st in email.steps), default=0)
    return s.EmailDetail(
        id=email.id,
        source=email.source,
        sender=email.sender,
        recipients=list(email.recipients_json or []),
        subject=email.subject,
        date=email.date,
        status=email.status,  # type: ignore[arg-type]
        error=email.error,
        raw_content=email.raw_content,
        body=email.body,
        attachments=[s.Attachment(**a) for a in email.attachments_json or []],
        extraction=s.ExtractionOut(
            result=ExtractionResult.model_validate(email.extraction.facts_json),
            provider=email.extraction.provider,
            model=email.extraction.model,
        )
        if email.extraction
        else None,
        risk=s.RiskOut(
            level=email.risk.level,  # type: ignore[arg-type]
            rationale=email.risk.rationale,
            tags=list(email.risk.tags_json),
            signals=[s.SignalOut.model_validate(sig) for sig in email.risk.signals_json],
            provider=email.risk.provider,
            model=email.risk.model,
        )
        if email.risk
        else None,
        entities=[
            s.EntityOut(id=e.id, name=e.canonical_name, type=e.type, attributes=e.attributes_json or {})
            for e in entities
        ],
        relationships=[
            s.RelationshipOut(
                id=r.id,
                source_id=r.source_entity_id,
                target_id=r.target_entity_id,
                source=names.get(r.source_entity_id, "?"),
                target=names.get(r.target_entity_id, "?"),
                type=r.type,
                confidence=r.confidence,
            )
            for r in rels
        ],
        steps=[s.StepOut.model_validate(st, from_attributes=True) for st in email.steps if st.run == latest_run],
    )


@router.post("/emails/{email_id}/reprocess", response_model=s.Accepted, status_code=status.HTTP_202_ACCEPTED)
def reprocess(email_id: str, session: SessionDep) -> s.Accepted:
    email = session.get(Email, email_id)
    if email is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Email not found")
    if not repo.requeue(session, email_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email is already being processed")
    return s.Accepted(id=email_id, status="pending")


@router.post("/emails/reprocess-all", status_code=status.HTTP_202_ACCEPTED)
def reprocess_all(session: SessionDep) -> dict[str, int]:
    return {"requeued": repo.requeue_all(session)}


# ----------------------------------------------------------------- graph


@router.get("/graph", response_model=s.Graph)
def graph(session: SessionDep, min_risk: Annotated[s.Level | None, Query()] = None) -> s.Graph:
    return s.Graph.model_validate(repo.knowledge_graph(session, min_risk))
