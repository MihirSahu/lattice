SHELL := /bin/bash

COMPOSE_FILE := infra/docker/docker-compose.yml
COMPOSE_FLAGS := --env-file .env -f $(COMPOSE_FILE)
ifeq ($(SUBSCRIPTION),1)
COMPOSE_FLAGS += -f infra/docker/docker-compose.subscription.yml
endif

-include .env
export

.PHONY: up down logs ps web sync status lint-shell

up:
	docker compose $(COMPOSE_FLAGS) up --build -d

up-attached:
	docker compose $(COMPOSE_FLAGS) up --build

down:
	docker compose $(COMPOSE_FLAGS) down

logs:
	docker compose $(COMPOSE_FLAGS) logs -f

ps:
	docker compose $(COMPOSE_FLAGS) ps

web:
	sfw pnpm --filter lattice-web dev

sync:
	curl -fsS -X POST http://localhost:$${SYNC_WORKER_PORT:-4000}/run -H 'content-type: application/json' -d '{"trigger":"manual"}'

status:
	curl -fsS http://localhost:$${SYNC_WORKER_PORT:-4000}/status

lint-shell:
	bash -n scripts/sync-vault.sh scripts/healthcheck.sh services/scheduler/entrypoint.sh
