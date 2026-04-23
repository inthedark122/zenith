# 🚀 Deployment Guide

This guide covers deploying **Zenith** to [Railway](https://railway.app) (API + frontend) and the **Trading Worker** to a dedicated [GCP Compute Engine](https://cloud.google.com/compute) VM with a static outbound IP for exchange API key whitelisting.

Everything is configured through the Railway dashboard, GitHub repository settings, and GCP.

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
11. [Trading Worker — GCP Compute Engine](#11-trading-worker--gcp-compute-engine)
    - [11.1 Prerequisites](#111-prerequisites)
    - [11.2 Step 1 — GCP infrastructure setup](#112-step-1--gcp-infrastructure-setup-run-once)
    - [11.3 Step 2 — Set worker environment variables](#113-step-2--set-worker-environment-variables)
    - [11.4 Step 3 — Workload Identity Federation](#114-step-3--workload-identity-federation-run-once)
    - [11.5 Step 4 — GitHub Actions secrets and variables](#115-step-4--add-github-actions-secrets-and-variables)
    - [11.6 Step 5 — Trigger the first deploy](#116-step-5--trigger-the-first-deploy)
    - [11.7 How auto-deploy works](#117-how-auto-deploy-works-day-to-day)
    - [11.8 View worker logs](#118-view-worker-logs)
    - [11.9 Manual container controls](#119-manual-container-controls-via-ssh)
    - [11.10 Scaling to multiple workers](#1110-scaling-to-multiple-workers-future)
    - [11.11 Troubleshooting](#1111-troubleshooting)

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
Railway (Singapore region)          GCP asia-southeast1
├── Service: postgres   ◄───────────── Trading Worker (direct DB connection)
├── Service: backend                  ├── Container-Optimized OS VM (e2-micro)
└── Service: frontend                 ├── Cloud NAT → one static IP ← whitelist on exchanges
                                      └── Artifact Registry (Docker images)
```

The **trading worker** runs exclusively on GCP Compute Engine — not on Railway.
This gives it a **stable, known outbound IP** for exchange API key whitelisting,
while Railway handles the web API and frontend.

The VM uses **Container-Optimized OS (COS)**: GCP pulls and runs the Docker image
directly — no Docker install, no SSH needed for deploys.

Auto-deploy is handled by GitHub Actions on every push to `main` that changes
`backend/` or `worker/` code.

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

The trading worker runs exclusively on a **GCP Compute Engine VM** in `asia-southeast1`
(Singapore) using **Container-Optimized OS**. GCP pulls and runs the Docker image
directly — no manual Docker setup, no SSH needed for deploys.

All outbound traffic exits through a **single reserved static IP** via Cloud NAT.
Scale to multiple VMs later without ever asking users to update their API keys.

```
GitHub push to main
        │
        ▼
GitHub Actions (deploy-worker.yml)
        ├── Build Docker image → push to Artifact Registry
        └── gcloud compute instances update-container   ← one command, no SSH
                         │
                         ▼
        GCP asia-southeast1
        ├── Artifact Registry: asia-southeast1-docker.pkg.dev/PROJECT/zenith/
        ├── VPC: zenith-vpc (10.0.0.0/24, no external IPs on VMs)
        │   ├── Cloud Router + Cloud NAT
        │   │       └── Static IP: x.x.x.x  ← whitelist this on exchanges
        │   └── zenith-worker (e2-micro, COS, no public IP)
        └── WIF Pool: github-pool (keyless GitHub → GCP auth)
```

---

### 11.1 Prerequisites

- `gcloud` CLI installed: https://cloud.google.com/sdk/docs/install
- Authenticated: `gcloud auth login`
- A GCP project created (billing enabled)
- `GITHUB_REPO=livectar/zenith` (your GitHub org/repo)

---

### 11.2 Step 1 — GCP infrastructure setup (run once)

```bash
export GCP_PROJECT_ID=your-project-id
bash infra/gcp-setup.sh
```

**What it creates:**
- Artifact Registry repository (`zenith`)
- VPC `zenith-vpc` with subnet `10.0.0.0/24`
- Reserved static external IP (`zenith-nat-ip`)
- Cloud Router + Cloud NAT (all VM traffic exits via the static IP)
- VM service account `zenith-worker-sa` (pulls images from Artifact Registry)
- Firewall rules (IAP SSH ingress for debugging, TCP egress for exchanges/DB)
- Compute Engine VM `zenith-worker` running Container-Optimized OS

At the end the script prints:

```
★  Static outbound IP: x.x.x.x
★  Whitelist this IP on all exchange API keys — it will never change.
```

> **Copy this IP immediately.** Add it to every exchange API key you create.
> It will never change even as you scale to more workers.

---

### 11.3 Step 2 — Set worker environment variables

The VM was created with placeholder env vars. Set the real values — no SSH needed:

```bash
export GCP_PROJECT_ID=your-project-id

gcloud compute instances update-container zenith-worker \
  --zone=asia-southeast1-b \
  --container-env="DATABASE_URL=postgresql://postgres:PASSWORD@HOST.railway.app:5432/railway?sslmode=require" \
  --container-env="SECRET_KEY=your-secret-key-same-as-railway-backend" \
  --container-env="MARKET_POLL_INTERVAL=60" \
  --project=${GCP_PROJECT_ID}
```

| Variable | Where to find it |
|----------|-----------------|
| `DATABASE_URL` | Railway dashboard → **postgres** service → **Variables** → `DATABASE_URL` (use the public TCP URL, not the private one) |
| `SECRET_KEY` | Railway dashboard → **BackEnd** service → **Variables** → `SECRET_KEY` |
| `MARKET_POLL_INTERVAL` | `60` (seconds between market polls) — adjust as needed |

> **Important:** use the Railway **public** `DATABASE_URL` (contains `.railway.app`).  
> The private URL only works inside Railway's network.

After running `update-container` GCP automatically pulls a fresh image and restarts
the container with the new env vars.

---

### 11.4 Step 3 — Workload Identity Federation (run once)

This allows GitHub Actions to deploy to GCP without storing any service account keys.

```bash
export GCP_PROJECT_ID=your-project-id
export GITHUB_REPO=livectar/zenith
bash infra/gcp-wif-setup.sh
```

At the end the script prints two values — copy them:

```
Secrets:
  GCP_WORKLOAD_IDENTITY_PROVIDER = projects/NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
  GCP_DEPLOY_SERVICE_ACCOUNT     = zenith-deploy-sa@your-project-id.iam.gserviceaccount.com
```

---

### 11.5 Step 4 — Add GitHub Actions secrets and variables

Go to **GitHub → `livectar/zenith` → Settings → Secrets and variables → Actions**.

**Variables** (not sensitive — visible in logs):

| Name | Value |
|------|-------|
| `GCP_PROJECT_ID` | Your GCP project ID (e.g. `my-project-123`) |
| `GCP_REGION` | `asia-southeast1` |
| `GCP_ZONE` | `asia-southeast1-b` |

**Secrets** (from the `gcp-wif-setup.sh` output in step 11.4):

| Name | Value |
|------|-------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/.../providers/github-provider` |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `zenith-deploy-sa@....iam.gserviceaccount.com` |

---

### 11.6 Step 5 — Trigger the first deploy

The workflow triggers automatically on any push to `main` that changes `backend/`,
`worker/`, or `.github/workflows/deploy-worker.yml`.

**To trigger manually** (no code change needed):

1. Go to **GitHub → Actions → Deploy Trading Worker**
2. Click **Run workflow** → **Run workflow** (on `main` branch)

Watch the workflow run — it should complete in ~3 minutes:
- `Build & Push Worker Image` — builds and pushes to Artifact Registry
- `Deploy to GCP Compute Engine` — calls `update-container`; GCP restarts the container

---

### 11.7 How auto-deploy works (day-to-day)

```
Push to main (backend/** or worker/**)
        │
        ▼
 GitHub Actions: deploy-worker.yml
        │
        ├── [build job]
        │     ├── Authenticate to GCP via OIDC (no stored keys)
        │     ├── Build Docker image (context: ./backend, Dockerfile: worker/Dockerfile)
        │     └── Push to Artifact Registry:
        │               :latest  +  :<git-sha>  (immutable per-commit tag)
        │
        └── [deploy job]  (waits for build)
              ├── Authenticate to GCP via OIDC
              └── gcloud compute instances update-container zenith-worker \
                    --container-image=IMAGE:GIT_SHA
                          │
                          ▼
                  GCP detects metadata change
                  → stops old container
                  → pulls new image (VM SA pulls from Artifact Registry)
                  → starts new container
                  → container restarts automatically on any future crash
```

Deploys are **queued** — a new push waits for the current deploy to finish.
Each deploy pins the exact image built for that commit (SHA tag) — no race conditions.

---

### 11.8 View worker logs

**Option A — Cloud Logging (no SSH):**

```
GCP Console → Logging → Log Explorer
Resource: VM Instance → zenith-worker
```

Or via CLI:

```bash
gcloud logging read \
  'resource.type="gce_instance" AND resource.labels.instance_id="zenith-worker"' \
  --project=your-project-id \
  --limit=50 \
  --format="value(textPayload)"
```

**Option B — SSH into the VM (for manual debugging):**

```bash
gcloud compute ssh zenith-worker \
  --zone=asia-southeast1-b \
  --tunnel-through-iap \
  --project=your-project-id
```

Once inside the VM:

```bash
# COS runs containers via the konlet agent — view logs with:
docker ps                             # find container ID
docker logs -f <container-id>         # live logs
docker logs --tail 50 <container-id>  # last 50 lines
```

---

### 11.9 Manual container controls (via SSH)

```bash
# SSH in first (see 11.8 Option B)

docker ps                             # check running containers
docker restart <container-id>         # restart worker

# Force redeploy without a code push:
IMAGE="asia-southeast1-docker.pkg.dev/PROJECT_ID/zenith/zenith-worker:latest"
docker pull $IMAGE && docker stop <container-id>
# COS konlet will restart it automatically (restart policy = always)
```

Or without SSH, update any env var and GCP restarts the container automatically:

```bash
gcloud compute instances update-container zenith-worker \
  --zone=asia-southeast1-b \
  --container-env="MARKET_POLL_INTERVAL=30" \
  --project=your-project-id
```

---

### 11.10 Scaling to multiple workers (future)

Cloud NAT routes **all** VMs in the `zenith-vpc` subnet through the same static IP.
Users never need to update their exchange API key whitelists.

Add a second worker with the same COS image:

```bash
export GCP_PROJECT_ID=your-project-id
IMAGE="asia-southeast1-docker.pkg.dev/${GCP_PROJECT_ID}/zenith/zenith-worker:latest"

gcloud compute instances create-with-container zenith-worker-1 \
  --zone=asia-southeast1-b \
  --machine-type=e2-micro \
  --network=zenith-vpc \
  --subnet=zenith-subnet \
  --no-address \
  --service-account=zenith-worker-sa@${GCP_PROJECT_ID}.iam.gserviceaccount.com \
  --scopes=cloud-platform \
  --tags=zenith-worker \
  --image-family=cos-stable \
  --image-project=cos-cloud \
  --container-image="$IMAGE" \
  --container-restart-policy=always \
  --container-env="DATABASE_URL=...,SECRET_KEY=...,MARKET_POLL_INTERVAL=60,WORKER_ID=1,TOTAL_WORKERS=2" \
  --metadata=enable-oslogin=TRUE \
  --project=${GCP_PROJECT_ID}
```

Update the existing worker to match:

```bash
gcloud compute instances update-container zenith-worker \
  --zone=asia-southeast1-b \
  --container-env="WORKER_ID=0,TOTAL_WORKERS=2" \
  --project=${GCP_PROJECT_ID}
```

The worker uses `WORKER_ID` and `TOTAL_WORKERS` to partition users
(`hash(user_id) % TOTAL_WORKERS == WORKER_ID`) — each user is processed
by exactly one worker.

---

### 11.11 Troubleshooting

**Workflow fails: "workload_identity_provider not set"**
→ GitHub secrets `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_DEPLOY_SERVICE_ACCOUNT`
  are missing. Run `gcp-wif-setup.sh` and add the printed values to GitHub secrets.

**Workflow fails: "PERMISSION_DENIED on update-container"**
→ The deploy SA is missing `roles/compute.instanceAdmin.v1`.
  Re-run `infra/gcp-wif-setup.sh` to grant it.

**Workflow fires but no code changed in backend/worker**
→ Normal — use the **Run workflow** button for manual deploys that don't need a code change.

**Workflow doesn't fire after push**
→ Check that files changed in `backend/**`, `worker/**`, or `.github/workflows/deploy-worker.yml`.
  Frontend-only pushes intentionally skip this workflow.

**Container not starting on VM**
→ SSH in and check: `docker ps -a` — look for exit code.
  `docker logs <container-id>` for the error.
  Common cause: `DATABASE_URL` or `SECRET_KEY` is wrong — re-run `update-container` with correct values.

**Worker connects to DB but no strategies run**
→ Check `MARKET_POLL_INTERVAL` is set.
  Check PostgreSQL advisory lock: another instance may be holding it (lock ID `7254321987`).
  Only one worker instance can hold the lock — the other exits immediately.

**Verify outbound IP is the static NAT IP:**
```bash
# SSH into the VM, then:
curl -s https://api.ipify.org
# Should match the static IP printed by gcp-setup.sh
```

