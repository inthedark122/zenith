# ⚡ Zenith — Crypto Trading Bot

Zenith is a fully automated crypto trading platform with a DCA (Dollar-Cost Averaging) strategy engine, blockchain-based subscription payments, and a 3-level MLM referral system.

---

## 🚀 Quick Start

```bash
# 1. Clone and enter the repo
git clone https://github.com/livectar/zenith && cd zenith

# 2. Copy env template
cp backend/.env.example backend/.env
# Edit backend/.env with your real values

# 3. Start everything with Docker Compose
docker compose up --build
```

| Service  | URL                    |
|----------|------------------------|
| Frontend | http://localhost:3000  |
| Backend  | http://localhost:8000  |
| API Docs | http://localhost:8000/docs |

---

## 🏗️ Architecture

```
zenith/
├── backend/          # Python · FastAPI · SQLAlchemy · ccxt
│   └── app/
│       ├── api/      # REST route handlers
│       ├── core/     # Config, security, deps
│       ├── db/       # SQLAlchemy engine & base
│       ├── models/   # ORM models
│       ├── schemas/  # Pydantic DTOs
│       └── services/ # Business logic (DCA, MLM, wallet, exchange)
├── frontend/         # React 18 · Vite · TypeScript · Zustand · React Query
│   └── src/
│       ├── api/      # Axios client
│       ├── components/ # Shared components (BottomNav, Layout)
│       ├── pages/    # Login, Home, Wallets, Trading, Referral, UserCenter
│       └── store/    # Zustand auth store
└── docker-compose.yml
```

---

## 💳 Subscription Tiers

| Plan    | Coins | Monthly Price |
|---------|-------|---------------|
| Starter | 1     | $15 USDT      |
| Pro     | 2     | $20 USDT      |
| Elite   | 3     | $25 USDT      |

- **Capital is free** — users bring their own exchange margin.
- Subscriptions are paid from the in-app USDT wallet.
- Deposits are made by sending USDT on-chain to the platform address.

---

## 📈 DCA Strategy

Dollar-Cost Averaging places a base order then automatically adds to the position as the price drops.

| Parameter          | Default |
|--------------------|---------|
| Safety order multiplier | 2× |
| Price deviation per step | 4% |
| Maximum safety orders | 6 |
| Market type | SPOT only |

**Example ladder** (base = $100, entry = $40,000):

| Order | Amount  | Target Price | Avg Cost  |
|-------|---------|-------------|-----------|
| Base  | $100    | $40,000     | $40,000   |
| SO 1  | $200    | $38,400     | ~$38,933  |
| SO 2  | $400    | $36,864     | ~$37,565  |
| SO 3  | $800    | $35,389     | ~$36,447  |
| SO 4  | $1,600  | $33,974     | ~$35,448  |
| SO 5  | $3,200  | $32,615     | ~$34,551  |
| SO 6  | $6,400  | $31,310     | ~$33,744  |

---

## 👥 MLM Referral System

Three-level commission structure applied on every subscription payment:

| Level | Relationship              | Commission |
|-------|---------------------------|------------|
| 1     | Direct referrer           | 50%        |
| 2     | Referrer's referrer       | 30%        |
| 3     | Referrer's referrer's ref | 20%        |

Commissions are paid instantly to the referrer's in-app USDT wallet when a subscription is activated.

---

## 🔌 Supported Exchanges

- **OKX** (default) — configured via `OKX_API_KEY`, `OKX_API_SECRET`, `OKX_PASSPHRASE`
- Any exchange supported by [ccxt](https://github.com/ccxt/ccxt) can be added via `ExchangeService.get_exchange()`

---

## 🛠️ Development Setup (without Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit as needed
alembic upgrade head
uvicorn app.main:app --reload

# Frontend

cd frontend
npm install
npm run dev

# Type-check
npm run typecheck

# Lint (run after making changes)
npm run lint
```

---

## 📡 API Reference

Full interactive docs at **http://localhost:8000/docs** (Swagger UI).

Key endpoints:

| Method | Endpoint                        | Description                   |
|--------|---------------------------------|-------------------------------|
| POST   | /api/auth/register              | Create account                |
| POST   | /api/auth/login                 | Obtain JWT token              |
| GET    | /api/wallet                     | Get USDT balance              |
| GET    | /api/wallet/deposit-address     | Get deposit address           |
| POST   | /api/wallet/transactions        | Submit deposit tx hash        |
| GET    | /api/subscriptions/plans        | List subscription plans       |
| POST   | /api/subscriptions              | Activate subscription         |
| POST   | /api/trading/dca-configs        | Create DCA bot config         |
| POST   | /api/trading/start/{id}         | Start a DCA bot               |
| POST   | /api/trading/stop/{id}          | Stop a DCA bot                |
| GET    | /api/referral/my-code           | Get your referral code        |
| GET    | /api/referral/community         | View your MLM downline        |
| GET    | /api/referral/commissions       | View commission history       |

---

## ⚙️ Environment Variables

| Variable                    | Description                                   |
|-----------------------------|-----------------------------------------------|
| `DATABASE_URL`              | PostgreSQL connection string                  |
| `SECRET_KEY`                | JWT signing secret (change in production!)    |
| `ALGORITHM`                 | JWT algorithm (HS256)                         |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token TTL in minutes                        |
| `OKX_API_KEY`               | OKX exchange API key                          |
| `OKX_API_SECRET`            | OKX exchange API secret                       |
| `OKX_PASSPHRASE`            | OKX exchange passphrase                       |
| `USDT_DEPOSIT_ADDRESS`      | Platform USDT deposit wallet address          |
