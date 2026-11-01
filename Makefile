.PHONY: up up-local dev test test-backend test-frontend test-live lint reset-db reprocess

COMPOSE = docker compose
DEV = $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml

up:            ## Demo mode on http://localhost:8080
	$(COMPOSE) up --build

up-local:      ## Demo mode with a local Ollama model (no key needed)
	OLLAMA_BASE_URL=http://ollama:11434 $(COMPOSE) --profile local up --build

dev:           ## Hot-reload dev mode on http://localhost:5173
	$(DEV) up --build

test: test-backend test-frontend

test-backend:
	cd backend && (test -d .venv || (uv venv --python 3.12 && uv pip install -e ".[dev]")) && .venv/bin/pytest -q

test-frontend:
	cd frontend && (test -d node_modules || npm ci) && npm test

test-live:     ## Hits your configured provider
	cd backend && .venv/bin/pytest -m live -q

lint:
	cd backend && .venv/bin/ruff check app tests && .venv/bin/ruff format --check app tests && .venv/bin/mypy app
	cd frontend && npm run lint && npx tsc --noEmit -p tsconfig.app.json

reset-db:      ## Delete the SQLite volume; the api re-seeds on next start
	$(COMPOSE) down
	docker volume rm $$(basename $$(pwd))_db-data || true

reprocess:     ## Re-run the pipeline on every email (e.g. after a prompt change)
	curl -fsS -X POST http://localhost:8000/api/emails/reprocess-all && echo
