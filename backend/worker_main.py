"""Trading Worker — standalone entry point.

Runs the market-listener orchestrator as a dedicated process (Hetzner VPS).
Acquires a Postgres advisory lock before starting to prevent duplicate
execution if two instances are accidentally launched at the same time.
"""

import asyncio
import logging
import sys

from sqlalchemy import text

from app.db.session import SessionLocal
from app.workers.market_listener import market_listener_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger(__name__)

# Unique advisory lock ID — identifies the trading worker singleton.
_LOCK_ID = 7254321987


async def main() -> None:
    # Keep this session open for the process lifetime — advisory lock is
    # released automatically when the connection closes.
    lock_session = SessionLocal()
    try:
        row = lock_session.execute(
            text("SELECT pg_try_advisory_lock(:id)"), {"id": _LOCK_ID}
        ).fetchone()
        if not row[0]:
            log.error(
                "Another trading worker is already running (pg advisory lock held). Exiting."
            )
            sys.exit(1)

        log.info("Singleton advisory lock acquired. Trading worker starting.")
        await market_listener_loop()
    finally:
        lock_session.close()


if __name__ == "__main__":
    asyncio.run(main())
