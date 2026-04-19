import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import settings
from app.workers.blockchain_listener import blockchain_listener_loop
from app.workers.market_listener import market_listener_loop

log = logging.getLogger(__name__)

app = FastAPI(
    title="Zenith Crypto Trading Bot",
    description="API for Zenith crypto trading bot with MACD D1 strategy, MLM referrals, and subscription management",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    """Create DB tables (if needed) and launch background workers."""
    # Import all models so SQLAlchemy registers them before create_all
    from app.db.base import Base
    from app.db.session import engine

    # noqa: F401 — side-effect imports to register ORM metadata
    import app.models.exchange      # noqa: F401
    import app.models.referral      # noqa: F401
    import app.models.strategy      # noqa: F401
    import app.models.subscription  # noqa: F401
    import app.models.trade         # noqa: F401
    import app.models.user          # noqa: F401
    import app.models.wallet        # noqa: F401
    import app.models.worker        # noqa: F401

    Base.metadata.create_all(bind=engine)

    asyncio.create_task(market_listener_loop())
    if settings.EVM_PAYMENTS_ENABLED:
        asyncio.create_task(blockchain_listener_loop())
        log.info("Background workers started: market_listener, blockchain_listener")
    else:
        log.info("Background workers started: market_listener")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "zenith-backend"}
