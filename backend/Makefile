.PHONY: dev db migrate install

install:
	uv venv && uv pip install -e ".[dev]"

dev:
	.venv/bin/uvicorn app.main:app --reload --port 8001

db:
	podman compose up -d db

migrate:
	.venv/bin/alembic upgrade head
