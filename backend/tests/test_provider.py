import pytest

from app.config import Settings
from app.llm import provider
from app.llm.provider import ProviderNotConfigured, get_llm, get_provider_chain


def make(**kw: object) -> Settings:
    return Settings(_env_file=None, **kw)  # type: ignore[call-arg, arg-type]


@pytest.fixture(autouse=True)
def ollama_down(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(provider, "ollama_has_model", lambda *_: False)


def test_unconfigured_providers_are_skipped_so_chain_can_be_empty() -> None:
    assert get_provider_chain(make(LLM_PROVIDER="groq", GROQ_API_KEY="", LLM_FALLBACK_CHAIN="groq,ollama,rules")) == []


def test_chain_order_and_dedup(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(provider, "ollama_has_model", lambda *_: True)
    chain = get_provider_chain(make(LLM_PROVIDER="groq", GROQ_API_KEY="k", LLM_FALLBACK_CHAIN="groq, Ollama ,rules"))
    assert [c.provider for c in chain] == ["groq", "ollama"]


def test_paid_providers_are_dev_only() -> None:
    with pytest.raises(ProviderNotConfigured, match="paid"):
        get_llm(make(LLM_PROVIDER="openai", OPENAI_API_KEY="k"))
    chain = get_provider_chain(make(LLM_PROVIDER="none", OPENAI_API_KEY="k", LLM_FALLBACK_CHAIN="openai,rules"))
    assert chain == []


def test_dev_override_only_applies_in_development() -> None:
    base = {"LLM_PROVIDER": "groq", "GROQ_API_KEY": "k", "GEMINI_API_KEY": "g", "DEV_LLM_PROVIDER": "gemini",
            "DEV_LLM_MODEL": "gemini-x"}  # fmt: skip
    assert get_llm(make(**base)).provider == "groq"
    dev = get_llm(make(APP_ENV="development", **base))
    assert (dev.provider, dev.model) == ("gemini", "gemini-x")


def test_compose_style_comment_values_count_as_empty() -> None:
    settings = make(GROQ_API_KEY="# free, no card: https://console.groq.com/keys", LLM_FALLBACK_CHAIN="groq,rules")
    assert settings.GROQ_API_KEY == ""
    assert get_provider_chain(settings) == []
