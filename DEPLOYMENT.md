# 🚀 Deployment Guide

This guide covers deploying **Zenith** to [Railway](https://railway.app) (API + frontend) and the **Trading Worker** to a dedicated [Hetzner](https://hetzner.com) VPS.

Everything is configured through the Railway dashboard, GitHub repository settings, and a single VPS.

---

## Table of Contents

1. [Environments overview](#1-environments-overview)
2. [Architecture overview](#2-architecture-overview)
3. [Step 1 — Create Railway projects (dashboard)](#3-step-1--create-railway-projects-dashboard)
4. [Step 2 — Configure environment variables in Railway](#4-step-2--configure-environment-variables-in-railway)
5. [Step 3 — Enable Railway Auto Deploy](#5-step-3--enable-railway-auto-deploy)
6. [Step 4 — Trigger the first deployment](#6-step-4--trigger-the-first-deployment)
7. [Step 5 — Verify the deployment](#7-step-5--verify-the-deployment)
8. [How Auto Deploy works (day-to-day)](#8-how-auto-deploy-works-day-to-day)
9. [Environment variable reference](#9-environment-variable-reference)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Environments overview

| Git branch | Railway project | Purpose |
|------------|-----------------|---------|
| `dev`      | `zenith-dev`    | Test changes before production |
| `main`     | `zenith-prod`   | Live production deployment |

Each Railway project connects directly to this repository. Railway Auto Deploy watches the configured branch for each service and deploys it when new commits land.

---

## 2. Architecture overview

```
Railway (Singapore region)          Hetzner SGP1 VPS (~€5/mo)
├── Service: postgres   ◄───────────── Trading Worker (direct DB connection)
├── Service: backend                        ├── fixed public IP → whitelist on exchanges
└── Service: frontend                       └── runs market_listener_loop
```

The **trading worker** runs exclusively on the Hetzner VPS — not on Railway.
This gives it a **stable, known IP** for exchange API key whitelisting, while
Railway handles the web API and frontend.

The worker communicates via the shared PostgreSQL database:
- **Reads**: strategies, running StrategyWorkers
- **Writes**: trades, positions, P&L

Auto-deploy is handled by GitHub Actions on every push to `main`.

---

## 3. Step 1 — Create Railway projects (dashboard)

Repeat the steps below **twice**: once for the `development` project and once for the `production` project.

### 3.1 Create the project

1. Go to [railway.app/new](https://railway.app/new).
2. Click **Empty Project**.
3. Name it `zenith-dev` (for development) or `zenith-prod` (for production).

### 3.2 Add a PostgreSQL database

1. Inside the project, click **+ New** → **Database** → **Add PostgreSQL**.
2. Railway provisions the database. Note the connection details — `DATABASE_URL` will be available as a variable to link to services.

### 3.3 Add the backend service

1. Click **+ New** → **GitHub Repo**.
2. Select this repository (`livectar/zenith`).
3. Set **Root Directory** to `backend`.
4. Railway detects `backend/Dockerfile` automatically.
5. Name the service `BackEnd`.

### 3.4 Link the database to the backend

1. Open the **BackEnd** service → **Variables** tab.
2. Click **+ Add Reference** → select the **Postgres** service → select `DATABASE_URL`.

Railway will inject `DATABASE_URL` into the backend container on every deployment.

The backend container bootstraps Alembic before starting Uvicorn. On a fresh database it runs migrations from scratch; on an older database that already has the full initial schema but no `alembic_version` table, it stamps `0001_initial` first and then continues with normal migrations.

### 3.5 Add the frontend service

1. Click **+ New** → **GitHub Repo** (same repository).
2. Set **Root Directory** to `frontend`.
3. Railway detects `frontend/Dockerfile` automatically.
4. Name the service `FrontEnd`.

> **Important:** Keep Railway **Auto Deploy** enabled for both services. In each service: **Settings** → **Source** → confirm **Auto Deploy** is on.

---

## 4. Step 2 — Configure environment variables in Railway

Set variables directly in the Railway dashboard under each service's **Variables** tab. Repeat for both the `zenith-dev` and `zenith-prod` projects (with appropriate values for each environment).

### Backend variables

| Variable | Value |
|----------|-------|
| `SECRET_KEY` | A long random string (≥ 32 characters) — generate one at [randomkeygen.com](https://randomkeygen.com) |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `ADMIN_EMAIL` | Optional operator email that should receive the `admin` role automatically |
| `EVM_PAYMENTS_ENABLED` | `false` |
| `MARKET_POLL_INTERVAL` | `60` |

> `DATABASE_URL` and `PORT` are injected automatically by Railway — do not set them manually.

### Frontend variables

| Variable | Value |
|----------|-------|
| `BACKEND_URL` | The public backend URL, e.g. `https://backend-production-xxxx.up.railway.app` (no trailing slash). The frontend nginx config is set up to proxy HTTPS correctly. |

> The frontend container listens on port `80`. Do not append a port to the public URL.

---

## 5. Step 3 — Enable Railway Auto Deploy

For each service in both Railway projects:

1. Open the service (**BackEnd** or **FrontEnd**).
2. Go to **Settings** → **Source**.
3. Confirm the repository is connected to `livectar/zenith`.
4. Confirm the **Root Directory** is correct:
   - **BackEnd** → `backend`
   - **FrontEnd** → `frontend`
5. Turn **Auto Deploy** **on**.

> Railway now deploys directly when new commits land on the connected branch. GitHub Actions is no longer part of the normal deploy path.

---

## 6. Step 4 — Trigger the first deployment

### Deploy to development

Push any commit to the `dev` branch (or create the branch if it does not exist):

```
GitHub → your branch → create PR targeting dev → merge
```

### Deploy to production

Push (or merge a PR) to `main`:

```
GitHub → your branch → create PR targeting main → merge
```

Railway Auto Deploy uses the branch configured on each service's source settings:

| Branch | Railway project |
|--------|-----------------|
| `dev`  | `zenith-dev`    |
| `main` | `zenith-prod`   |

---

## 7. Step 5 — Verify the deployment

### Monitor the Railway deployment

1. Open the Railway project.
2. Watch the latest deployment under **BackEnd** and **FrontEnd**.
3. Confirm both deployments reach **Active** status.

### Check Railway

1. Open the Railway project → the **BackEnd** service → **Deployments** tab.
2. The latest deployment should show a green **Active** status.

### Health check

Once deployed, the backend exposes a health endpoint. Open your browser or use the Railway **shell** feature:

```
GET https://<your-backend-url>/health
→ {"status":"ok","service":"zenith-backend"}
```

The public URL is visible in the backend service → **Settings** → **Domains**.

---

## 8. How Auto Deploy works (day-to-day)

```
Developer workflow
──────────────────
  feature branch
       │
       ▼
  Pull Request → dev
       │ (merge)
       ▼
  dev branch  ──► Railway Auto Deploy ──► Deploy to zenith-dev  (development)
       │
  Pull Request → main
       │ (merge, optional: requires reviewer approval)
       ▼
  main branch ──► Railway Auto Deploy ──► Deploy to zenith-prod (production)
```

1. Develop in a feature branch.
2. Open a PR to `dev` → merge → Railway deploys to `zenith-dev` automatically.
3. Test on the development URL.
4. Open a PR from `dev` to `main` → merge → Railway deploys to `zenith-prod` automatically.

**Manual redeploy** (without a code change):

```
Railway → Service → Deployments → Redeploy
```

---

## 9. Environment variable reference

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | *(auto-injected)* | PostgreSQL connection string — linked from the Railway postgres service |
| `SECRET_KEY` | ✅ | — | JWT signing secret |
| `ALGORITHM` | | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | | `30` | JWT TTL in minutes |
| `ADMIN_EMAIL` | | — | If set, matching users are promoted to `role='admin'` automatically |
| `EVM_PAYMENTS_ENABLED` | | `false` | Enables the legacy ERC-20 deposit flow when set to `true` |
| `MARKET_POLL_INTERVAL` | | `60` | Seconds between market data polls |
| `PORT` | | *(unused by frontend)* | Frontend nginx listens on port `80` |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKEND_URL` | ✅ | — | Backend base URL used by frontend nginx; use the backend public HTTPS URL with no trailing slash |
| `PORT` | | *(auto-injected)* | HTTP port — Railway injects this automatically |

## 10. Troubleshooting

### Auto Deploy does not trigger

- Open the Railway service → **Settings** → **Source** and confirm **Auto Deploy** is enabled.
- Verify the service is connected to the correct repository and branch.
- Confirm the service **Root Directory** is correct: `backend` for **BackEnd**, `frontend` for **FrontEnd**.

### Frontend returns 502 on `/api/` routes

- Confirm `BACKEND_URL` in the **FrontEnd** service's Railway variables points to the backend public HTTPS URL, with no trailing slash.
- Check that the backend service is in **Active** status in the Railway dashboard.

### Backend fails to start: database connection error

- Open the **BackEnd** service → **Variables** tab and confirm `DATABASE_URL` is listed (it should be referenced from the **Postgres** service, not typed manually).
- If missing, click **+ Add Reference** → select the **Postgres** service → select `DATABASE_URL`.

### Backend fails during migration

- The backend deploy bootstraps Alembic before starting the API.
- Open the **BackEnd** service logs and look for Alembic errors before Uvicorn startup.
- If the database already exists but the schema is out of sync, fix the migration state first instead of relying on app startup to create tables.
- If logs mention a partial pre-Alembic schema, reconcile the database manually before redeploying.

### Crypto deposits are disabled

- `EVM_PAYMENTS_ENABLED=false` disables the legacy ERC-20 deposit flow and stops the blockchain listener.
- Wallet deposit address and on-chain transaction submission endpoints return a temporary unavailable response while the third-party payment provider is being integrated.

### Admin page is not visible

- Preferred: update the `users.role` column manually in PostgreSQL and set the desired operator account to `admin`.
- Optional shortcut: set `ADMIN_EMAIL` on the **BackEnd** service; matching users are promoted to `role='admin'` on registration or backend startup.
- Backtests now persist in `strategy_backtest_runs`, so repeated admin runs are preserved instead of overwriting one summary on `strategies`.

### Wrong project or branch deploys

- Check each Railway service's **Source** settings and confirm the intended branch is selected.
- A service only auto-deploys for the repository and branch currently connected in Railway.

---

---

## 11. Trading Worker — GCP Compute Engine

The trading worker runs exclusively on a GCP Compute Engine VM in `asia-southeast1`
(Singapore). All outbound traffic exits through a **single reserved static IP** via
Cloud NAT — scale to multiple VMs later without asking users to update their API keys.

```
GCP Project (asia-southeast1)
├── Artifact Registry: zenith/   ← Docker images
├── VPC: zenith-vpc (10.0.0.0/24)
│   ├── Cloud Router + Cloud NAT → static IP: x.x.x.x  ← whitelist on exchanges
│   └── Compute Engine: zenith-worker (e2-micro, no external IP)
└── GitHub Actions → Workload Identity Federation (no stored keys)
```

### 11.1 One-time GCP infrastructure setup

Prerequisites: `gcloud` CLI installed and authenticated (`gcloud auth login`).

```bash
export GCP_PROJECT_ID=your-project-id
bash infra/gcp-setup.sh
```

The script creates the VPC, Cloud NAT, Artifact Registry repo, firewall rules, and
the VM. It prints the **static outbound IP** — copy it before continuing.

> **Whitelist this IP on every exchange API key you create. It never changes.**

Then set up Workload Identity Federation (allows GitHub Actions to authenticate to
GCP without storing any service account keys):

```bash
export GCP_PROJECT_ID=your-project-id
export GITHUB_REPO=livectar/zenith
bash infra/gcp-wif-setup.sh
```

### 11.2 Configure the VM environment

SSH into the VM (no public IP — tunnels through Google IAP):

```bash
gcloud compute ssh zenith-worker \
  --zone=asia-southeast1-b \
  --tunnel-through-iap \
  --project=YOUR_PROJECT_ID
```

Fill in the worker config:

```bash
nano /opt/zenith-worker/.env
```

| Variable | Where to find it |
|----------|-----------------|
| `DATABASE_URL` | Railway dashboard → **postgres** service → **Variables** → `DATABASE_URL` (the public URL) |
| `SECRET_KEY` | Same value set on the Railway **BackEnd** service |
| `MARKET_POLL_INTERVAL` | `60` (seconds) — adjust as needed |
| `WORKER_IMAGE` | Leave as-is; GitHub Actions updates this on every deploy |

### 11.3 Add GitHub Actions variables and secrets

In **GitHub → Settings → Secrets and variables → Actions**:

**Variables** (visible, not sensitive):

| Variable | Value |
|----------|-------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_REGION` | `asia-southeast1` |
| `GCP_ZONE` | `asia-southeast1-b` |

**Secrets** (printed at the end of `gcp-wif-setup.sh`):

| Secret | Value |
|--------|-------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | WIF provider resource name |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | Deploy SA email (`zenith-deploy-sa@...`) |

### 11.4 Auto-deploy behaviour

```
Push to main
     │
     ▼
GitHub Actions: deploy-worker.yml
     ├── 1. WIF auth (no stored keys — GitHub proves identity to GCP via OIDC)
     ├── 2. Build Docker image (context: ./backend, file: worker/Dockerfile)
     ├── 3. Push to Artifact Registry:
     │       :latest  +  :<git-sha>  (immutable tag per commit)
     ├── 4. SCP docker-compose.yml → VM via IAP
     └── 5. SSH → VM via IAP:
              ├── Update WORKER_IMAGE in .env to this commit's SHA tag
              ├── docker compose pull  (VM pulls via its service account)
              ├── docker compose up -d --remove-orphans
              └── docker image prune -f
```

Deploys are **queued** — a new push waits for the current deploy to finish.
The exact image built by each commit is deployed to that commit — no race conditions.

### 11.5 Manual worker commands

```bash
# SSH in
gcloud compute ssh zenith-worker \
  --zone=asia-southeast1-b --tunnel-through-iap --project=YOUR_PROJECT_ID

# On the VM:
cd /opt/zenith-worker

docker compose logs -f           # live logs
docker compose ps                # status
docker compose restart           # restart
docker compose down              # stop
docker compose pull && docker compose up -d   # pull latest manually
```

### 11.6 Scaling to multiple workers

Cloud NAT routes **all** VMs in the `zenith-vpc` subnet through the same static IP.
To add a second worker VM:

```bash
gcloud compute instances create zenith-worker-2 \
  --zone=asia-southeast1-b \
  --machine-type=e2-micro \
  --network=zenith-vpc \
  --subnet=zenith-subnet \
  --no-address \
  --service-account=zenith-worker-sa@YOUR_PROJECT.iam.gserviceaccount.com \
  --scopes=cloud-platform \
  --tags=zenith-worker \
  --metadata=enable-oslogin=TRUE \
  --project=YOUR_PROJECT_ID
```

No IP whitelist changes needed — the new VM's outbound traffic also exits through
the same static IP.

### 11.7 Verify the worker is running

```bash
docker compose ps          # should show "running"
docker compose logs --tail 20
```

A healthy worker logs:

```
INFO app.workers.market_listener — Market listener orchestrator started. Poll interval: 60s
```
