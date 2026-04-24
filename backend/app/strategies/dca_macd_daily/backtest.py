"""
DCA_MACD_DAILY — backtest implementation.

Mirrors the worker logic but runs on historical OHLCV data fetched from OKX.
Timeframe: D1 for MACD signal detection; 15m for intra-day TP/SL checking.
Leverage and market_type are taken per-symbol from strategy.symbols[i].leverage/market_type.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any, Dict, List, Optional

from app.models.strategy import Strategy
from app.services.exchange_factory import create_exchange
from app.strategies.dca_macd_daily.strategy import (
    calculate_stop_loss,
    calculate_take_profit,
    get_macd_signal,
)

_ASSUMPTION_NOTES_SPOT = [
    "D1 MACD crossover identifies the trade direction for the following day (SPOT, LONG only).",
    "Entry at the open of the first 15-minute candle on the execution day.",
    "SL = 5% below entry; TP = 10% above entry (1:2 RR on price movement).",
    "TP/SL are checked against each 15m candle high/low for precise timing.",
    "Maximum 2 trades per symbol per calendar day.",
    "If the first trade hits SL, a correction entry fires at the next 15m candle open.",
    "If SL and TP are both touched within the same 15m candle, SL wins (conservative).",
    "Open trades still active at the end of the lookback window are closed at the last close.",
]

_ASSUMPTION_NOTES_FUTURES = [
    "D1 MACD crossover identifies the trade direction for the following day (FUTURES).",
    "Bullish crossover → LONG; bearish crossover → SHORT.",
    "Entry at the open of the first 15-minute candle on the execution day.",
    "SL = 100% of margin (1/leverage price move); TP = RR_ratio × 100% of margin.",
    "PnL = price_change% × leverage × margin (directional per side).",
    "TP/SL are checked against each 15m candle high/low for precise timing.",
    "Maximum 2 trades per symbol per calendar day.",
    "If the first trade hits SL, a correction entry fires at the next 15m candle open.",
    "If SL and TP are both touched within the same 15m candle, SL wins (conservative).",
    "Open trades still active at the end of the lookback window are closed at the last close.",
]


@dataclass
class _OpenTrade:
    symbol: str
    side: str           # "long" or "short"
    opened_at: datetime
    entry_price: float
    take_profit_price: float
    stop_loss_price: float


def _round(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    return round(float(value), 2)


def _finalize_trade(
    *,
    open_trade: _OpenTrade,
    closed_at: datetime,
    close_price: float,
    close_reason: str,
    margin_per_trade: float,
    leverage: float,
    bars_held: int,
) -> Dict[str, Any]:
    if open_trade.side == "long":
        pnl_usd = (close_price - open_trade.entry_price) / open_trade.entry_price * leverage * margin_per_trade
    else:
        pnl_usd = (open_trade.entry_price - close_price) / open_trade.entry_price * leverage * margin_per_trade

    status = "win" if pnl_usd > 0 else "loss"
    return {
        "symbol": open_trade.symbol,
        "side": open_trade.side,
        "status": status,
        "opened_at": open_trade.opened_at.isoformat(),
        "closed_at": closed_at.isoformat(),
        "entry_price": round(open_trade.entry_price, 8),
        "exit_price": round(close_price, 8),
        "take_profit_price": round(open_trade.take_profit_price, 8),
        "stop_loss_price": round(open_trade.stop_loss_price, 8),
        "margin_per_trade": round(margin_per_trade, 2),
        "leverage": round(leverage, 1),
        "pnl_usd": _round(pnl_usd),
        "pnl_pct": _round(pnl_usd / margin_per_trade * 100),
        "close_reason": close_reason,
        "bars_held": bars_held,
    }


def _fetch_15m_paginated(exchange, symbol: str, since_ms: int, until_ms: int) -> List:
    """Fetch all 15m candles in [since_ms, until_ms) using paginated requests."""
    all_candles: List = []
    current = since_ms
    while current < until_ms:
        batch = exchange.fetch_ohlcv(symbol, "15m", since=current, limit=1000)
        if not batch:
            break
        in_range = [c for c in batch if since_ms <= c[0] < until_ms]
        all_candles.extend(in_range)
        if batch[-1][0] >= until_ms - 1 or len(batch) < 100:
            break
        current = batch[-1][0] + 1
    return all_candles


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


def run_dca_macd_daily_backtest(
    strategy: Strategy,
    *,
    lookback_days: int,
    margin_per_trade: float,
) -> Dict[str, Any]:
    """Simulate DCA_MACD_DAILY strategy on historical data and return backtest result dict."""
    from app.services.backtesting import _summarize_orders  # local import to avoid circular

    exchange = create_exchange("okx")
    d1_limit = min(max(lookback_days + 60, 120), 1000)
    rr_ratio = float(strategy.rr_ratio)

    # Determine assumption notes from symbols (spot if all leverage=1, else futures)
    has_futures = any(
        (s.get("leverage", 1) if isinstance(s, dict) else 1) > 1
        for s in (strategy.symbols or [])
    )
    assumption_notes = _ASSUMPTION_NOTES_FUTURES if has_futures else _ASSUMPTION_NOTES_SPOT

    all_orders: List[Dict[str, Any]] = []
    symbol_results: List[Dict[str, Any]] = []
    overall_period_start: Optional[datetime] = None
    overall_period_end: Optional[datetime] = None

    for sym_cfg in strategy.symbols or []:
        symbol: str = sym_cfg["symbol"] if isinstance(sym_cfg, dict) else sym_cfg
        leverage: float = float(sym_cfg.get("leverage", 1)) if isinstance(sym_cfg, dict) else 1.0
        is_futures: bool = leverage > 1.0

        d1_candles = exchange.fetch_ohlcv(symbol, timeframe="1d", limit=d1_limit)
        if len(d1_candles) < 35:
            symbol_results.append(_build_symbol_summary(symbol, []))
            continue

        symbol_period_start = datetime.fromtimestamp(d1_candles[0][0] / 1000, tz=UTC)
        symbol_period_end = datetime.fromtimestamp(d1_candles[-1][0] / 1000, tz=UTC)
        if overall_period_start is None or symbol_period_start < overall_period_start:
            overall_period_start = symbol_period_start
        if overall_period_end is None or symbol_period_end > overall_period_end:
            overall_period_end = symbol_period_end

        d1_close_by_date: Dict[date, float] = {
            datetime.fromtimestamp(c[0] / 1000, tz=UTC).date(): float(c[4])
            for c in d1_candles
        }
        d1_close_dates = sorted(d1_close_by_date.keys())

        since_ms = d1_candles[0][0]
        until_ms = d1_candles[-1][0] + 86_400_000
        m15_candles = _fetch_15m_paginated(exchange, symbol, since_ms, until_ms)

        m15_by_date: Dict[date, List] = defaultdict(list)
        for c in m15_candles:
            m15_by_date[datetime.fromtimestamp(c[0] / 1000, tz=UTC).date()].append(c)

        symbol_orders: List[Dict[str, Any]] = []
        daily_trade_count: Dict[date, int] = defaultdict(int)
        open_trade: Optional[_OpenTrade] = None
        pending_entry: Optional[str] = None

        d1_closes: List[float] = []
        d1_close_ptr = 0

        for sim_date in sorted(m15_by_date.keys()):
            while (
                d1_close_ptr < len(d1_close_dates)
                and d1_close_dates[d1_close_ptr] < sim_date
            ):
                d1_closes.append(d1_close_by_date[d1_close_dates[d1_close_ptr]])
                d1_close_ptr += 1

            if open_trade is None and pending_entry is None and len(d1_closes) >= 34:
                signal = get_macd_signal(d1_closes)
                if signal is not None:
                    if signal.is_bullish_crossover and daily_trade_count[sim_date] < 2:
                        pending_entry = "long"
                    elif signal.is_bearish_crossover and is_futures and daily_trade_count[sim_date] < 2:
                        pending_entry = "short"

            for m15_candle in sorted(m15_by_date[sim_date], key=lambda c: c[0]):
                ts, open_c, high_c, low_c, _close_c, _vol = m15_candle
                candle_dt = datetime.fromtimestamp(ts / 1000, tz=UTC)
                open_p = float(open_c)
                high_p = float(high_c)
                low_p = float(low_c)

                if pending_entry is not None and open_trade is None:
                    if daily_trade_count[sim_date] < 2:
                        side = pending_entry
                        open_trade = _OpenTrade(
                            symbol=symbol,
                            side=side,
                            opened_at=candle_dt,
                            entry_price=open_p,
                            take_profit_price=calculate_take_profit(
                                open_p, margin_per_trade, leverage, rr_ratio, side
                            ),
                            stop_loss_price=calculate_stop_loss(
                                open_p, margin_per_trade, leverage, side
                            ),
                        )
                        daily_trade_count[sim_date] += 1
                    pending_entry = None

                if open_trade is not None:
                    if open_trade.side == "long":
                        hit_sl = low_p <= open_trade.stop_loss_price
                        hit_tp = high_p >= open_trade.take_profit_price
                    else:
                        hit_sl = high_p >= open_trade.stop_loss_price
                        hit_tp = low_p <= open_trade.take_profit_price

                    if hit_sl and hit_tp:
                        hit_tp = False  # conservative: SL wins

                    if hit_sl or hit_tp:
                        close_p = open_trade.stop_loss_price if hit_sl else open_trade.take_profit_price
                        reason = "stop_loss" if hit_sl else "take_profit"
                        bars_held = max(
                            int((candle_dt - open_trade.opened_at).total_seconds() / 900), 1
                        )
                        completed_side = open_trade.side
                        symbol_orders.append(
                            _finalize_trade(
                                open_trade=open_trade,
                                closed_at=candle_dt,
                                close_price=close_p,
                                close_reason=reason,
                                margin_per_trade=margin_per_trade,
                                leverage=leverage,
                                bars_held=bars_held,
                            )
                        )
                        open_trade = None
                        if reason == "stop_loss" and daily_trade_count[sim_date] < 2:
                            pending_entry = completed_side

            if pending_entry is not None and open_trade is None:
                pending_entry = None

        if open_trade is not None and m15_candles:
            last_c = m15_candles[-1]
            last_dt = datetime.fromtimestamp(last_c[0] / 1000, tz=UTC)
            bars_held = max(
                int((last_dt - open_trade.opened_at).total_seconds() / 900), 1
            )
            symbol_orders.append(
                _finalize_trade(
                    open_trade=open_trade,
                    closed_at=last_dt,
                    close_price=float(last_c[4]),
                    close_reason="final_close",
                    margin_per_trade=margin_per_trade,
                    leverage=leverage,
                    bars_held=bars_held,
                )
            )

        all_orders.extend(symbol_orders)
        symbol_results.append(_build_symbol_summary(symbol, symbol_orders))

    all_orders.sort(key=lambda o: (o["closed_at"], o["symbol"]))
    return _summarize_orders(
        strategy=strategy,
        lookback_days=lookback_days,
        margin_per_trade=margin_per_trade,
        period_start=overall_period_start,
        period_end=overall_period_end,
        assumption_notes=assumption_notes,
        symbol_results=symbol_results,
        orders=all_orders,
        timeframe="1d/15m",
    )
