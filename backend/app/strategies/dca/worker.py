"""
DCA — strategy worker implementation (proactive limit orders).

Strategy rules
--------------
- Symbols    : admin-configured list
- Direction  : LONG only (spot / swap)
- Cycle      : one DCA cycle per symbol at a time

New cycle (proactive):
  1. Base order  — market buy immediately (fills at current price)
  2. Safety orders — ALL placed upfront as limit buys below base fill price
  3. TP order    — limit sell placed after base fills; updated each time a
                   safety order fills
  4. WIN         — when TP limit sell fills; cancel remaining PENDING safety orders
  5. Next cycle  — starts on next tick after WIN

Each tick (active cycle):
  a. If TP order filled → cancel all PENDING → mark all OPEN+PENDING as WIN
  b. If any PENDING safety order filled → recalculate avg entry → cancel old TP
     → place new TP for total_contracts at new avg price

Settings (from Strategy.settings JSON)
---------------------------------------
    amount_multiplier   — each safety order is multiplier × prev amount   (default 2.0)
    step_percent        — price level steps (each safety is step_percent% lower)  (default 0.5)
    max_orders          — max orders per cycle incl. base order            (default 5)
    take_profit_percent — TP % above weighted avg entry                    (default 1.0)
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.exchange.order_executor import (
    build_authenticated_exchange,
    cancel_limit_order,
    fetch_order_status,
    get_open_position_size,
    open_long_position,
    place_limit_buy,
    place_limit_sell_close,
)
from app.models.trade import StrategyTrade, TradeStatus
from app.models.worker import StrategyWorker
from app.strategies.dca.strategy import (
    calculate_avg_entry,
    calculate_base_order,
    calculate_next_amount,
    calculate_safety_prices,
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

    New cycle (no OPEN/PENDING trades for symbol):
        1. Market buy base order
        2. Place N-1 safety limit buy orders below fill price
        3. Place TP limit sell for base contracts

    Active cycle (OPEN or PENDING trades exist):
        a. Check if TP order filled → WIN → cancel remaining safety orders
        b. Check each PENDING safety order for fills → update TP when filled

    Exchange integration
    --------------------
    worker.user_exchange_id must be set. If it is None, trades are skipped.
    Real market/limit orders are placed via CCXT.
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

        # Load all active trades (OPEN = filled base/safety; PENDING = unfilled limit safety)
        active_trades = (
            db.query(StrategyTrade)
            .filter(
                StrategyTrade.worker_id == worker.id,
                StrategyTrade.symbol == symbol,
                StrategyTrade.status.in_([TradeStatus.OPEN, TradeStatus.PENDING]),
            )
            .order_by(StrategyTrade.created_at.asc())
            .all()
        )

        open_trades = [t for t in active_trades if t.status == TradeStatus.OPEN]
        pending_trades = [t for t in active_trades if t.status == TradeStatus.PENDING]

        if not active_trades:
            # ── Start new DCA cycle ────────────────────────────────────────
            _start_new_cycle(
                worker, exchange_client, db,
                symbol, sym_market_type, sym_leverage,
                amount_multiplier, step_percent, max_orders, take_profit_percent,
            )
            continue

        # ── Active cycle: verify exchange position still exists (swap only) ─
        if open_trades and sym_market_type != "spot":
            live_contracts = get_open_position_size(exchange_client, symbol)
            if live_contracts is None:
                log.warning(
                    "Worker #%d: %d open/pending trade(s) for %s but no exchange "
                    "position found — marking as STOPPED, restarting next tick",
                    worker.id, len(active_trades), symbol,
                )
                for t in active_trades:
                    t.status = TradeStatus.STOPPED
                db.flush()
                continue

        # Lead trade is the oldest OPEN record (holds tp_order_id)
        lead_trade = open_trades[0] if open_trades else None
        if lead_trade is None:
            log.warning(
                "Worker #%d: %s has PENDING safety orders but no OPEN lead trade — skipping",
                worker.id, symbol,
            )
            continue

        # ── Step 1: Check TP order fill ──────────────────────────────────────
        tp_order_id: Optional[str] = lead_trade.details.get("tp_order_id")
        if tp_order_id:
            tp_status = fetch_order_status(exchange_client, symbol, tp_order_id)
            if tp_status == "filled":
                # TP hit — cancel remaining safety orders, mark everything WIN
                for t in pending_trades:
                    oid = t.details.get("order_id")
                    if oid:
                        cancel_limit_order(exchange_client, symbol, oid)
                    t.status = TradeStatus.WIN
                for t in open_trades:
                    t.status = TradeStatus.WIN
                log.info(
                    "Worker #%d: DCA TP filled for %s — "
                    "%d OPEN + %d PENDING → WIN (tp_order_id=%s)",
                    worker.id, symbol, len(open_trades), len(pending_trades), tp_order_id,
                )
                continue

        # ── Step 2: Check PENDING safety order fills ──────────────────────────
        newly_filled: List[StrategyTrade] = []
        for t in pending_trades:
            oid = t.details.get("order_id")
            if not oid:
                continue

            order_status = fetch_order_status(exchange_client, symbol, oid)
            if order_status == "filled":
                filled_price, actual_contracts = _fetch_fill_details(
                    exchange_client, symbol, oid,
                    fallback_price=float(t.details.get("entry_price") or 0),
                    fallback_contracts=float(t.details.get("contracts") or 0),
                )
                t.status = TradeStatus.OPEN
                t.details = {
                    **t.details,
                    "filled_price": str(filled_price),
                    "contracts": str(actual_contracts),
                }
                flag_modified(t, "details")
                newly_filled.append(t)
                log.info(
                    "Worker #%d: safety order #%d filled for %s @ %.6f (contracts=%.6f)",
                    worker.id, t.details.get("dca_order_number"), symbol,
                    filled_price, actual_contracts,
                )
            elif order_status == "cancelled":
                log.warning(
                    "Worker #%d: safety order #%d for %s cancelled externally — marking CLOSED",
                    worker.id, t.details.get("dca_order_number"), symbol,
                )
                t.status = TradeStatus.CLOSED

        if not newly_filled:
            continue

        # ── Step 3: Update TP with new total after safety fills ──────────────
        all_open_now = [t for t in active_trades if t.status == TradeStatus.OPEN]

        entries = [
            (
                float(t.details.get("filled_price") or t.details.get("entry_price") or 0),
                float(t.details.get("contracts") or 0),
            )
            for t in all_open_now
        ]
        avg_entry = calculate_avg_entry(entries)
        new_tp_price = calculate_take_profit(avg_entry, take_profit_percent)
        total_contracts = sum(float(t.details.get("contracts") or 0) for t in all_open_now)

        # Cancel old TP
        if tp_order_id:
            cancel_limit_order(exchange_client, symbol, tp_order_id)

        # Place updated TP
        tp_result = place_limit_sell_close(
            exchange_client, symbol, total_contracts, new_tp_price, sym_market_type
        )
        new_tp_order_id: Optional[str] = None
        if tp_result["error"]:
            log.warning(
                "Worker #%d: failed to update TP for %s: %s",
                worker.id, symbol, tp_result["error"],
            )
        else:
            new_tp_order_id = tp_result["order_id"]

        # Update lead trade with new TP details
        lead_trade.details = {
            **lead_trade.details,
            "tp_order_id": new_tp_order_id,
            "tp_price": str(new_tp_price),
            "tp_contracts": str(total_contracts),
            "avg_entry_price": str(avg_entry),
            "take_profit_price": str(new_tp_price),
        }
        flag_modified(lead_trade, "details")

        # Keep avg/tp in sync on non-lead OPEN trades for UI display
        for t in all_open_now:
            if t.id != lead_trade.id:
                t.details = {
                    **t.details,
                    "avg_entry_price": str(avg_entry),
                    "take_profit_price": str(new_tp_price),
                }
                flag_modified(t, "details")

        log.info(
            "Worker #%d: %s TP updated after %d safety fill(s) — "
            "avg=%.6f tp=%.6f contracts=%.6f (tp_order_id=%s)",
            worker.id, symbol, len(newly_filled),
            avg_entry, new_tp_price, total_contracts, new_tp_order_id,
        )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _start_new_cycle(
    worker: StrategyWorker,
    exchange_client,
    db: Session,
    symbol: str,
    market_type: str,
    leverage: int,
    amount_multiplier: float,
    step_percent: float,
    max_orders: int,
    take_profit_percent: float,
) -> None:
    """Start a fresh DCA cycle: market base + N-1 safety limit orders + TP."""
    symbol_budget = float((worker.symbol_margins or {}).get(symbol, 0))
    if symbol_budget <= 0:
        log.warning(
            "Worker #%d: no budget set for %s in symbol_margins — skipping",
            worker.id, symbol,
        )
        return

    strategy = worker.strategy

    # ── 1. Market buy base order ──────────────────────────────────────────
    initial_amount = calculate_base_order(symbol_budget, amount_multiplier, max_orders)
    result = open_long_position(exchange_client, symbol, initial_amount, leverage, market_type)
    if result["skipped"]:
        log.warning(
            "Worker #%d: DCA base order for %s skipped (error: %s)",
            worker.id, symbol, result.get("error"),
        )
        return

    base_fill_price = float(result["filled_price"] or 0)
    base_contracts = float(result["contracts"] or 0)

    if base_fill_price <= 0 or base_contracts <= 0:
        log.warning(
            "Worker #%d: DCA base order for %s returned invalid fill — price=%.6f contracts=%.6f",
            worker.id, symbol, base_fill_price, base_contracts,
        )
        return

    log.info(
        "Worker #%d: DCA base order for %s filled @ %.6f (contracts=%.6f order_id=%s)",
        worker.id, symbol, base_fill_price, base_contracts, result["order_id"],
    )

    # ── 2. Place safety limit buy orders ──────────────────────────────────
    safety_prices = calculate_safety_prices(base_fill_price, step_percent, max_orders)
    prev_amount = initial_amount
    placed_safety_count = 0

    for i, safety_price in enumerate(safety_prices):
        safety_amount = calculate_next_amount(prev_amount, amount_multiplier)
        safety_result = place_limit_buy(
            exchange_client, symbol, safety_amount, leverage, market_type, safety_price
        )
        prev_amount = safety_amount  # advance regardless to keep correct progression

        if safety_result["error"] or safety_result["skipped"]:
            log.warning(
                "Worker #%d: failed to place safety limit order #%d for %s @ %.6f: %s",
                worker.id, i + 2, symbol, safety_price, safety_result.get("error"),
            )
            continue

        safety_trade = StrategyTrade(
            user_id=worker.user_id,
            worker_id=worker.id,
            strategy_id=strategy.id,
            symbol=symbol,
            exchange=worker.exchange_id,
            status=TradeStatus.PENDING,
            trade_date=date.today(),
            details={
                "dca_order_number": i + 2,
                "entry_price": str(safety_price),
                "amount": str(safety_amount),
                "contracts": str(safety_result["contracts"]),
                "order_id": safety_result["order_id"],
                "market_type": market_type,
                "leverage": leverage,
            },
        )
        db.add(safety_trade)
        placed_safety_count += 1
        log.info(
            "Worker #%d: safety limit order #%d for %s @ %.6f placed (order_id=%s)",
            worker.id, i + 2, symbol, safety_price, safety_result["order_id"],
        )

    # ── 3. Place TP limit sell for base order contracts ───────────────────
    tp_price = calculate_take_profit(base_fill_price, take_profit_percent)
    tp_result = place_limit_sell_close(
        exchange_client, symbol, base_contracts, tp_price, market_type
    )
    tp_order_id: Optional[str] = None
    if tp_result["error"]:
        log.warning(
            "Worker #%d: failed to place initial TP for %s: %s",
            worker.id, symbol, tp_result["error"],
        )
    else:
        tp_order_id = tp_result["order_id"]

    # ── 4. Create lead trade DB record ────────────────────────────────────
    lead_trade = StrategyTrade(
        user_id=worker.user_id,
        worker_id=worker.id,
        strategy_id=strategy.id,
        symbol=symbol,
        exchange=worker.exchange_id,
        status=TradeStatus.OPEN,
        trade_date=date.today(),
        details={
            "dca_order_number": 1,
            "entry_price": str(base_fill_price),
            "filled_price": str(base_fill_price),
            "amount": str(initial_amount),
            "contracts": str(base_contracts),
            "order_id": result["order_id"],
            "tp_order_id": tp_order_id,
            "tp_price": str(tp_price),
            "tp_contracts": str(base_contracts),
            "avg_entry_price": str(base_fill_price),
            "take_profit_price": str(tp_price),
            "market_type": market_type,
            "leverage": leverage,
        },
    )
    db.add(lead_trade)

    log.info(
        "Worker #%d: DCA cycle started for %s @ %.6f "
        "($%.2f base, %d/%d safety orders placed, TP=%.6f tp_order_id=%s)",
        worker.id, symbol, base_fill_price, initial_amount,
        placed_safety_count, max_orders - 1, tp_price, tp_order_id,
    )


def _fetch_fill_details(
    exchange_client,
    symbol: str,
    order_id: str,
    fallback_price: float,
    fallback_contracts: float,
) -> tuple[float, float]:
    """Return (filled_price, contracts) from exchange, falling back to DB values."""
    try:
        order_info = exchange_client.fetch_order(order_id, symbol)
        filled_price = float(
            order_info.get("average") or order_info.get("price") or fallback_price
        )
        actual_contracts = float(
            order_info.get("filled") or order_info.get("amount") or fallback_contracts
        )
        return filled_price, actual_contracts
    except Exception as exc:
        log.warning(
            "Could not fetch fill details for order %s [%s]: %s",
            order_id, symbol, exc,
        )
        return fallback_price, fallback_contracts
