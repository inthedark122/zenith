"""Periodic exchange balance sync loop for the trading worker.

Refreshes USDT balance for all verified exchange connections every
EXCHANGE_SYNC_INTERVAL seconds. Updates the cached balance columns on
user_exchanges so the backend can serve balance data without calling
exchanges directly (which would use the Railway IP, not the worker IP).
"""

import asyncio
import logging
from datetime import datetime

import app.models  # ensure all models registered before any query  # noqa: F401
import ccxt

from app.db.session import SessionLocal
from app.models.exchange import EXCHANGE_STATUS_VERIFIED, UserExchange

log = logging.getLogger(__name__)

EXCHANGE_SYNC_INTERVAL = 300  # 5 minutes


def _fetch_usdt_balance(exc_row: UserExchange) -> tuple[float | None, float | None, str | None]:
    """Fetch USDT balance synchronously. Returns (free, total, error)."""
    try:
        exchange_cls = getattr(ccxt, exc_row.exchange_id, None)
        if exchange_cls is None:
            return None, None, f"Unsupported exchange: {exc_row.exchange_id}"

        client = exchange_cls({
            "enableRateLimit": True,
            "apiKey": exc_row.api_key,
            "secret": exc_row.api_secret,
            "password": exc_row.passphrase or "",
        })

        params = {"type": "trading"} if exc_row.exchange_id == "okx" else {}
        raw = client.fetch_balance(params)

        free = float(raw.get("free", {}).get("USDT", 0.0))
        total = float(raw.get("total", {}).get("USDT", 0.0))
        return free, total, None

    except Exception as e:
        return None, None, str(e)


async def _sync_all_balances() -> None:
    db = SessionLocal()
    try:
        verified = (
            db.query(UserExchange)
            .filter(UserExchange.status == EXCHANGE_STATUS_VERIFIED)
            .all()
        )
        log.info("Exchange sync: refreshing balance for %d verified connections", len(verified))

        for exc_row in verified:
            free, total, error = await asyncio.get_running_loop().run_in_executor(
                None, _fetch_usdt_balance, exc_row
            )
            if error:
                log.warning(
                    "Balance sync failed for %s (user %d): %s",
                    exc_row.exchange_id, exc_row.user_id, error
                )
                # Don't change verified status on transient failures
            else:
                exc_row.balance_usdt_free = free
                exc_row.balance_usdt_total = total
                exc_row.balance_updated_at = datetime.utcnow()
                log.debug(
                    "Balance synced for %s (user %d): free=%.2f total=%.2f",
                    exc_row.exchange_id, exc_row.user_id, free, total
                )

        db.commit()
    except Exception:
        log.exception("Error in exchange sync loop")
        db.rollback()
    finally:
        db.close()


async def exchange_sync_loop() -> None:
    """Runs every EXCHANGE_SYNC_INTERVAL seconds, refreshing balance for verified exchanges."""
    log.info("Exchange sync loop starting (interval: %ds)", EXCHANGE_SYNC_INTERVAL)
    while True:
        await _sync_all_balances()
        await asyncio.sleep(EXCHANGE_SYNC_INTERVAL)
