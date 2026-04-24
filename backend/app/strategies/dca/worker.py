"""
DCA — strategy worker implementation.

Strategy rules
--------------
- Symbols    : admin-configured list
- Direction  : LONG only (spot / 1×)
- Cycle      : one DCA cycle per symbol at a time
    * Order #1 — opened immediately when no active cycle exists
    * Order #N — opened when price drops ``step_percent``% from last entry
    * Maximum ``max_orders`` orders per cycle
    * Take profit when price ≥ weighted average entry × (1 + take_profit_percent / 100)
    * When TP is hit all open orders in the cycle are closed as WIN
    * After the cycle closes, a new one starts on the next poll tick

Settings (from Strategy.settings JSON)
---------------------------------------
    amount_multiplier   — safety order amount = prev_amount × multiplier   (default 2.0)
    step_percent        — % price drop from last entry to trigger next order (default 0.5)
    max_orders          — max orders per cycle incl. initial order           (default 5)
    take_profit_percent — TP % above weighted avg entry                      (default 1.0)
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Dict, Optional

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.exchange.order_executor import (
    build_authenticated_exchange,
    close_long_position,
    get_open_position_size,
    open_long_position,
)
from app.models.trade import StrategyTrade, TradeStatus
from app.models.worker import StrategyWorker
from app.strategies.dca.strategy import (
    calculate_avg_entry,
    calculate_base_order,
    calculate_next_amount,
    calculate_take_profit,
)

log = logging.getLogger(__name__)


def run_for_worker(
    worker: StrategyWorker,
    latest_signals: Dict,        # unused — DCA needs no entry signal
    current_prices: Dict[str, float],
    db: Session,
) -> None:
    """
    Evaluate the DCA strategy for a single running worker.

    Steps per symbol
    ----------------
    1. Load all OPEN orders for this worker + symbol (current cycle).
    2. If no open orders → start a new cycle (order #1 at market).
    3. If open orders exist:
       a. Recalculate avg entry and TP.
       b. If current price ≥ TP → close all orders as WIN (close exchange position).
       c. Else if price dropped ≥ step_percent from last entry
          and order_count < max_orders → open next safety order.

    Exchange integration
    --------------------
    worker.user_exchange_id must be set. If it is None, trades are skipped.
    Real market orders are placed via CCXT. If an order fails (e.g. min size),
    the trade is skipped for this cycle but the worker loop continues.
    """
    if worker.user_exchange_id is None or worker.user_exchange is None:
        log.warning(
            "Worker #%d: no exchange connected — skipping (connect an API key to trade)",
            worker.id,
        )
        return

    strategy = worker.strategy
    settings = strategy.settings or {}

    amount_multiplier: float = float(settings.get("amount_multiplier", 2.0))
    step_percent: float = float(settings.get("step_percent", 0.5))
    max_orders: int = int(settings.get("max_orders", 5))
    take_profit_percent: float = float(settings.get("take_profit_percent", 1.0))

    # Respect the user's token selection (empty list = trade all strategy symbols)
    allowed_symbols: set = set(worker.selected_symbols or [])

    # Build authenticated exchange client once per worker cycle
    try:
        exchange_client = build_authenticated_exchange(worker.user_exchange)
    except Exception as exc:
        log.error("Worker #%d: cannot build exchange client: %s", worker.id, exc)
        return

    for sym_cfg in (strategy.symbols or []):
        symbol: str = sym_cfg["symbol"] if isinstance(sym_cfg, dict) else sym_cfg
        if allowed_symbols and symbol not in allowed_symbols:
            continue
        sym_market_type: str = sym_cfg.get("market_type", "spot") if isinstance(sym_cfg, dict) else "spot"
        sym_leverage: int = int(sym_cfg.get("leverage", 1)) if isinstance(sym_cfg, dict) else 1

        current_price = current_prices.get(symbol)
        if current_price is None:
            log.warning("Worker #%d: no price for %s — skipping", worker.id, symbol)
            continue

        open_orders = (
            db.query(StrategyTrade)
            .filter(
                StrategyTrade.worker_id == worker.id,
                StrategyTrade.symbol == symbol,
                StrategyTrade.status == TradeStatus.OPEN,
            )
            .order_by(StrategyTrade.created_at.asc())
            .all()
        )
        order_count = len(open_orders)

        if order_count == 0:
            # ── Start new DCA cycle ────────────────────────────────────────
            # Per-symbol budget from symbol_margins; skip if not configured.
            symbol_budget = float((worker.symbol_margins or {}).get(symbol, 0))
            if symbol_budget <= 0:
                log.warning(
                    "Worker #%d: no budget set for %s in symbol_margins — skipping",
                    worker.id, symbol,
                )
                continue
            initial_amount = calculate_base_order(
                symbol_budget, amount_multiplier, max_orders
            )
            tp_price = calculate_take_profit(current_price, take_profit_percent)

            # Place real exchange order
            result = open_long_position(
                exchange_client, symbol, initial_amount, sym_leverage, sym_market_type
            )
            if result["skipped"]:
                log.warning(
                    "Worker #%d: DCA order #1 for %s skipped (exchange error: %s)",
                    worker.id, symbol, result.get("error"),
                )
                continue

            filled_price = result["filled_price"] or current_price
            contracts = result["contracts"]

            trade = StrategyTrade(
                user_id=worker.user_id,
                worker_id=worker.id,
                strategy_id=strategy.id,
                symbol=symbol,
                exchange=worker.exchange_id,
                status=TradeStatus.OPEN,
                trade_date=date.today(),
                details={
                    "dca_order_number": 1,
                    "entry_price": str(filled_price),
                    "amount": str(initial_amount),
                    "contracts": str(contracts),
                    "avg_entry_price": str(filled_price),
                    "take_profit_price": str(tp_price),
                    "margin": str(initial_amount),
                    "leverage": sym_leverage,
                    "market_type": sym_market_type,
                    "order_id": result["order_id"],
                },
            )
            db.add(trade)
            log.info(
                "Worker #%d: DCA cycle started for %s @ %.4f "
                "(order #1, $%.2f, TP=%.4f, order_id=%s)",
                worker.id, symbol, filled_price, initial_amount, tp_price, result["order_id"],
            )
            continue

        # ── Active cycle: verify exchange position still exists ───────────
        # If DB shows open orders but exchange has no long position, the
        # position was closed externally. Mark stale DB records as STOPPED
        # and let the next tick start a fresh cycle.
        market_type_check = (
            open_orders[0].details.get("market_type", "spot")
            if open_orders[0].details else "spot"
        )
        if market_type_check != "spot":
            live_contracts = get_open_position_size(exchange_client, symbol)
            if live_contracts is None:
                log.warning(
                    "Worker #%d: DB has %d open order(s) for %s but no exchange "
                    "position found — marking as STOPPED and restarting cycle",
                    worker.id, order_count, symbol,
                )
                for t in open_orders:
                    t.status = TradeStatus.STOPPED
                db.flush()
                continue

        # ── Active cycle: recalculate avg entry and TP ─────────────────────
        entries = [
            (float(t.details["entry_price"]), float(t.details["amount"]))
            for t in open_orders
        ]
        avg_entry = calculate_avg_entry(entries)
        tp_price = calculate_take_profit(avg_entry, take_profit_percent)

        # ── Check take profit ──────────────────────────────────────────────
        if current_price >= tp_price:
            # Close full position on exchange
            total_contracts = sum(
                float(t.details.get("contracts") or t.details.get("amount") or 0)
                for t in open_orders
            )
            if total_contracts > 0:
                close_result = close_long_position(
                    exchange_client, symbol, total_contracts, sym_market_type
                )
                if close_result["error"]:
                    log.warning(
                        "Worker #%d: failed to close %s on exchange: %s",
                        worker.id, symbol, close_result["error"],
                    )

            for t in open_orders:
                t.status = TradeStatus.WIN
            log.info(
                "Worker #%d: DCA TP hit for %s @ %.4f "
                "(avg_entry=%.4f, TP=%.4f, %d orders → WIN)",
                worker.id, symbol, current_price, avg_entry, tp_price, order_count,
            )
            continue

        # ── Check safety order trigger ────────────────────────────────────
        if order_count >= max_orders:
            continue

        last_entry_price = float(open_orders[-1].details["entry_price"])
        drop_pct = (last_entry_price - current_price) / last_entry_price * 100

        if drop_pct < step_percent:
            continue

        # Open next safety order
        prev_amount = float(open_orders[-1].details["amount"])
        next_amount = calculate_next_amount(prev_amount, amount_multiplier)

        result = open_long_position(
            exchange_client, symbol, next_amount, sym_leverage, sym_market_type
        )
        if result["skipped"]:
            log.warning(
                "Worker #%d: DCA safety order #%d for %s skipped: %s",
                worker.id, order_count + 1, symbol, result.get("error"),
            )
            continue

        filled_price = result["filled_price"] or current_price
        contracts = result["contracts"]

        new_avg_entry = calculate_avg_entry(entries + [(filled_price, next_amount)])
        new_tp_price = calculate_take_profit(new_avg_entry, take_profit_percent)

        # Update TP on all existing open orders so the UI stays consistent
        for t in open_orders:
            t.details = {
                **t.details,
                "avg_entry_price": str(new_avg_entry),
                "take_profit_price": str(new_tp_price),
            }
            flag_modified(t, "details")

        trade = StrategyTrade(
            user_id=worker.user_id,
            worker_id=worker.id,
            strategy_id=strategy.id,
            symbol=symbol,
            exchange=worker.exchange_id,
            status=TradeStatus.OPEN,
            trade_date=date.today(),
            details={
                "dca_order_number": order_count + 1,
                "entry_price": str(filled_price),
                "amount": str(next_amount),
                "contracts": str(contracts),
                "avg_entry_price": str(new_avg_entry),
                "take_profit_price": str(new_tp_price),
                "margin": str(next_amount),
                "leverage": sym_leverage,
                "market_type": sym_market_type,
                "order_id": result["order_id"],
            },
        )
        db.add(trade)
        log.info(
            "Worker #%d: DCA safety order #%d for %s @ %.4f "
            "(drop=%.2f%%, $%.2f, avg=%.4f, TP=%.4f, order_id=%s)",
            worker.id, order_count + 1, symbol, filled_price,
            drop_pct, next_amount, new_avg_entry, new_tp_price, result["order_id"],
        )
