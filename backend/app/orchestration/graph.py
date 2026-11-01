"""The two-agent pipeline as a LangGraph state machine.

    start ─▶ extract ─▶ validate_extraction ──ok──▶ context ─▶ assess ─▶ validate_assessment ──ok──▶ persist
                ▲               │ │                              ▲               │ │
                └─repair/next───┘ └─exhausted─▶ fallback_extract └─repair/next───┘ └─exhausted─▶ fallback_assess
                                                  └─▶ context                                     └─▶ persist

Per stage, the policy is:
- a provider call that fails (after transport retries in llm/invoke.py) -> try the next provider in the chain;
- output that is not valid JSON / fails the schema -> one repair retry on the same provider,
  with the validator's error in the prompt; if that also fails, try the next provider;
- no providers left -> the rule-based fallback for that stage. The pipeline always completes.

Agent B is only ever given Agent A's structured output (plus code-derived signals and sender
history), never the raw email, which keeps the two agents' responsibilities separate.
"""

import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, TypedDict, cast

import structlog
from langchain_core.messages import BaseMessage
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, ValidationError

from app.agents import extraction as agent_a
from app.agents import fallback
from app.agents import risk_graph as agent_b
from app.agents.entities import enrich_graph
from app.agents.schemas import ExtractionResult, RiskGraphResult
from app.agents.signals import Signal, detect, domain_of, history_from_texts, registered_domain
from app.config import Settings
from app.llm.invoke import LLMCallError, invoke_text, parse_json_object
from app.llm.provider import LLMClient
from app.storage import repository as repo
from app.storage.db import Database
from app.storage.models import EmailStatus

log = structlog.get_logger()


# Per-agent-stage scratch state. A plain dict (not a TypedDict) because nodes update it piecemeal.
# Keys: provider_index (next client in the chain), raw_output (last model text awaiting validation),
# repair ((bad output, validator error) to send on the next call), repaired (repair retry used on
# this provider), call_failed, result (validated payload), provider, model, attempts, latency_ms,
# errors, outcome (ok | repaired | fallback).
StageState = dict[str, Any]


class PipelineState(TypedDict, total=False):
    email_id: str
    run: int
    raw_content: str
    body: str
    sender: str
    recipients: list[str]
    extract: StageState
    assess: StageState
    signals: list[dict[str, Any]]
    history: dict[str, Any] | None
    floor_applied: bool
    unreachable: list[str]  # providers whose calls failed this run; later stages skip them


@dataclass
class PipelineDeps:
    db: Database
    chain: list[LLMClient]
    settings: Settings


def _stage(state: PipelineState, name: str) -> StageState:
    """Copy of one stage's scratch state (nodes return updates; they never mutate state in place)."""
    return dict(cast(dict[str, Any], state).get(name) or {})


def _signals(state: PipelineState) -> list[Signal]:
    return [Signal(**s) for s in state.get("signals", [])]


def _stage_nodes(
    name: str,
    schema: type[BaseModel],
    build_messages: Callable[[PipelineState, tuple[str, str] | None], list[BaseMessage]],
    deps: PipelineDeps,
) -> tuple[Callable[..., dict[str, Any]], Callable[..., dict[str, Any]], Callable[..., str]]:
    """Build the (call, validate, route) trio for one agent stage."""

    def call(state: PipelineState) -> dict[str, Any]:
        stage: StageState = _stage(state, name)
        idx = stage.get("provider_index", 0)
        client = deps.chain[idx]
        stage.setdefault("errors", [])
        update: dict[str, Any] = {}
        try:
            text, attempts, latency = invoke_text(
                client, build_messages(state, stage.get("repair")), deps.settings.LLM_MAX_RETRIES
            )
            stage.update(raw_output=text, call_failed=False)
        except LLMCallError as exc:
            attempts, latency = exc.attempts, 0
            stage.update(raw_output=None, call_failed=True)
            stage["errors"] = [*stage["errors"], str(exc)]
            update["unreachable"] = [*state.get("unreachable", []), client.provider]
            log.warning("llm_call_failed", stage=name, email_id=state["email_id"], error=str(exc))
        stage.update(
            provider=client.provider,
            model=client.model,
            attempts=stage.get("attempts", 0) + attempts,
            latency_ms=stage.get("latency_ms", 0) + latency,
        )
        return {name: stage, **update}

    def validate(state: PipelineState) -> dict[str, Any]:
        stage: StageState = _stage(state, name)
        idx = stage.get("provider_index", 0)

        def next_provider() -> None:
            stage.update(provider_index=idx + 1, repair=None, repaired=False)

        if stage.get("call_failed"):
            next_provider()
            return {name: stage}
        output = stage.get("raw_output") or ""
        try:
            parsed = schema.model_validate(parse_json_object(output))
        except (ValueError, ValidationError) as exc:
            error = str(exc)[:1500]
            stage["errors"] = [*stage.get("errors", []), f"{stage.get('provider')}: invalid output: {error[:300]}"]
            if stage.get("repaired"):
                next_provider()
            else:
                stage.update(repair=(output, error), repaired=True)
            log.info("llm_output_invalid", stage=name, email_id=state["email_id"], repaired=stage["repaired"])
            return {name: stage}
        stage.update(result=parsed.model_dump(), outcome="repaired" if stage.get("repaired") else "ok", repair=None)
        return {name: stage}

    def route(state: PipelineState) -> str:
        stage = _stage(state, name)
        if stage.get("result") is not None:
            return "done"
        if stage.get("provider_index", 0) < len(deps.chain):
            return "retry"
        return "fallback"

    return call, validate, route


def _record_step(deps: PipelineDeps, state: PipelineState, step: str, stage: StageState) -> None:
    with deps.db.session() as s:
        repo.add_step(
            s,
            state["email_id"],
            state["run"],
            step=step,
            provider=stage.get("provider", "rules"),
            model=stage.get("model", ""),
            attempts=stage.get("attempts", 0),
            latency_ms=stage.get("latency_ms", 0),
            outcome=stage.get("outcome", "ok"),
            error="\n".join(stage.get("errors", [])) or None,
        )


def build_pipeline(deps: PipelineDeps) -> Any:
    org = deps.settings.ORG_DOMAIN

    def extraction_messages(state: PipelineState, repair: tuple[str, str] | None) -> list[BaseMessage]:
        return agent_a.build_messages(state["raw_content"], repair)

    def assessment_messages(state: PipelineState, repair: tuple[str, str] | None) -> list[BaseMessage]:
        return agent_b.build_messages(
            state["extract"]["result"] or {}, _signals(state), state.get("history"), org, repair
        )

    call_a, validate_a, route_a = _stage_nodes("extract", ExtractionResult, extraction_messages, deps)
    call_b, validate_b, route_b = _stage_nodes("assess", RiskGraphResult, assessment_messages, deps)

    def start(state: PipelineState) -> dict[str, Any]:
        return {"extract": {"provider_index": 0}, "assess": {"provider_index": 0}, "unreachable": []}

    def fallback_extract(state: PipelineState) -> dict[str, Any]:
        with deps.db.session() as s:
            email = repo.get_email(s, state["email_id"])
            assert email is not None
            raw = repo.to_raw(email)
        stage: StageState = dict(state["extract"])
        stage.update(result=fallback.extract(raw).model_dump(), provider="rules", model="", outcome="fallback")
        return {"extract": stage}

    def context(state: PipelineState) -> dict[str, Any]:
        _record_step(deps, state, "extract", state["extract"])
        with deps.db.session() as s:
            repo.set_status(s, state["email_id"], EmailStatus.ASSESSING)
            email = repo.get_email(s, state["email_id"])
            assert email is not None
            prior = repo.prior_from_same_domain(s, email)
        extraction = state["extract"]["result"] or {}
        recipients = state["recipients"] or extraction.get("recipients", [])
        sender = state["sender"] or extraction.get("sender", "")
        history = history_from_texts(registered_domain(domain_of(sender)), prior)
        signals = detect(state["raw_content"], sender, recipients, org, history)
        # Sticky failover: don't make Agent B wait out the timeouts Agent A already hit.
        unreachable = set(state.get("unreachable", []))
        first_live = next((i for i, c in enumerate(deps.chain) if c.provider not in unreachable), len(deps.chain))
        return {
            "signals": [s.__dict__ for s in signals],
            "history": None if history.is_empty() else history.to_prompt(),
            "assess": {"provider_index": first_live},
        }

    def fallback_assess(state: PipelineState) -> dict[str, Any]:
        extraction = ExtractionResult.model_validate(state["extract"]["result"])
        stage: StageState = dict(state["assess"])
        result = fallback.assess(extraction, _signals(state), state["body"])
        stage.update(result=result.model_dump(), provider="rules", model="", outcome="fallback")
        return {"assess": stage}

    def persist(state: PipelineState) -> dict[str, Any]:
        signals = _signals(state)
        extraction = ExtractionResult.model_validate(state["extract"]["result"])
        graph = enrich_graph(RiskGraphResult.model_validate(state["assess"]["result"]), extraction)
        graph, floor_applied = agent_b.merge_risk(graph, signals)
        _record_step(deps, state, "assess", state["assess"])
        ex, asm = state["extract"], state["assess"]
        start_t = time.monotonic()
        with deps.db.session() as s:
            repo.save_results(
                s,
                state["email_id"],
                extraction,
                {"provider": ex.get("provider", "rules"), "model": ex.get("model", "")},
                graph,
                {"provider": asm.get("provider", "rules"), "model": asm.get("model", "")},
                signals,
            )
            repo.prune_orphan_entities(s)
            repo.add_step(
                s,
                state["email_id"],
                state["run"],
                step="persist",
                provider="sqlite",
                latency_ms=int((time.monotonic() - start_t) * 1000),
                outcome="ok",
                attempts=1,
            )
        return {"floor_applied": floor_applied}

    g = StateGraph(PipelineState)
    g.add_node("start", start)
    g.add_node("extract", call_a)
    g.add_node("validate_extraction", validate_a)
    g.add_node("fallback_extract", fallback_extract)
    g.add_node("context", context)
    g.add_node("assess", call_b)
    g.add_node("validate_assessment", validate_b)
    g.add_node("fallback_assess", fallback_assess)
    g.add_node("persist", persist)

    g.set_entry_point("start")
    g.add_conditional_edges(
        "start", lambda _s: "llm" if deps.chain else "rules", {"llm": "extract", "rules": "fallback_extract"}
    )
    g.add_edge("extract", "validate_extraction")
    g.add_conditional_edges(
        "validate_extraction", route_a, {"done": "context", "retry": "extract", "fallback": "fallback_extract"}
    )
    g.add_edge("fallback_extract", "context")
    g.add_conditional_edges(
        "context",
        lambda s: "llm" if s["assess"]["provider_index"] < len(deps.chain) else "rules",
        {"llm": "assess", "rules": "fallback_assess"},
    )
    g.add_edge("assess", "validate_assessment")
    g.add_conditional_edges(
        "validate_assessment", route_b, {"done": "persist", "retry": "assess", "fallback": "fallback_assess"}
    )
    g.add_edge("fallback_assess", "persist")
    g.add_edge("persist", END)
    return g.compile()


def run_pipeline(deps: PipelineDeps, email_id: str, pipeline: Any | None = None) -> PipelineState:
    """Process one email end to end. Unexpected errors mark the email 'failed' instead of raising."""
    pipeline = pipeline or build_pipeline(deps)
    with deps.db.session() as s:
        email = repo.get_email(s, email_id)
        if email is None:
            raise LookupError(email_id)
        run = repo.next_run_number(s, email_id)
        state: PipelineState = {
            "email_id": email_id,
            "run": run,
            "raw_content": email.raw_content,
            "body": email.body,
            "sender": email.sender,
            "recipients": list(email.recipients_json or []),
        }
        repo.set_status(s, email_id, EmailStatus.EXTRACTING)
    try:
        # Worst case per stage: (providers x 2 calls) + fallback + bookkeeping nodes.
        limit = 10 + 6 * (len(deps.chain) + 1)
        return pipeline.invoke(state, {"recursion_limit": limit})  # type: ignore[no-any-return]
    except Exception as exc:  # noqa: BLE001 - one bad email must not take the worker down
        log.exception("pipeline_failed", email_id=email_id)
        with deps.db.session() as s:
            repo.set_status(s, email_id, EmailStatus.FAILED, f"{type(exc).__name__}: {exc}"[:1000])
            repo.add_step(s, email_id, run, step="pipeline", outcome="error", error=str(exc)[:1000])
        return state
