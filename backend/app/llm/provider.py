"""Provider factory and the ordered fallback chain.

`get_provider_chain()` returns the LLM clients to try, in order. A provider that
is not configured (e.g. groq with no key) is skipped at build time rather than
failing at call time. 'rules' is not an LLM: the orchestrator falls through to
it when this list is exhausted, so an empty list simply means "rules only".
"""

import time
from dataclasses import dataclass
from typing import Any

import httpx
import structlog
from langchain_core.language_models import BaseChatModel
from pydantic import SecretStr

from app.config import Settings

log = structlog.get_logger()

PAID_PROVIDERS = {"openai", "anthropic"}


@dataclass
class LLMClient:
    provider: str
    model: str
    chat: BaseChatModel


class ProviderNotConfigured(RuntimeError):
    pass


_probe_cache: dict[tuple[str, str], tuple[float, bool]] = {}
PROBE_TTL_SECONDS = 30.0


def ollama_has_model(base_url: str, model: str) -> bool:
    """Ollama needs no key, so 'configured' means 'reachable and the model is pulled'. Cached briefly."""
    key = (base_url, model)
    cached = _probe_cache.get(key)
    if cached and time.monotonic() - cached[0] < PROBE_TTL_SECONDS:
        return cached[1]
    try:
        tags = httpx.get(f"{base_url.rstrip('/')}/api/tags", timeout=2).json().get("models", [])
        names = {t.get("name", "") for t in tags} | {t.get("model", "") for t in tags}
        ok = model in names or f"{model}:latest" in names
    except (httpx.HTTPError, ValueError):
        ok = False
    _probe_cache[key] = (time.monotonic(), ok)
    return ok


def build_chat_model(provider: str, model: str | None, settings: Settings) -> LLMClient:
    timeout = settings.LLM_TIMEOUT_SECONDS
    # Retries are handled by our own tenacity policy (see llm/invoke.py), so SDK retries are off.
    if provider == "groq":
        if not settings.GROQ_API_KEY:
            raise ProviderNotConfigured("GROQ_API_KEY is not set")
        from langchain_groq import ChatGroq

        name = model or settings.GROQ_MODEL
        chat: Any = ChatGroq(
            model=name,
            api_key=SecretStr(settings.GROQ_API_KEY),
            temperature=0,
            timeout=timeout,
            max_retries=0,
            model_kwargs={"response_format": {"type": "json_object"}},
        )
    elif provider == "gemini":
        if not settings.GEMINI_API_KEY:
            raise ProviderNotConfigured("GEMINI_API_KEY is not set")
        from langchain_google_genai import ChatGoogleGenerativeAI

        name = model or settings.GEMINI_MODEL
        chat = ChatGoogleGenerativeAI(
            model=name,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0,
            timeout=timeout,
            max_retries=0,
            response_mime_type="application/json",
        )
    elif provider == "ollama":
        from langchain_ollama import ChatOllama

        name = model or settings.OLLAMA_MODEL
        if not ollama_has_model(settings.OLLAMA_BASE_URL, name):
            raise ProviderNotConfigured(f"Ollama at {settings.OLLAMA_BASE_URL} is unreachable or has not pulled {name}")
        chat = ChatOllama(
            model=name,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=0,
            format="json",
            client_kwargs={"timeout": timeout},
        )
    elif provider == "openai":
        if not settings.OPENAI_API_KEY:
            raise ProviderNotConfigured("OPENAI_API_KEY is not set")
        from langchain_openai import ChatOpenAI  # dev extra only

        name = model or "gpt-4o-mini"
        chat = ChatOpenAI(
            model=name,
            api_key=SecretStr(settings.OPENAI_API_KEY),
            temperature=0,
            timeout=timeout,
            max_retries=0,
            model_kwargs={"response_format": {"type": "json_object"}},
        )
    elif provider == "anthropic":
        if not settings.ANTHROPIC_API_KEY:
            raise ProviderNotConfigured("ANTHROPIC_API_KEY is not set")
        from langchain_anthropic import ChatAnthropic  # dev extra only

        name = model or "claude-haiku-5-5"
        chat = ChatAnthropic(  # type: ignore[call-arg]
            model_name=name,
            api_key=SecretStr(settings.ANTHROPIC_API_KEY),
            temperature=0,
            timeout=timeout,
            max_retries=0,
        )
    else:
        raise ProviderNotConfigured(f"unknown provider '{provider}'")
    return LLMClient(provider=provider, model=name, chat=chat)


def get_llm(settings: Settings) -> LLMClient:
    """The primary model. In development, DEV_LLM_PROVIDER overrides it without touching the default."""
    provider, model = settings.LLM_PROVIDER, None
    if settings.APP_ENV == "development" and settings.DEV_LLM_PROVIDER:
        provider, model = settings.DEV_LLM_PROVIDER, settings.DEV_LLM_MODEL or None
    if provider in PAID_PROVIDERS and settings.APP_ENV != "development":
        raise ProviderNotConfigured(f"'{provider}' is a paid provider and is only allowed in development")
    return build_chat_model(provider, model, settings)


def get_provider_chain(settings: Settings) -> list[LLMClient]:
    chain: list[LLMClient] = []
    seen: set[str] = set()

    def try_add(build: Any, label: str) -> None:
        try:
            client = build()
        except (ProviderNotConfigured, ImportError) as exc:
            log.info("provider_skipped", provider=label, reason=str(exc))
            return
        if client.provider not in seen:
            seen.add(client.provider)
            chain.append(client)

    if settings.LLM_PROVIDER != "none":
        try_add(lambda: get_llm(settings), settings.LLM_PROVIDER)
    for name in settings.fallback_chain:
        if name in ("rules", "none") or name in seen:
            continue
        if name in PAID_PROVIDERS and settings.APP_ENV != "development":
            continue
        try_add(lambda n=name: build_chat_model(n, None, settings), name)
    return chain
