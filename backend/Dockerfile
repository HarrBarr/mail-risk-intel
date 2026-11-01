FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /usr/local/bin/uv
WORKDIR /app

# Dependencies first for layer caching. INSTALL_DEV=1 adds the dev extra (tests, paid SDKs for dev only).
ARG INSTALL_DEV=0
COPY pyproject.toml ./
RUN mkdir app && touch app/__init__.py \
    && if [ "$INSTALL_DEV" = "1" ]; then uv pip install --system ".[dev]"; else uv pip install --system .; fi

COPY app ./app
COPY tests ./tests
RUN uv pip install --system --no-deps . && mkdir -p /data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
