"""Runtime configuration, loaded from environment variables / .env."""

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Provider = Literal["groq", "gemini", "ollama", "openai", "anthropic", "none"]


class Settings(BaseSettings):
    # The repo-root .env (shared with docker compose) and then backend/.env; later files win.
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    APP_ENV: Literal["production", "development"] = "production"

    LLM_PROVIDER: Provider = "groq"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"

    # Development-only override (ignored unless APP_ENV=development).
    DEV_LLM_PROVIDER: Provider | Literal[""] = ""
    DEV_LLM_MODEL: str = ""
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # Tried in order; 'rules' is always appended as the last resort.
    LLM_FALLBACK_CHAIN: str = "groq,ollama,rules"

    LLM_TIMEOUT_SECONDS: float = 30
    LLM_MAX_RETRIES: int = 2
    WORKER_CONCURRENCY: int = 2
    WORKER_POLL_INTERVAL_SECONDS: float = 2

    DATABASE_URL: str = "sqlite:///./dev.db"
    SEED_ON_STARTUP: bool = True
    SEED_FILE: str = "../data/mock_mailbox_data.json"
    MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024

    # The organisation's own domain: used to spot lookalike / spoofed senders.
    ORG_DOMAIN: str = "arcline.com"

    @field_validator("LLM_FALLBACK_CHAIN")
    @classmethod
    def _normalise_chain(cls, value: str) -> str:
        return ",".join(p.strip().lower() for p in value.split(",") if p.strip())

    @property
    def fallback_chain(self) -> list[str]:
        return self.LLM_FALLBACK_CHAIN.split(",") if self.LLM_FALLBACK_CHAIN else []


@lru_cache
def get_settings() -> Settings:
    return Settings()
