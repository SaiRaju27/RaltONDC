# RaltONDC - ONDC Logistics Service Provider (LSP) & Delivery Partner Fleet

A dedicated, enterprise-grade solution for **RALT** operating as an **ONDC Logistics Service Provider (BPP)** in the **`P2P - ONDC:LOG10`** domain (Point-to-Point Hyperlocal Food & Retail Delivery).

Engineered to match the high-reliability production standards of **Ralt Enterprise**:
- **PostgreSQL 16 + PostGIS:** Real spatial proximity dispatch (`ST_DWithin`, `ST_Distance`) with GIST indexing.
- **Enterprise Security:** Helmet, CORS, Rate Limiters, JWT Rider authentication, Zod validation, and Ed25519 digital signatures.
- **Logging & Observability:** Structured JSON Pino logger with OpenTelemetry correlation (`trace.id`/`span.id`), Prometheus metrics scraper (`/metrics`), `/health`, and `/ready` probes.
- **Multi-Channel Notification System:** Expo Push notifications for the Delivery Partner App, SMS alerts via Airbrick, and real-time In-App WebSocket events.
- **Event-Driven Queues:** RabbitMQ 3.13 message broker with durable queues (`ondc.orders.dispatch`, `ondc.notifications.push`) and Redis 7 Geospatial caching.
- **Production CI/CD & Lightsail Runner:** Zero-downtime rolling reload with pre-flight checks, automated backup snapshots, health probes, and auto-rollback.

---

## 📁 Project Architecture

```
RaltONDC/
├── Makefile                          # Master CLI for containers, datastores, mobile app & Lightsail
├── package.json                      # Monorepo workspaces manifest (apps/*, services/*, packages/*)
├── pnpm-workspace.yaml               # pnpm monorepo workspace definition
├── docker-compose.yml                # Full local stack (Backend, PostGIS, Redis, RabbitMQ)
├── .env.example                      # Master environment variables template
├── .releaserc.json                   # Semantic Release configuration (Conventional Commits & Tags)
├── CHANGELOG.md                      # Auto-maintained release changelog
│
├── apps/
│   └── delivery-app/                 # 1 Delivery Partner Mobile App (Expo / React Native)
│       ├── App.tsx                   # Complete Rider App (Deliveries, Live Task, OTP, Earnings)
│       ├── OnboardingFlow.tsx        # Digital KYC & Profile Setup
│       ├── DeliveryDashboard.tsx     # Active Orders, Live Status & Route Tracking
│       ├── index.js                  # Explicit Metro Root Entrypoint
│       ├── metro.config.js           # Monorepo Metro resolution config
│       ├── polyfill.js
│       ├── app.json
│       └── package.json              # @ralt-ondc/delivery-app
│
├── services/
│   └── ondc-lsp-service/             # ONDC Logistics Engine & Dispatch Server (Node.js 20 + TypeScript)
│       ├── src/
│       │   ├── config.ts             # Centralized configuration with defaults & env overrides
│       │   ├── database.ts           # PostgreSQL + PostGIS pool with spatial queries & fallback
│       │   ├── logger.ts             # Pino structured logger with HTTP & correlation middleware
│       │   ├── observability.ts      # Prometheus metrics registry (/metrics) & default metrics
│       │   ├── security.ts           # Helmet, CORS, Rate Limiters, JWT tokens & Zod schemas
│       │   ├── crypto/auth.ts        # ONDC Ed25519 digital signature creation & verification
│       │   ├── controllers/
│       │   │   ├── ondcController.ts # /search, /init, /confirm, /status, /track, /cancel
│       │   │   └── riderController.ts# Rider APIs (profile, status, location, OTP, notifications)
│       │   ├── services/
│       │   │   ├── ondcClient.ts     # Outgoing Beckn callbacks (on_search, on_confirm, etc.)
│       │   │   ├── orderManager.ts   # Order lifecycle, PostGIS spatial dispatch & 4-digit OTP
│       │   │   ├── riderManager.ts   # PostGIS proximity search & WebSocket fleet tracking
│       │   │   ├── notificationService.ts # Multi-channel notifications (Expo Push, SMS, DB audit)
│       │   │   ├── queueService.ts   # RabbitMQ message queues & consumers with fallback
│       │   │   └── redisService.ts   # Redis Geospatial (GEOADD/GEOSEARCH) & Pub/Sub
│       │   └── server.ts             # Express + WebSocket HTTP server with graceful shutdown
│       ├── Dockerfile                # Multi-stage production container with non-root user & dumb-init
│       └── package.json              # @ralt-ondc/lsp-service
│
├── packages/
│   └── database/                     # PostGIS Database Schemas & Migrations Package
│       ├── migrations/
│       │   └── 001_initial_postgis_schema.sql
│       ├── init-dbs.sql              # Master PostGIS schema, triggers, indexes & seed data
│       └── package.json              # @ralt-ondc/database
│
├── deploy/                           # Deployment Infrastructure & Manifests
│   ├── docker/
│   │   └── docker-compose.yml        # Development container orchestration
│   ├── lightsail/
│   │   ├── docker-compose.yml        # Production stack with Caddy v2, PostGIS, Redis & RabbitMQ
│   │   ├── caddy/Caddyfile           # Reverse proxy with automated SSL, rate limiting & WebSocket
│   │   ├── deploy-lightsail.sh       # Automated deployment runner with auto-rollback
│   │   ├── backup-db.sh              # PostGIS automated backup utility
│   │   └── README.md                 # Lightsail sizing, security & deployment architecture guide
│   └── nginx/
│       └── nginx.conf                # Hardened Nginx configuration with SSL & WebSocket proxy
│
├── scripts/
│   ├── deploy-lightsail.sh           # Host provisioning & deployment script
│   ├── backup-db.sh                  # Database backup runner
│   ├── release-preview.js            # Semantic release preview utility
│   └── sync-versions.js              # Monorepo version synchronizer across all manifests
│
└── .github/workflows/
    ├── cd-lightsail.yml              # Automated GitHub Actions CI/CD for Docker buildx & SSH deploy
    └── release.yml                   # Automated Semantic Release & Versioning pipeline
```

---

## ⚡ Quick Start with `make`

The project includes an interactive, color-coded `Makefile` matching the Ralt Enterprise standard.

Run `make help` to inspect all available targets:

```bash
make help
```

### 1. Launch Backing Datastores (PostGIS, Redis, RabbitMQ)
```bash
make infra
```

### 2. Launch the Full Stack (Backend + Datastores)
```bash
make up
```

Endpoints available immediately:
- **ONDC BPP Server:** `http://localhost:5000`
- **Prometheus Metrics:** `http://localhost:5000/metrics`
- **Liveness & Readiness:** `http://localhost:5000/health` | `http://localhost:5000/ready`
- **RabbitMQ Dashboard:** `http://localhost:15672` (guest / guest)
- **PostgreSQL PostGIS:** `localhost:5432` (postgres / postgres)
- **Redis CLI:** `localhost:6379`

### 3. Launch the Delivery Partner Mobile App
```bash
# In Web Browser (Port 8081)
make mobile-web

# On Android Emulator
make mobile-android

# On iOS Simulator
make mobile-ios

# With Expo Tunnel (for testing on physical mobile device)
make mobile-tunnel
```

---

## 🌐 Connecting to the ONDC Workbench

1. **Expose your server to the internet:**
   ```bash
   ngrok http 5000
   ```
2. **In the ONDC Portal:**
   - In **Task 2.b**, navigate to **Workbench**.
   - Set callback URL to `https://<your-ngrok-domain>/ondc`.
   - Run the automated test suite.
   - Your backend will quote the delivery fee, match the closest available delivery partner via PostGIS, dispatch the assignment to the mobile app, and stream real-time tracking back to the ONDC Network!

---

## 🚢 AWS Lightsail Deployment

See [`deploy/lightsail/README.md`](deploy/lightsail/README.md) for full architecture and configuration details.

```bash
# Trigger the automated deployment runner on your Lightsail host:
make lightsail-deploy

# Probe all production endpoints for HTTP 200 OK:
make lightsail-health
```

---

## 🧪 Enterprise Testing, Quality Gates & Security Scans

The repository enforces strict enterprise quality gates with a **>= 85% Code Coverage** requirement for both frontend and backend:

| Scope | Suite | Coverage | Tests | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Backend** (`services/ondc-lsp-service`) | Jest + `ts-jest` + PostGIS Spatial | **86.08% Lines** | 105 passed / 11 suites | 🟢 Passed |
| **Frontend** (`apps/delivery-app`) | Jest + Domain Workflows & Utilities | **98.80% Lines** | 60 passed / 6 suites | 🟢 Passed |
| **Security & Copy Scanner** | `scripts/security-scan.sh` | Zero Secrets & Zero Jargon | Clean Audit | 🟢 Passed |

```bash
# Run complete enterprise quality gate (lint, security scans, 85%+ coverage tests)
make check-all
# OR
npm run check:all

# Run code coverage suites only
make test-coverage

# Run security & UI jargon scan
make scan

# Run static analysis and linting
make lint
```

### 🔒 Enterprise Security & Clean Copy Policy
- **Zero Technical Jargon in UI**: Strictly prohibits internal technical terms (`PostGIS`, `postgis`, `pg_trgm`, `SQLite`, `raw SQL`, etc.) in all customer/rider-facing screens. Only pure human logistics terminology is presented.
- **Zero Committed Secrets**: Automated regex scans detect AWS keys, private keys, and tokens prior to commit.
- **Dependency Audit**: Regular verification against high/critical CVEs.

---

## 🚀 Dual-Remote CI/CD Pipeline (AWS CodeCommit & GitHub)

The repository uses a dual-remote strategy. You can push changes to **GitHub**, **AWS CodeCommit**, or **both simultaneously** depending on your workflow.

### 📌 Git Push Reference Table

| Target | Git Command | Make Command | Remote URL / Destination | What it Triggers |
| :--- | :--- | :--- | :--- | :--- |
| **Both (GitHub + AWS)** | `git push origin main` | `make push-all` | • `github.com/SaiRaju27/RaltONDC`<br>• `git-codecommit.ap-south-1.amazonaws.com` | Triggers **both** GitHub Actions CI/CD (lint, scans, tests, semantic release) AND AWS CodePipeline (CodeBuild + CodeDeploy to Lightsail) |
| **GitHub Only** | `git push github main` | `make push-github` | `https://github.com/SaiRaju27/RaltONDC.git` | Triggers GitHub Actions CI/CD, security audits, test coverage checks, and version tagging |
| **AWS CodeCommit Only** | `git push codecommit main` | `make push-aws` | `https://git-codecommit.ap-south-1.amazonaws.com/v1/repos/ralt-delivery-partner` | Triggers AWS CodeBuild (`buildspec.yml`) and auto-deploys Docker containers to Lightsail |

### Quick Examples

```bash
# Option 1: Push to BOTH GitHub and AWS CodeCommit (Recommended)
make push-all
# OR
git push origin main

# Option 2: Push to GitHub only
make push-github
# OR
git push github main

# Option 3: Push to AWS CodeCommit only
make push-aws
# OR
git push codecommit main
```

### AWS CodeCommit CI/CD (`buildspec.yml`)
AWS CodeBuild executes:
- **Install**: Node.js 22 runtime, monorepo dependency hydration.
- **Pre-Build Quality Gate**: Executes `npm run check:all` (linting, security/copy scans, and >=85% test coverage verification).
- **Build**: Compiles backend TypeScript and builds production container image.
- **Deploy**: CodeDeploy triggers `ApplicationStart.sh` on Lightsail to boot Postgres (PostGIS), Redis, RabbitMQ, and backend containers.

---

## 🏷️ Semantic Release & Versioning

This repository follows the **Ralt Enterprise Semantic Release standard**:

- **Conventional Commits**: Commit messages follow standard format (`feat:`, `fix:`, `perf:`, `refactor:`, `BREAKING CHANGE:`).
- **Automated GitHub Actions**: [`.github/workflows/release.yml`](.github/workflows/release.yml) automatically calculates the next semantic version, updates the changelog, syncs all package manifests, tags the release (`vX.Y.Z`), and publishes GitHub releases.
- **Local Preview**:
  ```bash
  # Preview next calculated semantic version from conventional commits:
  make release-dry

  # Synchronize monorepo versions across apps, services, and packages manually:
  make version-sync v=1.2.7
  ```
