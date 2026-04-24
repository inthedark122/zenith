"""
DCA — backtest implementation.

Simulates DCA cycles on 1-minute OHLCV data.

One "trade record" is emitted per completed DCA cycle:
  - entry_price  = weighted-average entry across all orders in the cycle
  - exit_price   = TP price (or last candle close for force-closed cycles)
  - PnL          = (exit - avg_entry) / avg_entry × leverage × total_invested
  - stop_loss_price = 0.0 (DCA has no stop-loss)

Settings consumed (from Strategy.settings):
  amount_multiplier   — safety order size = prev × multiplier        (default 2.0)
  step_percent        — % drop from last entry to trigger safety order (default 0.5)
  max_orders          — max orders per cycle incl. initial            (default 5)
  take_profit_percent — TP % above weighted avg entry                 (default 1.0)

Leverage and market_type are taken per-symbol from strategy.symbols[i].
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Dict, List, Optional

from app.models.strategy import Strategy
from app.services.exchange_factory import create_exchange
from app.strategies.dca.strategy import (
    calculate_avg_entry,
    calculate_next_amount,
    calculate_take_profit,
)

_ASSUMPTION_NOTES = [
    "Simulation uses 1-minute candles for fine-grained entry/exit timing.",
    "A new DCA cycle opens at the first candle's open price when no cycle is active.",
    "Safety orders fire when price drops ≥ step_percent% from the last entry.",
    "Each safety order size = previous order × amount_multiplier.",
    "Maximum max_orders orders per cycle (initial + safety).",
    "Take-profit = weighted avg entry × (1 + take_profit_percent / 100).",
    "No stop-loss: cycles run until TP or end of the lookback window.",
    "Cycles still open at end of the period are force-closed at the last candle close.",
    "One trade record per completed cycle; entry_price = weighted average entry.",
    "PnL = (exit − avg_entry) / avg_entry × leverage × total_invested.",
]


@dataclass
class _Order:
    entry_price: float
    amount: float       # USDT invested in this order


@dataclass
class _OpenCycle:
    symbol: str
    opened_at: datetime
    orders: List[_Order] = field(default_factory=list)

    @property
    def order_count(self) -> int:
        return len(self.orders)

    @property
    def total_invested(self) -> float:
        return sum(o.amount for o in self.orders)

    @property
    def avg_entry(self) -> float:
        return calculate_avg_entry([(o.entry_price, o.amount) for o in self.orders])

    @property
    def last_entry_price(self) -> float:
        return self.orders[-1].entry_price if self.orders else 0.0


def _round(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    return round(float(value), 2)


def _build_symbol_summary(symbol: str, orders: List[Dict[str, Any]]) -> Dict[str, Any]:
    wins = sum(1 for o in orders if o["pnl_usd"] > 0)
    losses = len(orders) - wins
    net_profit = sum(o["pnl_usd"] for o in orders)
    return {
        "symbol": symbol,
        "total_trades": len(orders),
        "wins": wins,
        "losses": losses,
        "win_rate": round((wins / len(orders)) * 100, 2) if orders else 0.0,
        "net_profit_usd": _round(net_profit) or 0.0,
    }


def _fetch_1m_paginated(exchange, symbol: str, since_ms: int, until_ms: int) -> List:
    """Fetch all 1m candles in [since_ms, until_ms) via paginated requests."""
    all_candles: List = []
    current = since_ms
    while current < until_ms:
        batch = exchange.fetch_ohlcv(symbol, "1m", since=current, limit=1000)
        if not batch:
            break
        in_range = [c for c in batch if since_ms <= c[0] < until_ms]
        all_candles.extend(in_range)
        if batch[-1][0] >= until_ms - 1 or len(batch) < 100:
            break
        current = batch[-1][0] + 1
    return all_candles


def run_dca_backtest(
    strategy: Strategy,
    *,
    lookback_days: int,
    margin_per_trade: float,
) -> Dict[str, Any]:
    """Simulate DCA strategy on historical 1m data and return backtest result dict."""
    from app.services.backtesting import _summarize_orders  # avoid circular

    exchange = create_exchange("okx")

    settings = strategy.settings or {}
    amount_multiplier: float = float(settings.get("amount_multiplier", 2.0))
    step_percent: float = float(settings.get("step_percent", 0.5))
    max_orders: int = int(settings.get("max_orders", 5))
    take_profit_percent: float = float(settings.get("take_profit_percent", 1.0))

    all_orders: List[Dict[str, Any]] = []
    symbol_results: List[Dict[str, Any]] = []
    overall_period_start: Optional[datetime] = None
    overall_period_end: Optional[datetime] = None

    for sym_cfg in strategy.symbols or []:
        symbol: str = sym_cfg["symbol"] if isinstance(sym_cfg, dict) else sym_cfg
        leverage: float = float(sym_cfg.get("leverage", 1)) if isinstance(sym_cfg, dict) else 1.0

        # Fetch 1m candles for the lookback period
        until_ms = int(datetime.now(tz=UTC).timestamp() * 1000)
        since_ms = until_ms - lookback_days * 86_400_000

        candles = _fetch_1m_paginated(exchange, symbol, since_ms, until_ms)
        if not candles:
            symbol_results.append(_build_symbol_summary(symbol, []))
            continue

        period_start = datetime.fromtimestamp(candles[0][0] / 1000, tz=UTC)
        period_end = datetime.fromtimestamp(candles[-1][0] / 1000, tz=UTC)
        if overall_period_start is None or period_start < overall_period_start:
            overall_period_start = period_start
        if overall_period_end is None or period_end > overall_period_end:
            overall_period_end = period_end

        symbol_orders: List[Dict[str, Any]] = []
        cycle: Optional[_OpenCycle] = None

        for candle in candles:
            ts, open_c, high_c, low_c, close_c, _vol = candle
            candle_dt = datetime.fromtimestamp(ts / 1000, tz=UTC)
            open_p = float(open_c)
            high_p = float(high_c)
            low_p = float(low_c)
            close_p = float(close_c)

            # Start a new cycle if none is active
            if cycle is None:
                cycle = _OpenCycle(symbol=symbol, opened_at=candle_dt)
                cycle.orders.append(_Order(entry_price=open_p, amount=margin_per_trade))

            avg = cycle.avg_entry
            tp_price = calculate_take_profit(avg, take_profit_percent)

            # Check TP using intra-candle high
            if high_p >= tp_price:
                total_invested = cycle.total_invested
                pnl_usd = (tp_price - avg) / avg * leverage * total_invested
                bars_held = max(int((candle_dt - cycle.opened_at).total_seconds() / 60), 1)
                symbol_orders.append({
                    "symbol": symbol,
                    "side": "long",
                    "status": "win",
                    "opened_at": cycle.opened_at.isoformat(),
                    "closed_at": candle_dt.isoformat(),
                    "entry_price": round(avg, 8),
                    "exit_price": round(tp_price, 8),
                    "take_profit_price": round(tp_price, 8),
                    "stop_loss_price": 0.0,
                    "margin_per_trade": round(total_invested, 2),
                    "leverage": round(leverage, 1),
                    "pnl_usd": _round(pnl_usd),
                    "pnl_pct": _round(pnl_usd / total_invested * 100) if total_invested else 0.0,
                    "close_reason": "take_profit",
                    "bars_held": bars_held,
                })
                cycle = None
                continue

            # Check if a safety order should fire (use candle low for worst-case trigger)
            if cycle.order_count < max_orders:
                drop_pct = (cycle.last_entry_price - low_p) / cycle.last_entry_price * 100
                if drop_pct >= step_percent:
                    # Fire safety order at the trigger price (last_entry × (1 - step_percent/100))
                    trigger_price = cycle.last_entry_price * (1 - step_percent / 100)
                    next_amount = calculate_next_amount(cycle.orders[-1].amount, amount_multiplier)
                    cycle.orders.append(_Order(entry_price=trigger_price, amount=next_amount))

        # Force-close any open cycle at end of period
        if cycle is not None and candles:
            last_c = candles[-1]
            last_dt = datetime.fromtimestamp(last_c[0] / 1000, tz=UTC)
            last_close = float(last_c[4])
            avg = cycle.avg_entry
            total_invested = cycle.total_invested
            pnl_usd = (last_close - avg) / avg * leverage * total_invested
            bars_held = max(int((last_dt - cycle.opened_at).total_seconds() / 60), 1)
            status = "win" if pnl_usd > 0 else "loss"
            tp_price = calculate_take_profit(avg, take_profit_percent)
            symbol_orders.append({
                "symbol": symbol,
                "side": "long",
                "status": status,
                "opened_at": cycle.opened_at.isoformat(),
                "closed_at": last_dt.isoformat(),
                "entry_price": round(avg, 8),
                "exit_price": round(last_close, 8),
                "take_profit_price": round(tp_price, 8),
                "stop_loss_price": 0.0,
                "margin_per_trade": round(total_invested, 2),
                "leverage": round(leverage, 1),
                "pnl_usd": _round(pnl_usd),
                "pnl_pct": _round(pnl_usd / total_invested * 100) if total_invested else 0.0,
                "close_reason": "final_close",
                "bars_held": bars_held,
            })

        all_orders.extend(symbol_orders)
        symbol_results.append(_build_symbol_summary(symbol, symbol_orders))

    all_orders.sort(key=lambda o: (o["closed_at"], o["symbol"]))
    return _summarize_orders(
        strategy=strategy,
        lookback_days=lookback_days,
        margin_per_trade=margin_per_trade,
        period_start=overall_period_start,
        period_end=overall_period_end,
        assumption_notes=_ASSUMPTION_NOTES,
        symbol_results=symbol_results,
        orders=all_orders,
        timeframe="1m",
    )
