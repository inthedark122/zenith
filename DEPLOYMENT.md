# 🚀 Railway Deployment Guide

This guide walks you through deploying **Zenith** to [Railway](https://railway.app) for the first time, and configuring GitHub Actions so every push to `main` redeploys the application automatically.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture on Railway](#2-architecture-on-railway)
3. [One-time Railway Project Setup](#3-one-time-railway-project-setup)
4. [Configure Environment Variables](#4-configure-environment-variables)
5. [Connect GitHub for CI/CD](#5-connect-github-for-cicd)
6. [Verify the Deployment](#6-verify-the-deployment)
7. [Subsequent Deployments](#7-subsequent-deployments)
8. [Environment Variable Reference](#8-environment-variable-reference)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Tool | Purpose |
|------|---------|
| [Railway account](https://railway.app) | Hosting platform |
| [Railway CLI](https://docs.railway.app/guides/cli) | Local management (`npm i -g @railway/cli`) |
| GitHub repository | Source of truth for CI/CD |
| A BIP-39 mnemonic (12–24 words) | HD wallet seed for deposit address derivation |

Install and authenticate the Railway CLI:

```bash
npm install -g @railway/cli
railway login
```

---

## 2. Architecture on Railway

```
Railway Project: zenith
├── Service: postgres   ← Managed PostgreSQL (Railway plugin)
├── Service: backend    ← Python / FastAPI  (./backend/Dockerfile)
└── Service: frontend   ← React / nginx     (./frontend/Dockerfile)
```

The **backend** service connects to **postgres** using the `DATABASE_URL` variable that Railway injects automatically when services are linked.

The **frontend** nginx container proxies all `/api/` requests to the backend using the `BACKEND_URL` environment variable you configure below.

---

## 3. One-time Railway Project Setup

### 3.1 Create the project

```bash
railway init
# When prompted, choose "Empty project" and name it "zenith"
```

Or create a project from the [Railway dashboard](https://railway.app/new).

### 3.2 Add a PostgreSQL database

In the Railway dashboard for your project:

1. Click **+ New** → **Database** → **Add PostgreSQL**.
2. Railway provisions a managed Postgres instance and exposes `DATABASE_URL` automatically.

### 3.3 Create the backend service

```bash
# From the repo root
cd backend
railway service create backend
railway up --service backend --detach
```

Or in the dashboard: **+ New** → **GitHub Repo** → select this repo → set **Root Directory** to `backend`.

### 3.4 Create the frontend service

```bash
cd ../frontend
railway service create frontend
railway up --service frontend --detach
```

Or in the dashboard: **+ New** → **GitHub Repo** → select this repo → set **Root Directory** to `frontend`.

### 3.5 Link the backend service to the Postgres database

In the Railway dashboard:

1. Open the **backend** service → **Variables** tab.
2. Click **+ Add Reference** → select the **postgres** service → select `DATABASE_URL`.

Railway will now automatically inject `DATABASE_URL` into the backend container whenever the Postgres service is redeployed.

---

## 4. Configure Environment Variables

### 4.1 Backend service variables

Set these in the Railway dashboard under **backend → Variables**, or via the CLI:

```bash
railway variables set SECRET_KEY="<random-32+-char-string>" --service backend
railway variables set ALGORITHM="HS256" --service backend
railway variables set ACCESS_TOKEN_EXPIRE_MINUTES="30" --service backend
railway variables set HD_WALLET_SEED="<your 12-word BIP-39 mnemonic>" --service backend
railway variables set ETH_RPC_URL="https://cloudflare-eth.com" --service backend
railway variables set USDT_CONTRACT_ADDRESS="0xdAC17F958D2ee523a2206206994597C13D831ec7" --service backend
railway variables set BLOCKCHAIN_POLL_INTERVAL="30" --service backend
railway variables set MARKET_POLL_INTERVAL="60" --service backend
```

> **Generate a secure secret key:**
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

> **Generate a BIP-39 mnemonic:**
> ```bash
> python -c "from eth_account.hdaccount import generate_mnemonic; print(generate_mnemonic(12, lang='english'))"
> ```

### 4.2 Frontend service variables

The frontend nginx needs to know the backend's public URL so it can proxy `/api/` requests.

1. In the Railway dashboard, open the **backend** service → **Settings** → copy the **Public URL** (e.g., `https://backend-production-xxxx.up.railway.app`).
2. Open the **frontend** service → **Variables**:

```bash
railway variables set BACKEND_URL="https://backend-production-xxxx.up.railway.app" --service frontend
# PORT is injected automatically by Railway — no need to set it manually
```

---

## 5. Connect GitHub for CI/CD

### 5.1 Get a Railway API token

1. In the Railway dashboard → **Account Settings** → **Tokens**.
2. Click **+ New Token**, name it `github-actions`, copy the value.

### 5.2 Get service names

```bash
railway service list
# Note the exact names of your "backend" and "frontend" services
```

### 5.3 Add secrets and variables to GitHub

In your GitHub repository → **Settings** → **Secrets and variables** → **Actions**:

| Type | Name | Value |
|------|------|-------|
| **Secret** | `RAILWAY_TOKEN` | Your Railway API token from step 5.1 |
| **Variable** | `RAILWAY_BACKEND_SERVICE` | Railway service name, e.g. `backend` |
| **Variable** | `RAILWAY_FRONTEND_SERVICE` | Railway service name, e.g. `frontend` |

> **Secrets** are encrypted and hidden in logs. **Variables** are visible in logs — using them for non-sensitive service names is intentional.

### 5.4 How the workflow works

The workflow file lives at `.github/workflows/deploy.yml` and triggers on every push to `main`:

1. **deploy-backend** — runs `railway up --service backend --detach` from the `./backend` directory, uploading the latest code and rebuilding the Docker image.
2. **deploy-frontend** — runs `railway up --service frontend --detach` from the `./frontend` directory after the backend job succeeds.

To trigger it manually (e.g., without a code push):

```
GitHub → Actions → "Deploy to Railway" → Run workflow
```

---

## 6. Verify the Deployment

### 6.1 Check service status

```bash
railway status --service backend
railway status --service frontend
```

Or watch the build logs in the Railway dashboard → service → **Deployments**.

### 6.2 Health check

The backend exposes a `/health` endpoint:

```bash
curl https://<your-backend-url>/health
# Expected: {"status":"ok","service":"zenith-backend"}
```

### 6.3 Open the app

```bash
railway open --service frontend
```

---

## 7. Subsequent Deployments

Every push to the `main` branch automatically triggers the GitHub Actions workflow, which redeploys both services.

If you only changed the backend, the frontend deployment is still triggered (idempotent — Railway skips if the image is unchanged).

To redeploy manually from the CLI:

```bash
cd backend && railway up --service backend --detach
cd ../frontend && railway up --service frontend --detach
```

---

## 8. Environment Variable Reference

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string (auto-injected by Railway when linked) |
| `SECRET_KEY` | ✅ | — | JWT signing secret — use a long random string |
| `ALGORITHM` | | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | | `30` | JWT TTL in minutes |
| `HD_WALLET_SEED` | ✅ | — | BIP-39 mnemonic for HD wallet deposit address derivation |
| `ETH_RPC_URL` | | `https://cloudflare-eth.com` | Ethereum JSON-RPC endpoint |
| `USDT_CONTRACT_ADDRESS` | | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | USDT ERC-20 contract (mainnet) |
| `BLOCKCHAIN_POLL_INTERVAL` | | `30` | Seconds between blockchain polls |
| `MARKET_POLL_INTERVAL` | | `60` | Seconds between market data polls |
| `PORT` | | `8000` | HTTP port (auto-injected by Railway) |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKEND_URL` | ✅ | — | Full URL of the backend service, e.g. `https://backend-xxxx.up.railway.app` |
| `PORT` | | `80` | HTTP port (auto-injected by Railway) |

---

## 9. Troubleshooting

### Frontend returns 502 on `/api/` routes

- Check that `BACKEND_URL` is set correctly on the frontend service (no trailing slash).
- Check that the backend service is healthy: `railway status --service backend`.

### Backend fails to start with a database error

- Verify that the PostgreSQL service is running and that `DATABASE_URL` is linked to the backend service.
- Railway injects `DATABASE_URL` automatically only after you add the reference in the Variables tab.

### `railway up` fails with "project not found"

- Ensure you are authenticated: `railway login`.
- If running locally, link the project first: `railway link`.
- In GitHub Actions, confirm `RAILWAY_TOKEN` secret and `RAILWAY_BACKEND_SERVICE` / `RAILWAY_FRONTEND_SERVICE` variables are set correctly.

### HD wallet seed not configured

Generate a new mnemonic and set it as the `HD_WALLET_SEED` variable:

```bash
python -c "from eth_account.hdaccount import generate_mnemonic; print(generate_mnemonic(12, lang='english'))"
```

⚠️ **Never commit the mnemonic to version control.** Store it only in Railway's encrypted variable storage.
