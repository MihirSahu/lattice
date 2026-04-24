SHELL := /bin/bash

COMPOSE_FILE := infra/docker/docker-compose.yml

-include .env
export

.PHONY: up down logs ps web sync status lint-shell

up:
	docker compose --env-file .env -f $(COMPOSE_FILE) up --build -d

up-attached:
	docker compose --env-file .env -f $(COMPOSE_FILE) up --build -d

down:
	docker compose --env-file .env -f $(COMPOSE_FILE) down

logs:
	docker compose --env-file .env -f $(COMPOSE_FILE) logs -f

ps:
	docker compose --env-file .env -f $(COMPOSE_FILE) ps

web:
	cd apps/web && npm run dev

sync:
	curl -fsS -X POST http://localhost:$${SYNC_WORKER_PORT:-4000}/run -H 'content-type: application/json' -d '{"trigger":"manual"}'

status:
	curl -fsS http://localhost:$${SYNC_WORKER_PORT:-4000}/status

lint-shell:
	bash -n scripts/sync-vault.sh scripts/run-qmd-update.sh scripts/run-qmd-embed.sh scripts/healthcheck.sh services/scheduler/entrypoint.sh
