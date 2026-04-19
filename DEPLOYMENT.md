# 🚀 Railway Deployment Guide

This guide walks you through deploying **Zenith** to [Railway](https://railway.app) using **Railway Auto Deploy** — **no local tools required**.

Everything is configured through the Railway dashboard and GitHub repository settings.

---

## Table of Contents

1. [Environments overview](#1-environments-overview)
2. [Architecture on Railway](#2-architecture-on-railway)
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
5. Name the service `BackEnd`.

### 3.4 Link the database to the backend

1. Open the **BackEnd** service → **Variables** tab.
2. Click **+ Add Reference** → select the **Postgres** service → select `DATABASE_URL`.

Railway will inject `DATABASE_URL` into the backend container on every deployment.

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
| `HD_WALLET_SEED` | ✅ | — | BIP-39 mnemonic for HD wallet deposit-address derivation |
| `ETH_RPC_URL` | | `https://cloudflare-eth.com` | Ethereum JSON-RPC endpoint |
| `USDT_CONTRACT_ADDRESS` | | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | USDT ERC-20 contract address |
| `BLOCKCHAIN_POLL_INTERVAL` | | `30` | Seconds between blockchain polls |
| `MARKET_POLL_INTERVAL` | | `60` | Seconds between market data polls |
| `PORT` | | *(unused by frontend)* | Frontend nginx listens on port `80` |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKEND_URL` | ✅ | — | Public URL of the backend service (no trailing slash) |
| `PORT` | | *(auto-injected)* | HTTP port — Railway injects this automatically |

## 10. Troubleshooting

### Auto Deploy does not trigger

- Open the Railway service → **Settings** → **Source** and confirm **Auto Deploy** is enabled.
- Verify the service is connected to the correct repository and branch.
- Confirm the service **Root Directory** is correct: `backend` for **BackEnd**, `frontend` for **FrontEnd**.

### Frontend returns 502 on `/api/` routes

- Confirm `BACKEND_URL` in the **FrontEnd** service's Railway variables is the correct public URL of the **BackEnd** service, with no trailing slash.
- Check that the backend service is in **Active** status in the Railway dashboard.

### Backend fails to start: database connection error

- Open the **BackEnd** service → **Variables** tab and confirm `DATABASE_URL` is listed (it should be referenced from the **Postgres** service, not typed manually).
- If missing, click **+ Add Reference** → select the **Postgres** service → select `DATABASE_URL`.

### HD wallet seed not configured

- Set `HD_WALLET_SEED` in the Railway dashboard under the backend service's Variables tab.
- You can generate a new mnemonic at [iancoleman.io/bip39](https://iancoleman.io/bip39) — choose 12 or 24 words and copy the **BIP39 Mnemonic** field.
- ⚠️ **Never commit the mnemonic to version control.**

### Wrong project or branch deploys

- Check each Railway service's **Source** settings and confirm the intended branch is selected.
- A service only auto-deploys for the repository and branch currently connected in Railway.
