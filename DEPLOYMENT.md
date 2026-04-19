# 🚀 Railway Deployment Guide

This guide walks you through deploying **Zenith** to [Railway](https://railway.app) for the first time using GitHub Actions CI/CD — **no local tools required**.

Everything is configured through the Railway dashboard and GitHub repository settings.

---

## Table of Contents

1. [Environments overview](#1-environments-overview)
2. [Architecture on Railway](#2-architecture-on-railway)
3. [Step 1 — Create Railway projects (dashboard)](#3-step-1--create-railway-projects-dashboard)
4. [Step 2 — Configure environment variables in Railway](#4-step-2--configure-environment-variables-in-railway)
5. [Step 3 — Get Railway API tokens](#5-step-3--get-railway-api-tokens)
6. [Step 4 — Configure GitHub Environments](#6-step-4--configure-github-environments)
7. [Step 5 — Trigger the first deployment](#7-step-5--trigger-the-first-deployment)
8. [Step 6 — Verify the deployment](#8-step-6--verify-the-deployment)
9. [How CI/CD works (day-to-day)](#9-how-cicd-works-day-to-day)
10. [Environment variable reference](#10-environment-variable-reference)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Environments overview

| Git branch | GitHub Environment | Railway project | Purpose |
|------------|-------------------|-----------------|---------|
| `dev`      | `development`     | `zenith-dev`    | Test changes before production |
| `main`     | `production`      | `zenith-prod`   | Live production deployment |

Both environments use the **same workflow file** (`.github/workflows/deploy.yml`). The branch name determines which GitHub Environment — and therefore which Railway project and API token — the workflow uses.

---

## 2. Architecture on Railway

Each Railway project (dev and production) contains the same three services:

```
Railway Project: zenith-prod  (or zenith-dev)
├── Service: postgres   ← Managed PostgreSQL (Railway plugin)
├── Service: backend    ← Python / FastAPI  (./backend/Dockerfile)
└── Service: frontend   ← React / nginx     (./frontend/Dockerfile)
```

The **backend** connects to **postgres** via `DATABASE_URL`, which Railway injects automatically when the services are linked.

The **frontend** nginx proxies all `/api/` calls to the backend using the `BACKEND_URL` variable you set below.

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
5. Name the service `backend`.

### 3.4 Link the database to the backend

1. Open the **backend** service → **Variables** tab.
2. Click **+ Add Reference** → select the **postgres** service → select `DATABASE_URL`.

Railway will inject `DATABASE_URL` into the backend container on every deployment.

### 3.5 Add the frontend service

1. Click **+ New** → **GitHub Repo** (same repository).
2. Set **Root Directory** to `frontend`.
3. Railway detects `frontend/Dockerfile` automatically.
4. Name the service `frontend`.

> **Important:** Disable Railway's automatic deployments on the services you just created — the GitHub Actions workflow will manage all deployments. In each service: **Settings** → **Source** → toggle off **Auto Deploy**.

---

## 4. Step 2 — Configure environment variables in Railway

Set variables directly in the Railway dashboard under each service's **Variables** tab. Repeat for both the `zenith-dev` and `zenith-prod` projects (with appropriate values for each environment).

### Backend variables

| Variable | Value |
|----------|-------|
| `SECRET_KEY` | A long random string (≥ 32 characters) — generate one at [randomkeygen.com](https://randomkeygen.com) |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `HD_WALLET_SEED` | Your BIP-39 mnemonic (12–24 words). **Never share or commit this value.** |
| `ETH_RPC_URL` | `https://cloudflare-eth.com` (or your own node URL) |
| `USDT_CONTRACT_ADDRESS` | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| `BLOCKCHAIN_POLL_INTERVAL` | `30` |
| `MARKET_POLL_INTERVAL` | `60` |

> `DATABASE_URL` and `PORT` are injected automatically by Railway — do not set them manually.

### Frontend variables

| Variable | Value |
|----------|-------|
| `BACKEND_URL` | The public URL of the **backend** service in the same Railway project, e.g. `https://backend-production-xxxx.up.railway.app` (no trailing slash). Find it in the backend service → **Settings** → **Domains**. |

> `PORT` is injected automatically by Railway — do not set it manually.

---

## 5. Step 3 — Get Railway API tokens

The GitHub Actions workflow authenticates to Railway using a project-scoped API token.

1. In the Railway dashboard, open the **`zenith-dev`** project.
2. Click **Settings** (gear icon) → **Tokens**.
3. Click **+ Create Token**, name it `github-actions-dev`, copy the value.
4. Repeat for the **`zenith-prod`** project — name the token `github-actions-prod`.

Keep both tokens ready for the next step.

---

## 6. Step 4 — Configure GitHub Environments

GitHub Environments let you store separate secrets and variables for each deployment target.

### 6.1 Create the `development` environment

1. In your GitHub repository, go to **Settings** → **Environments**.
2. Click **New environment**, name it `development`.
3. Add the following **secret** and **variables**:

| Type | Name | Value |
|------|------|-------|
| Secret | `RAILWAY_TOKEN` | The `github-actions-dev` token from step 5 |
| Variable | `RAILWAY_BACKEND_SERVICE` | `backend` (the service name inside `zenith-dev`) |
| Variable | `RAILWAY_FRONTEND_SERVICE` | `frontend` (the service name inside `zenith-dev`) |

### 6.2 Create the `production` environment

1. Click **New environment**, name it `production`.
2. Optionally enable **Required reviewers** to enforce manual approval before production deployments.
3. Add the following **secret** and **variables**:

| Type | Name | Value |
|------|------|-------|
| Secret | `RAILWAY_TOKEN` | The `github-actions-prod` token from step 5 |
| Variable | `RAILWAY_BACKEND_SERVICE` | `backend` (the service name inside `zenith-prod`) |
| Variable | `RAILWAY_FRONTEND_SERVICE` | `frontend` (the service name inside `zenith-prod`) |

> **Secrets** are encrypted and never visible in logs. **Variables** appear in logs — using them for non-sensitive service names is intentional.

---

## 7. Step 5 — Trigger the first deployment

### Deploy to development

Push any commit to the `dev` branch (or create the branch if it does not exist):

```
GitHub → your branch → create PR targeting dev → merge
```

Or trigger manually:

```
GitHub → Actions → "Deploy to Railway" → Run workflow → select branch: dev
```

### Deploy to production

Push (or merge a PR) to `main`:

```
GitHub → Actions → "Deploy to Railway" → Run workflow → select branch: main
```

The workflow automatically selects the correct Railway project based on the branch:

| Branch | GitHub Environment used | Railway project |
|--------|------------------------|-----------------|
| `dev`  | `development`          | `zenith-dev`    |
| `main` | `production`           | `zenith-prod`   |

---

## 8. Step 6 — Verify the deployment

### Monitor the CI/CD run

1. Go to **GitHub → Actions → Deploy to Railway**.
2. Watch the two jobs: `Deploy Backend` and `Deploy Frontend`.
3. Both jobs display the environment name in parentheses, e.g. `Deploy Backend (production)`.

### Check Railway

1. Open the Railway project → the **backend** service → **Deployments** tab.
2. The latest deployment should show a green **Active** status.

### Health check

Once deployed, the backend exposes a health endpoint. Open your browser or use the Railway **shell** feature:

```
GET https://<your-backend-url>/health
→ {"status":"ok","service":"zenith-backend"}
```

The public URL is visible in the backend service → **Settings** → **Domains**.

---

## 9. How CI/CD works (day-to-day)

```
Developer workflow
──────────────────
  feature branch
       │
       ▼
  Pull Request → dev
       │ (merge)
       ▼
  dev branch  ──► GitHub Actions ──► Deploy to zenith-dev  (development)
       │
  Pull Request → main
       │ (merge, optional: requires reviewer approval)
       ▼
  main branch ──► GitHub Actions ──► Deploy to zenith-prod (production)
```

1. Develop in a feature branch.
2. Open a PR to `dev` → merge → GitHub Actions deploys to `zenith-dev` automatically.
3. Test on the development URL.
4. Open a PR from `dev` to `main` → merge → GitHub Actions deploys to `zenith-prod` automatically.

**Manual redeploy** (without a code change):

```
GitHub → Actions → "Deploy to Railway" → Run workflow → choose branch
```

---

## 10. Environment variable reference

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | *(auto-injected)* | PostgreSQL connection string — linked from the Railway postgres service |
| `SECRET_KEY` | ✅ | — | JWT signing secret |
| `ALGORITHM` | | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | | `30` | JWT TTL in minutes |
| `HD_WALLET_SEED` | ✅ | — | BIP-39 mnemonic for HD wallet deposit-address derivation |
| `ETH_RPC_URL` | | `https://cloudflare-eth.com` | Ethereum JSON-RPC endpoint |
| `USDT_CONTRACT_ADDRESS` | | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | USDT ERC-20 contract address |
| `BLOCKCHAIN_POLL_INTERVAL` | | `30` | Seconds between blockchain polls |
| `MARKET_POLL_INTERVAL` | | `60` | Seconds between market data polls |
| `PORT` | | *(auto-injected)* | HTTP port — Railway injects this automatically |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKEND_URL` | ✅ | — | Public URL of the backend service (no trailing slash) |
| `PORT` | | *(auto-injected)* | HTTP port — Railway injects this automatically |

### GitHub Environments (per environment)

| Type | Name | Description |
|------|------|-------------|
| Secret | `RAILWAY_TOKEN` | Railway project-scoped API token |
| Variable | `RAILWAY_BACKEND_SERVICE` | Name of the backend service in the Railway project |
| Variable | `RAILWAY_FRONTEND_SERVICE` | Name of the frontend service in the Railway project |

---

## 11. Troubleshooting

### Deployment job fails with "service not found"

- Check that `RAILWAY_BACKEND_SERVICE` / `RAILWAY_FRONTEND_SERVICE` in the GitHub Environment match the **exact** service names shown in the Railway dashboard.
- Verify that `RAILWAY_TOKEN` in the GitHub Environment belongs to the correct Railway **project** (dev token for `development` environment, prod token for `production` environment).

### Frontend returns 502 on `/api/` routes

- Confirm `BACKEND_URL` in the frontend service's Railway variables is the correct public URL of the backend service, with no trailing slash.
- Check that the backend service is in **Active** status in the Railway dashboard.

### Backend fails to start: database connection error

- Open the backend service → **Variables** tab and confirm `DATABASE_URL` is listed (it should be referenced from the postgres service, not typed manually).
- If missing, click **+ Add Reference** → select the postgres service → select `DATABASE_URL`.

### HD wallet seed not configured

- Set `HD_WALLET_SEED` in the Railway dashboard under the backend service's Variables tab.
- You can generate a new mnemonic at [iancoleman.io/bip39](https://iancoleman.io/bip39) — choose 12 or 24 words and copy the **BIP39 Mnemonic** field.
- ⚠️ **Never commit the mnemonic to version control.**

### Workflow picks the wrong environment

- The workflow uses `github.ref_name == 'main'` to choose `production`; any other branch (including `dev`) uses `development`.
- Automatic deployment on push only fires for `main` and `dev` (the `on.push.branches` filter).
- If you trigger the workflow manually via `workflow_dispatch` on a feature branch, it will deploy to the `development` environment/project. Avoid doing this unless intentional.
