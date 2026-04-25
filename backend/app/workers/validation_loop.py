"""Exchange credential validation loop for the trading worker.

Uses PostgreSQL LISTEN/NOTIFY for event-driven, scalable communication with
the backend API server. The worker listens on the 'exchange_validation' channel
and validates credentials using the worker's static outbound IP.

Protocol:
  Backend  → NOTIFY exchange_validation '{task_id}'
  Worker   → validates via ccxt.fetch_balance()
  Worker   → NOTIFY validation_result_{task_id} '{"ok":true,"balance":1234.5,"error":null}'
  Worker   → updates user_exchanges.status (verified / invalid)
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta

import app.models  # ensure all models registered before any query  # noqa: F401
import asyncpg
import ccxt

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.exchange import (
    EXCHANGE_STATUS_INVALID,
    EXCHANGE_STATUS_VERIFIED,
    UserExchange,
)
from app.models.validation_task import ExchangeValidationTask
from app.utils.pg_notify import _asyncpg_dsn

log = logging.getLogger(__name__)

_LISTEN_CHANNEL = "exchange_validation"


def _validate_exchange_sync(task: ExchangeValidationTask) -> tuple[bool, float | None, str | None]:
    """Call the exchange API synchronously. Returns (ok, balance_usdt, error_msg)."""
    try:
        exchange_cls = getattr(ccxt, task.exchange_id, None)
        if exchange_cls is None:
            return False, None, f"Unsupported exchange: {task.exchange_id}"

        client = exchange_cls({
            "enableRateLimit": True,
            "apiKey": task.api_key,
            "secret": task.api_secret,
            "password": task.passphrase or "",
        })

        if getattr(task, "is_demo", False):
            client.set_sandbox_mode(True)

        # OKX uses a single unified Trading account
        params = {"type": "trading"} if task.exchange_id == "okx" else {}
        raw = client.fetch_balance(params)

        free = float(raw.get("free", {}).get("USDT", 0.0))
        total = float(raw.get("total", {}).get("USDT", 0.0))
        return True, free, None

    except Exception as e:
        return False, None, str(e)


async def _process_task(task_id: int) -> None:
    """Fetch the task, validate credentials, write result, NOTIFY backend."""
    db = SessionLocal()
    try:
        task = db.query(ExchangeValidationTask).filter_by(id=task_id).first()
        if task is None:
            log.warning("Validation task %d not found", task_id)
            return

        log.info("Validating exchange %s for task %d", task.exchange_id, task_id)

        # Run blocking ccxt call in thread pool to avoid blocking the event loop
        ok, balance, error = await asyncio.get_running_loop().run_in_executor(
            None, _validate_exchange_sync, task
        )

        # Update task record
        task.status = "done" if ok else "error"
        task.result_ok = ok
        task.result_balance = balance
        task.result_error = error

        # Update the user_exchanges status and cached balance
        exc_row = (
            db.query(UserExchange)
            .filter_by(user_id=task.user_id, exchange_id=task.exchange_id)
            .first()
        )
        if exc_row:
            exc_row.status = EXCHANGE_STATUS_VERIFIED if ok else EXCHANGE_STATUS_INVALID
            exc_row.last_error = None if ok else error
            if ok and balance is not None:
                exc_row.balance_usdt_free = balance
                exc_row.balance_usdt_total = balance
                exc_row.balance_updated_at = datetime.utcnow()

        db.commit()
        log.info("Task %d result: ok=%s balance=%s error=%s", task_id, ok, balance, error)

        # Notify the waiting backend instance
        result_payload = json.dumps({"ok": ok, "balance_usdt": balance, "error": error})
        conn = await asyncpg.connect(dsn=_asyncpg_dsn())
        try:
            await conn.execute(
                "SELECT pg_notify($1, $2)",
                f"validation_result_{task_id}",
                result_payload,
            )
        finally:
            await conn.close()

    except Exception:
        log.exception("Error processing validation task %d", task_id)
        db.rollback()
    finally:
        db.close()


async def _cleanup_old_tasks() -> None:
    """Remove validation tasks older than 1 hour."""
    cutoff = datetime.utcnow() - timedelta(hours=1)
    db = SessionLocal()
    try:
        deleted = (
            db.query(ExchangeValidationTask)
            .filter(ExchangeValidationTask.created_at < cutoff)
            .delete()
        )
        if deleted:
            db.commit()
            log.info("Cleaned up %d old validation tasks", deleted)
    finally:
        db.close()


async def _process_pending_tasks() -> None:
    """Process any tasks that were created while the worker wasn't listening.
    
    LISTEN/NOTIFY is fire-and-forget — if the worker was down when NOTIFY was
    sent, those tasks are stuck at 'processing'. Scan for them on startup.
    """
    db = SessionLocal()
    try:
        stuck = (
            db.query(ExchangeValidationTask)
            .filter(ExchangeValidationTask.status == "processing")
            .all()
        )
        if stuck:
            log.info("Found %d pending validation task(s) missed while offline, processing now", len(stuck))
            for task in stuck:
                asyncio.create_task(_process_task(task.id))
    finally:
        db.close()


async def validation_loop() -> None:
    """
    Main validation loop. Subscribes to LISTEN exchange_validation and
    processes incoming tasks. Runs for the lifetime of the worker process.
    """
    log.info("Exchange validation loop starting — LISTEN %s", _LISTEN_CHANNEL)
    await _cleanup_old_tasks()
    await _process_pending_tasks()

    while True:
        try:
            conn = await asyncpg.connect(dsn=_asyncpg_dsn())

            async def _on_notify(connection: asyncpg.Connection, pid: int, channel: str, payload: str) -> None:
                try:
                    task_id = int(payload.strip())
                    asyncio.create_task(_process_task(task_id))
                except ValueError:
                    log.warning("Invalid validation task payload: %r", payload)

            await conn.add_listener(_LISTEN_CHANNEL, _on_notify)
            log.info("Validation loop listening on channel '%s'", _LISTEN_CHANNEL)

            # Keep the connection alive; reconnect if it drops
            while not conn.is_closed():
                await asyncio.sleep(5)

        except asyncpg.PostgresConnectionStatusError:
            log.warning("Validation loop DB connection lost, reconnecting in 5s")
            await asyncio.sleep(5)
        except Exception:
            log.exception("Unexpected error in validation loop, restarting in 5s")
            await asyncio.sleep(5)
