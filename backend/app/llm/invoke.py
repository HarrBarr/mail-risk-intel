"""Calling a model robustly: transient-error retries with backoff, and JSON extraction.

Error policy:
- transient (timeout, connection, 429, 5xx) -> retry with exponential backoff,
  honouring Retry-After when the provider sends one;
- permanent (401/403/404, bad request) -> give up on this provider immediately
  so the orchestrator can move to the next one in the chain.
"""

import json
import re
import time
from typing import Any

from langchain_core.messages import BaseMessage
from tenacity import (
    RetryCallState,
    Retrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.llm.provider import LLMClient

# Seconds; module-level so tests can set it to 0.
BACKOFF_SECONDS = 1.0

_TRANSIENT_NAMES = (
    "timeout",
    "connect",
    "ratelimit",
    "serviceunavailable",
    "internalserver",
    "apiconnection",
    "resourceexhausted",
    "remoteprotocol",
    "readerror",
)


class LLMCallError(RuntimeError):
    def __init__(self, provider: str, message: str, attempts: int) -> None:
        super().__init__(f"{provider}: {message}")
        self.provider = provider
        self.attempts = attempts


def _status_code(exc: BaseException) -> int | None:
    for attr in ("status_code", "code", "status"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    response = getattr(exc, "response", None)
    value = getattr(response, "status_code", None)
    return value if isinstance(value, int) else None


def is_transient(exc: BaseException) -> bool:
    status = _status_code(exc)
    if status is not None:
        return status == 429 or status >= 500 or status == 408
    if isinstance(exc, TimeoutError | ConnectionError):
        return True
    name = type(exc).__name__.lower()
    return any(token in name for token in _TRANSIENT_NAMES)


def _retry_after(exc: BaseException | None) -> float | None:
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", None) or {}
    try:
        value = headers.get("retry-after") or headers.get("Retry-After")
        return float(value) if value is not None else None
    except (TypeError, ValueError, AttributeError):
        return None


def _wait(base: wait_exponential, cap: float) -> Any:
    def wait(state: RetryCallState) -> float:
        exc = state.outcome.exception() if state.outcome else None
        hinted = _retry_after(exc)
        return min(cap, hinted) if hinted is not None else base(state)

    return wait


def invoke_text(
    client: LLMClient, messages: list[BaseMessage], max_retries: int, max_wait: float = 20.0
) -> tuple[str, int, int]:
    """Return (text, attempts, latency_ms). Raises LLMCallError when this provider is exhausted."""
    attempts = 0
    start = time.monotonic()
    retrying = Retrying(
        stop=stop_after_attempt(max_retries + 1),
        wait=_wait(wait_exponential(multiplier=BACKOFF_SECONDS, min=BACKOFF_SECONDS, max=max_wait), max_wait),
        retry=retry_if_exception(is_transient),
        reraise=True,
    )
    try:
        for attempt in retrying:
            with attempt:
                attempts += 1
                response = client.chat.invoke(messages)
    except Exception as exc:  # noqa: BLE001 - every provider SDK has its own hierarchy
        raise LLMCallError(client.provider, f"{type(exc).__name__}: {exc}"[:500], attempts) from exc
    content = response.content
    if isinstance(content, list):  # some providers return content blocks
        content = "".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in content)
    return str(content), attempts, int((time.monotonic() - start) * 1000)


_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def parse_json_object(text: str) -> dict[str, Any]:
    """Pull a JSON object out of model output that may be fenced or wrapped in prose."""
    candidates = [text.strip()]
    candidates += [m.strip() for m in _FENCE_RE.findall(text)]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])
    for candidate in candidates:
        try:
            value = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    raise ValueError("response is not a JSON object")
