"""
Order Stream — cross-strategy real-time order fill listener.

Maintains one persistent WebSocket connection per active user exchange using
CCXT Pro's ``watch_orders()`` feed.  When an order fill arrives, the fill is
matched to a ``StrategyTrade`` record and dispatched to the appropriate
strategy module's ``handle_fill()`` function.

Strategy modules expose an optional function::

    def handle_fill(
        worker: StrategyWorker,
        trade: StrategyTrade,
        order: dict,        # raw CCXT order dict (always status 'closed'/'filled')
        is_tp_fill: bool,   # True if this is the TP sell order
        db: Session,
    ) -> None: ...

Each fill is processed in its own DB transaction.  Concurrent fills for
different symbols are safe because they affect different trade records.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

import ccxt.pro as ccxtpro

import app.models  # ensure all models registered  # noqa: F401
from app.db.session import SessionLocal
from app.models.exchange import UserExchange
from app.models.trade import StrategyTrade, TradeStatus
from app.models.worker import StrategyWorker, WorkerStatus

log = logging.getLogger(__name__)


def _get_strategy_impl() -> Dict[str, Any]:
    """Import lazily to avoid circular imports at module load time."""
    from app.workers.market_listener import _STRATEGY_IMPL  # noqa: PLC0415
    return _STRATEGY_IMPL


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def order_stream_loop() -> None:
    """
    Entry point: discover active user exchanges every 30 s and maintain one
    watch_orders() task per exchange.  Runs forever.
    """
    log.info("Order stream loop started.")
    tasks: Dict[int, asyncio.Task] = {}  # user_exchange_id → Task

    while True:
        try:
            active = _get_active_exchange_credentials()
        except Exception as exc:
            log.error("order_stream_loop: failed to query active exchanges: %s", exc)
            await asyncio.sleep(30)
            continue

        # Start tasks for newly active exchanges
        for ue_id, creds in active.items():
            if ue_id not in tasks or tasks[ue_id].done():
                tasks[ue_id] = asyncio.create_task(
                    _watch_exchange_orders(ue_id, creds),
                    name=f"order-stream-{ue_id}",
                )
                log.info("Order stream: started watcher for user_exchange #%d", ue_id)

        # Cancel tasks for exchanges no longer in use
        for ue_id in list(tasks):
            if ue_id not in active:
                log.info("Order stream: stopping watcher for user_exchange #%d (no running workers)", ue_id)
                tasks[ue_id].cancel()
                try:
                    await asyncio.wait_for(tasks[ue_id], timeout=5)
                except (asyncio.CancelledError, asyncio.TimeoutError):
                    pass
                del tasks[ue_id]

        await asyncio.sleep(30)


# ---------------------------------------------------------------------------
# Per-exchange watcher
# ---------------------------------------------------------------------------

async def _watch_exchange_orders(user_exchange_id: int, creds: dict) -> None:
    """
    Maintain a persistent WS connection for one user exchange.
    Auto-reconnects on transient errors; exits cleanly on CancelledError.
    """
    exchange_id = creds["exchange_id"]
    exchange_cls = getattr(ccxtpro, exchange_id, None)
    if exchange_cls is None:
        log.error("order_stream: ccxt.pro has no '%s' — watcher not started", exchange_id)
        return

    exchange = exchange_cls({
        "enableRateLimit": True,
        "apiKey": creds["api_key"],
        "secret": creds["api_secret"],
        "password": creds.get("passphrase", ""),
    })

    try:
        while True:
            try:
                orders = await exchange.watch_orders()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                log.warning(
                    "order_stream: WS error for exchange %s (#%d): %s — reconnecting in 5s",
                    exchange_id, user_exchange_id, exc,
                )
                await asyncio.sleep(5)
                continue

            # Process fills in a thread to avoid blocking the event loop
            filled = [o for o in (orders or []) if o.get("status") in ("closed", "filled")]
            if filled:
                await asyncio.to_thread(
                    _process_fills_sync, user_exchange_id, filled
                )
    except asyncio.CancelledError:
        log.info("order_stream: watcher for exchange #%d cancelled", user_exchange_id)
    finally:
        try:
            await exchange.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Fill processor (runs in thread)
# ---------------------------------------------------------------------------

def _process_fills_sync(user_exchange_id: int, orders: list) -> None:
    """
    Match each filled order to a StrategyTrade and dispatch to the owning
    strategy's handle_fill().  Each fill is committed in its own transaction.
    """
    for order in orders:
        order_id = str(order.get("id", ""))
        if not order_id:
            continue
        try:
            _handle_one_fill(user_exchange_id, order_id, order)
        except Exception as exc:
            log.exception(
                "order_stream: unhandled error processing fill for order %s: %s",
                order_id, exc,
            )


def _handle_one_fill(user_exchange_id: int, order_id: str, order: dict) -> None:
    """
    Look up the trade matching *order_id*, dispatch to the strategy handler,
    commit.  Uses its own DB session so failures are isolated per fill.
    """
    db = SessionLocal()
    try:
        # Load all active/pending trades for this user_exchange in one query
        active_trades = (
            db.query(StrategyTrade)
            .join(StrategyWorker, StrategyTrade.worker_id == StrategyWorker.id)
            .join(UserExchange, StrategyWorker.user_exchange_id == UserExchange.id)
            .filter(
                UserExchange.id == user_exchange_id,
                StrategyTrade.status.in_([TradeStatus.OPEN, TradeStatus.PENDING]),
            )
            .all()
        )

        matched_trade: Optional[StrategyTrade] = None
        is_tp_fill = False

        for t in active_trades:
            tp_oid = t.details.get("tp_order_id") if t.details else None
            pos_oid = t.details.get("order_id") if t.details else None

            if tp_oid and tp_oid == order_id:
                matched_trade = t
                is_tp_fill = True
                break
            if pos_oid and pos_oid == order_id:
                matched_trade = t
                break

        if matched_trade is None:
            # Not one of ours — could be a manual order, ignore silently
            return

        worker = matched_trade.worker
        if worker is None or worker.strategy is None:
            return

        strategy_key = worker.strategy.strategy
        impl = _get_strategy_impl().get(strategy_key)
        if impl is None or not hasattr(impl, "handle_fill"):
            log.debug(
                "order_stream: strategy '%s' has no handle_fill — skipping fill for order %s",
                strategy_key, order_id,
            )
            return

        log.info(
            "order_stream: dispatching fill order_id=%s symbol=%s is_tp=%s → strategy=%s",
            order_id, matched_trade.symbol, is_tp_fill, strategy_key,
        )
        impl.handle_fill(worker, matched_trade, order, is_tp_fill, db)
        db.commit()

    except Exception as exc:
        log.exception(
            "order_stream: error handling fill order_id=%s user_exchange_id=%d: %s",
            order_id, user_exchange_id, exc,
        )
        db.rollback()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_active_exchange_credentials() -> Dict[int, dict]:
    """
    Return {user_exchange_id: credential_snapshot} for all user exchanges
    that have at least one running StrategyWorker.
    """
    db = SessionLocal()
    try:
        workers = (
            db.query(StrategyWorker)
            .filter(StrategyWorker.status == WorkerStatus.RUNNING)
            .all()
        )
        result: Dict[int, dict] = {}
        for w in workers:
            if w.user_exchange_id and w.user_exchange:
                ue = w.user_exchange
                result[ue.id] = {
                    "exchange_id": ue.exchange_id,
                    "api_key": ue.api_key,
                    "api_secret": ue.api_secret,
                    "passphrase": ue.passphrase or "",
                }
        return result
    finally:
        db.close()
