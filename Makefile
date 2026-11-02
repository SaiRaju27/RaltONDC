# ==============================================================================
# RALT ONDC Logistics Service Provider (BPP) — Production Monorepo Makefile
# Dedicated to ONDC P2P Logistics & 1 Delivery Partner App
# Inspired by Ralt Enterprise Architecture Standard
# ==============================================================================

ifeq ($(OS),Windows_NT)
  SHELL := bash.exe
else
  SHELL := /bin/bash
endif

.DEFAULT_GOAL := help

# Terminal formatting colors
COLOR_RESET   := \033[0m
COLOR_INFO    := \033[36m
COLOR_SUCCESS := \033[32m
COLOR_WARNING := \033[33m
COLOR_DANGER  := \033[31m

# Container Engine Selection (Podman preferred, Docker fallback)
CONTAINER_ENGINE ?= $(shell command -v podman >/dev/null 2>&1 && echo podman || echo docker)
COMPOSE_CMD      ?= $(CONTAINER_ENGINE) compose
HOST_PORT        ?= 5001
DOCKER_COMPOSE_FILE    := docker-compose.yml
LIGHTSAIL_COMPOSE_FILE := deploy/lightsail/docker-compose.yml

.PHONY: help check-engine env install up down restart build rebuild ps status logs \
        logs-backend logs-db logs-redis logs-rabbit infra db redis rabbit test lint \
        clean clean-all seed db-backup db-inspect shell-backend shell-db \
        mobile mobile-web mobile-android mobile-ios mobile-tunnel \
        lightsail-up lightsail-down lightsail-logs lightsail-health lightsail-deploy \
        release release-dry version-sync

help: ## Show this interactive help message and platform endpoints
	@echo -e "${COLOR_INFO}======================================================================${COLOR_RESET}"
	@echo -e "${COLOR_SUCCESS}  RALT ONDC Logistics Provider (BPP) — Hyperlocal Fleet Monorepo (${CONTAINER_ENGINE})${COLOR_RESET}"
	@echo -e "${COLOR_INFO}======================================================================${COLOR_RESET}"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  ${COLOR_SUCCESS}%-22s${COLOR_RESET} %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo -e "  ${COLOR_INFO}Service URLs & Ports (${CONTAINER_ENGINE} & Local):${COLOR_RESET}"
	@echo -e "    • ONDC BPP Backend:     ${COLOR_INFO}http://localhost:${HOST_PORT}${COLOR_RESET}"
	@echo -e "    • Prometheus Metrics:   ${COLOR_INFO}http://localhost:${HOST_PORT}/metrics${COLOR_RESET}"
	@echo -e "    • Health & Readiness:   ${COLOR_INFO}http://localhost:${HOST_PORT}/health${COLOR_RESET} | ${COLOR_INFO}/ready${COLOR_RESET}"
	@echo -e "    • Delivery Partner App: ${COLOR_INFO}http://localhost:8081${COLOR_RESET} (Expo Web)"
	@echo -e "    • Fleet WebSocket:      ${COLOR_INFO}ws://localhost:${HOST_PORT}/ws${COLOR_RESET}"
	@echo -e "    • RabbitMQ Dashboard:   ${COLOR_INFO}http://localhost:15672${COLOR_RESET} (guest/guest)"
	@echo -e "    • PostgreSQL + PostGIS: ${COLOR_INFO}localhost:5432${COLOR_RESET} (postgres/postgres)"
	@echo -e "    • Redis Geospatial:     ${COLOR_INFO}localhost:6379${COLOR_RESET}"

check-engine: ## Check if container engine (Podman or Docker) is active
	@$(CONTAINER_ENGINE) info >/dev/null 2>&1 || ( \
		echo -e "${COLOR_DANGER}ERROR: $(CONTAINER_ENGINE) daemon is not running!${COLOR_RESET}"; \
		echo -e "${COLOR_WARNING}Please start $(CONTAINER_ENGINE).${COLOR_RESET}"; \
		exit 1 \
	)

env: ## Verify environment configuration files
	@echo -e "${COLOR_INFO}Verifying environment configuration...${COLOR_RESET}"
	@test -f services/ondc-lsp-service/.env || cp services/ondc-lsp-service/.env.example services/ondc-lsp-service/.env
	@test -f .env || cp .env.example .env
	@echo -e "${COLOR_SUCCESS}Environment configuration verified.${COLOR_RESET}"

install: ## Install dependencies across services, apps, and packages
	@echo -e "${COLOR_INFO}Installing monorepo dependencies across workspace...${COLOR_RESET}"
	@npm install
	@echo -e "${COLOR_INFO}Ensuring delivery app dependencies are installed...${COLOR_RESET}"
	@test -d apps/delivery-app/node_modules/expo || (cd apps/delivery-app && npm install --no-audit --no-fund)
	@echo -e "${COLOR_INFO}Building ONDC LSP backend service...${COLOR_RESET}"
	@cd services/ondc-lsp-service && npm run build
	@echo -e "${COLOR_SUCCESS}All project dependencies installed successfully!${COLOR_RESET}"

# ------------------------------------------------------------------------------
# 1. Primary Container Management (Full Local Stack)
# ------------------------------------------------------------------------------

up: check-engine env ## Start full platform (PostGIS, Redis, RabbitMQ, ONDC Backend)
	@echo -e "${COLOR_INFO}Starting RALT ONDC platform in $(CONTAINER_ENGINE)...${COLOR_RESET}"
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) up -d
	@echo -e "${COLOR_SUCCESS}Platform launched successfully!${COLOR_RESET}"
	@echo -e "  Backend API & Webhooks: ${COLOR_INFO}http://localhost:${HOST_PORT}${COLOR_RESET}"
	@echo -e "  Metrics Endpoint:       ${COLOR_INFO}http://localhost:${HOST_PORT}/metrics${COLOR_RESET}"
	@echo -e "  PostgreSQL PostGIS:     ${COLOR_INFO}localhost:5432${COLOR_RESET}"
	@echo -e "  RabbitMQ Management:    ${COLOR_INFO}http://localhost:15672${COLOR_RESET}"
	@echo -e "  Redis Geospatial:       ${COLOR_INFO}localhost:6379${COLOR_RESET}"

dev: up   ## Alias for 'make up'
start: up ## Alias for 'make up'
run: up   ## Alias for 'make up'

down: check-engine ## Stop all running containers
	@echo -e "${COLOR_WARNING}Stopping all RALT ONDC containers...${COLOR_RESET}"
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) down

stop: down ## Alias for 'make down'

restart: check-engine ## Restart all containers
	@echo -e "${COLOR_INFO}Restarting containers...${COLOR_RESET}"
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) restart

build: check-engine env ## Build container images
	@echo -e "${COLOR_INFO}Building container images...${COLOR_RESET}"
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) build

rebuild: check-engine env ## Force rebuild without cache and restart all services
	@echo -e "${COLOR_INFO}Rebuilding container images from scratch...${COLOR_RESET}"
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) up -d --build

ps: check-engine ## View status and health of all containers
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) ps

status: ps ## Alias for 'make ps'

# ------------------------------------------------------------------------------
# 2. Backing Datastores (PostGIS, Redis, RabbitMQ only)
# ------------------------------------------------------------------------------

infra: check-engine env ## Start only the backing datastores (Postgres PostGIS, Redis, RabbitMQ)
	@echo -e "${COLOR_INFO}Starting backing infrastructure (PostgreSQL PostGIS, Redis, RabbitMQ)...${COLOR_RESET}"
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) up -d postgres redis rabbitmq
	@echo -e "${COLOR_SUCCESS}Datastores and message brokers are running!${COLOR_RESET}"

db: check-engine env ## Start only PostgreSQL (PostGIS) container
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) up -d postgres

redis: check-engine env ## Start only Redis container
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) up -d redis

rabbit: check-engine env ## Start only RabbitMQ container
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) up -d rabbitmq

# ------------------------------------------------------------------------------
# 3. Delivery Partner Mobile App (Expo React Native)
# ------------------------------------------------------------------------------

mobile: ## Run Delivery Partner App in interactive Expo CLI
	@echo -e "${COLOR_INFO}Launching Delivery Partner Mobile App...${COLOR_RESET}"
	@test -d apps/delivery-app/node_modules/expo || (cd apps/delivery-app && npm install --no-audit --no-fund)
	@cd apps/delivery-app && NODE_OPTIONS="-r ./polyfill.js" npx expo start -c

mobile-web: ## Launch Delivery Partner App in Web Browser (Port 8081)
	@echo -e "${COLOR_INFO}Launching Delivery Partner Mobile App in Web Browser (Port 8081)...${COLOR_RESET}"
	@test -d apps/delivery-app/node_modules/expo || (cd apps/delivery-app && npm install --no-audit --no-fund)
	@cd apps/delivery-app && NODE_OPTIONS="-r ./polyfill.js" npx expo start --web --port 8081

mobile-android: ## Launch Delivery Partner App on Android Emulator
	@echo -e "${COLOR_INFO}Launching Delivery Partner App on Android Emulator...${COLOR_RESET}"
	@cd apps/delivery-app && NODE_OPTIONS="-r ./polyfill.js" npx expo start --android

mobile-ios: ## Launch Delivery Partner App on iOS Simulator
	@echo -e "${COLOR_INFO}Launching Delivery Partner App on iOS Simulator...${COLOR_RESET}"
	@cd apps/delivery-app && NODE_OPTIONS="-r ./polyfill.js" npx expo start --ios

mobile-tunnel: ## Launch Delivery Partner App with Expo Tunnel for physical testing
	@echo -e "${COLOR_INFO}Launching Delivery Partner App with Tunnel...${COLOR_RESET}"
	@cd apps/delivery-app && NODE_OPTIONS="-r ./polyfill.js" npx expo start --tunnel --clear

# ------------------------------------------------------------------------------
# 4. Logs & Observability
# ------------------------------------------------------------------------------

logs: check-engine ## Tail live logs from all containers
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) logs -f

logs-backend: check-engine ## Tail ONDC Backend logs
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) logs -f backend

logs-db: check-engine ## Tail PostgreSQL + PostGIS logs
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) logs -f postgres

logs-redis: check-engine ## Tail Redis logs
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) logs -f redis

logs-rabbit: check-engine ## Tail RabbitMQ logs
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) logs -f rabbitmq

# ------------------------------------------------------------------------------
# 5. Database Operations, Seeding & Backups
# ------------------------------------------------------------------------------

seed: check-engine ## Re-seed PostGIS database with default active rider and test orders
	@echo -e "${COLOR_INFO}Applying initial PostGIS schema & seeds...${COLOR_RESET}"
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) exec -T postgres psql -U postgres -d ralt_ondc_db < packages/database/init-dbs.sql
	@echo -e "${COLOR_SUCCESS}PostGIS schema and seed data applied successfully!${COLOR_RESET}"

db-backup: check-engine ## Create compressed snapshot backup of PostGIS database
	@echo -e "${COLOR_INFO}Creating PostGIS database backup...${COLOR_RESET}"
	@mkdir -p .backups/db
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) exec -T postgres pg_dump -U postgres ralt_ondc_db | gzip > .backups/db/ralt_ondc_db_$$(date +'%Y%m%d_%H%M%S').sql.gz
	@echo -e "${COLOR_SUCCESS}Backup saved to .backups/db/${COLOR_RESET}"

db-inspect: check-engine ## Inspect tables and active riders in PostGIS
	@echo -e "${COLOR_INFO}Querying active delivery partners in PostGIS...${COLOR_RESET}"
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) exec postgres psql -U postgres -d ralt_ondc_db -c "SELECT id, name, phone, is_online, lat, lng, ST_AsText(geom) AS geom_wkt FROM riders LIMIT 5;"

shell-backend: check-engine ## Open interactive shell inside ONDC backend container
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) exec backend sh

shell-db: check-engine ## Open interactive PostgreSQL psql shell
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) exec postgres psql -U postgres -d ralt_ondc_db

# ------------------------------------------------------------------------------
# 6. Quality, Testing, Scans & CI/CD Gates
# ------------------------------------------------------------------------------

test: ## Run unit tests across backend and frontend
	@echo -e "${COLOR_INFO}Running test suites for backend and frontend...${COLOR_RESET}"
	@npm run test
	@echo -e "${COLOR_SUCCESS}All test suites passed!${COLOR_RESET}"

test-coverage: ## Run full test suites with >= 85% coverage validation
	@echo -e "${COLOR_INFO}Running code coverage verification (target >= 85%)...${COLOR_RESET}"
	@npm run test:coverage
	@echo -e "${COLOR_SUCCESS}Coverage thresholds (>= 85%) satisfied!${COLOR_RESET}"

lint: ## Run lint / typecheck across backend and frontend
	@echo -e "${COLOR_INFO}Running static analysis and typechecking...${COLOR_RESET}"
	@npm run lint
	@echo -e "${COLOR_SUCCESS}Linting clean!${COLOR_RESET}"

scan: ## Run security audit, secret scan, and UI policy check
	@echo -e "${COLOR_INFO}Running enterprise security scans...${COLOR_RESET}"
	@bash scripts/security-scan.sh

check-all: lint scan test-coverage ## Run complete quality gate (lint, scans, >= 85% test coverage)
	@echo -e "${COLOR_SUCCESS}All quality gates passed successfully!${COLOR_RESET}"

clean: check-engine ## Stop containers and remove persistent docker volumes
	@echo -e "${COLOR_DANGER}Purging all containers, networks, and persistent data volumes...${COLOR_RESET}"
	@$(COMPOSE_CMD) -f $(DOCKER_COMPOSE_FILE) down -v --remove-orphans
	@echo -e "${COLOR_SUCCESS}Cleanup complete.${COLOR_RESET}"

clean-all: clean ## Complete cleanup including node_modules and build caches
	@echo -e "${COLOR_DANGER}Cleaning node_modules and build artifacts...${COLOR_RESET}"
	@rm -rf services/ondc-lsp-service/node_modules services/ondc-lsp-service/dist apps/delivery-app/node_modules .expo
	@echo -e "${COLOR_SUCCESS}Repository thoroughly cleaned.${COLOR_RESET}"

# ------------------------------------------------------------------------------
# 7. AWS Lightsail Production Deployment
# ------------------------------------------------------------------------------

lightsail-up: check-engine ## Start production Lightsail stack (Caddy, Backend, PostGIS, Redis, RabbitMQ)
	@echo -e "${COLOR_INFO}Starting Lightsail production stack...${COLOR_RESET}"
	@$(COMPOSE_CMD) -f $(LIGHTSAIL_COMPOSE_FILE) up -d
	@echo -e "${COLOR_SUCCESS}Lightsail stack active! Ingress on :80 / :443${COLOR_RESET}"

lightsail-down: check-engine ## Stop production Lightsail stack
	@$(COMPOSE_CMD) -f $(LIGHTSAIL_COMPOSE_FILE) down

lightsail-logs: check-engine ## Tail live logs from Lightsail containers
	@$(COMPOSE_CMD) -f $(LIGHTSAIL_COMPOSE_FILE) logs -f --tail=50

lightsail-health: ## Probe all production endpoints for HTTP 200 OK
	@echo -e "${COLOR_INFO}Probing Lightsail service health...${COLOR_RESET}"
	@for ep in /health /ready /metrics; do \
		code=$$(curl -s -o /dev/null -w "%{http_code}" -m 3 "http://localhost:${HOST_PORT}$$ep" || echo "ERR"); \
		if [ "$$code" = "200" ]; then \
			echo -e "  [$$code] ${COLOR_SUCCESS}$$ep OK${COLOR_RESET}"; \
		else \
			echo -e "  [$$code] ${COLOR_DANGER}$$ep DOWN / PENDING${COLOR_RESET}"; \
		fi \
	done

lightsail-deploy: ## Run automated Lightsail deployment script with backup & rollback
	@bash deploy/lightsail/deploy-lightsail.sh

# ------------------------------------------------------------------------------
# 6. Git & Multi-Cloud Push Targets (GitHub & AWS CodeCommit)
# ------------------------------------------------------------------------------

push-all: ## Push main branch to BOTH GitHub and AWS CodeCommit simultaneously
	@echo -e "${COLOR_INFO}Pushing to both GitHub and AWS CodeCommit...${COLOR_RESET}"
	@git push origin main
	@echo -e "${COLOR_SUCCESS}Successfully synced both GitHub and AWS CodeCommit!${COLOR_RESET}"

push-github: ## Push main branch to GitHub ONLY
	@echo -e "${COLOR_INFO}Pushing to GitHub only...${COLOR_RESET}"
	@git push github main
	@echo -e "${COLOR_SUCCESS}Successfully synced GitHub!${COLOR_RESET}"

push-aws: ## Push main branch to AWS CodeCommit ONLY
	@echo -e "${COLOR_INFO}Pushing to AWS CodeCommit only...${COLOR_RESET}"
	@git push codecommit main
	@echo -e "${COLOR_SUCCESS}Successfully synced AWS CodeCommit!${COLOR_RESET}"

# ------------------------------------------------------------------------------
# 7. Semantic Release & Versioning
# ------------------------------------------------------------------------------

version-sync: ## Synchronize monorepo versions across apps, services, and packages
	@node scripts/sync-versions.js $(v)

release-dry: ## Preview next semantic release version based on conventional commits
	@node scripts/release-preview.js

release: ## Run semantic release to analyze commits, bump versions, and tag
	@npx semantic-release
