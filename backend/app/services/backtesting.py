from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any, Dict, List, Optional

import ccxt

from app.models.strategy import STRATEGY_DCA_MACD_DAILY, Strategy
from app.services.exchange_factory import create_exchange
from app.strategies.dca_macd_daily.strategy import (
    calculate_stop_loss,
    calculate_take_profit,
    get_macd_signal,
)

_ASSUMPTION_NOTES_SPOT = [
    "Uses OKX daily OHLCV candles — SPOT market (leverage = 1×).",
    "Bullish D1 MACD crossover → LONG only (spot cannot short-sell).",
    "Entry at the open of the candle following the crossover signal.",
    "SL = 5% below entry; TP = 10% above entry (1:2 RR on price movement).",
    "Maximum 2 trades per symbol per calendar day.",
    "If SL and TP are both touched within the same candle, SL wins (conservative).",
    "Open trades still active at the end of the lookback window are closed at the last close.",
]

_ASSUMPTION_NOTES_FUTURES = [
    "Uses OKX daily OHLCV candles — FUTURES market (leverage > 1×).",
    "Bullish D1 MACD crossover → LONG; bearish crossover → SHORT.",
    "Entry at the open of the candle following the crossover signal.",
    "SL = 100% of margin; TP = 200% of margin (1:2 RR).",
    "PnL = price_change% × leverage × margin (directional per side).",
    "Maximum 2 trades per symbol per calendar day.",
    "If SL and TP are both touched within the same candle, SL wins (conservative).",
    "Open trades still active at the end of the lookback window are closed at the last close.",
]


@dataclass
class _OpenTrade:
    symbol: str
    side: str           # "long" or "short"
    opened_at: datetime
    opened_index: int
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
    # Works for both spot (leverage=1) and futures (leverage>1).
    # LONG PnL  = (close − entry) / entry × leverage × margin
    # SHORT PnL = (entry − close) / entry × leverage × margin
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


def _summarize_orders(
    *,
    strategy: Strategy,
    lookback_days: int,
    margin_per_trade: float,
    period_start: Optional[datetime],
    period_end: Optional[datetime],
    assumption_notes: List[str],
    symbol_results: List[Dict[str, Any]],
    orders: List[Dict[str, Any]],
) -> Dict[str, Any]:
    wins = [o["pnl_usd"] for o in orders if o["pnl_usd"] > 0]
    losses = [o["pnl_usd"] for o in orders if o["pnl_usd"] <= 0]
    net_profit = sum(o["pnl_usd"] for o in orders)
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    equity = 0.0
    peak = 0.0
    max_drawdown = 0.0
    max_drawdown_pct = 0.0
    for o in orders:
        equity += o["pnl_usd"]
        if equity > peak:
            peak = equity
        drawdown = peak - equity
        if drawdown > max_drawdown:
            max_drawdown = drawdown
            max_drawdown_pct = (drawdown / peak) * 100 if peak > 0 else 0.0

    return {
        "timeframe": "1d",
        "lookback_days": lookback_days,
        "margin_per_trade": round(margin_per_trade, 2),
        "generated_at": datetime.now(tz=UTC).replace(tzinfo=None),
        "period_start": period_start.date() if period_start else None,
        "period_end": period_end.date() if period_end else None,
        "assumption_notes": assumption_notes,
        "total_trades": len(orders),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round((len(wins) / len(orders)) * 100, 2) if orders else 0.0,
        "gross_profit_usd": _round(gross_profit) or 0.0,
        "gross_loss_usd": _round(gross_loss) or 0.0,
        "net_profit_usd": _round(net_profit) or 0.0,
        "avg_win_usd": _round(gross_profit / len(wins)) if wins else 0.0,
        "avg_loss_usd": _round(abs(sum(losses)) / len(losses)) if losses else 0.0,
        "profit_factor": _round(gross_profit / gross_loss) if gross_loss else None,
        "max_drawdown_usd": _round(max_drawdown) or 0.0,
        "max_drawdown_pct": _round(max_drawdown_pct) or 0.0,
        "best_trade_usd": _round(max((o["pnl_usd"] for o in orders), default=None)),
        "worst_trade_usd": _round(min((o["pnl_usd"] for o in orders), default=None)),
        "symbol_results": symbol_results,
        "orders": orders,
    }


def run_strategy_backtest(
    strategy: Strategy,
    *,
    lookback_days: int,
    margin_per_trade: float,
) -> Dict[str, Any]:
    if strategy.strategy != STRATEGY_DCA_MACD_DAILY:
        raise ValueError(f"Backtesting is not implemented for strategy '{strategy.strategy}'")

    exchange = create_exchange("okx")
    limit = min(max(lookback_days + 60, 120), 1000)
    leverage = float(strategy.leverage)
    rr_ratio = float(strategy.rr_ratio)
    # leverage=1 → spot (LONG only); leverage>1 → futures (LONG + SHORT)
    is_futures = leverage > 1.0
    assumption_notes = _ASSUMPTION_NOTES_FUTURES if is_futures else _ASSUMPTION_NOTES_SPOT
    all_orders: List[Dict[str, Any]] = []
    symbol_results: List[Dict[str, Any]] = []
    overall_period_start: Optional[datetime] = None
    overall_period_end: Optional[datetime] = None

    for symbol in strategy.symbols or []:
        candles = exchange.fetch_ohlcv(symbol, timeframe="1d", limit=limit)
        if len(candles) < 35:
            symbol_results.append(_build_symbol_summary(symbol, []))
            continue

        symbol_orders: List[Dict[str, Any]] = []
        closes: List[float] = []
        open_trade: Optional[_OpenTrade] = None
        pending_entry: Optional[str] = None
        daily_trade_count: Dict[date, int] = {}

        symbol_period_start = datetime.fromtimestamp(candles[0][0] / 1000, tz=UTC)
        symbol_period_end = datetime.fromtimestamp(candles[-1][0] / 1000, tz=UTC)
        if overall_period_start is None or symbol_period_start < overall_period_start:
            overall_period_start = symbol_period_start
        if overall_period_end is None or symbol_period_end > overall_period_end:
            overall_period_end = symbol_period_end

        for index, candle in enumerate(candles):
            timestamp, open_c, high_c, low_c, close_c, _volume = candle
            candle_dt = datetime.fromtimestamp(timestamp / 1000, tz=UTC)
            candle_date = candle_dt.date()
            open_price = float(open_c)
            high_price = float(high_c)
            low_price = float(low_c)
            close_price = float(close_c)
            closes.append(close_price)

            # ── Step 1: open pending entry at this candle's open ──────────
            if pending_entry is not None and open_trade is None:
                side = pending_entry
                entry = open_price
                open_trade = _OpenTrade(
                    symbol=symbol,
                    side=side,
                    opened_at=candle_dt,
                    opened_index=index,
                    entry_price=entry,
                    take_profit_price=calculate_take_profit(entry, margin_per_trade, leverage, rr_ratio, side),
                    stop_loss_price=calculate_stop_loss(entry, margin_per_trade, leverage, side),
                )
                daily_trade_count[candle_date] = daily_trade_count.get(candle_date, 0) + 1
                pending_entry = None

            # ── Step 2: check SL / TP for the open trade ──────────────────
            if open_trade is not None:
                if open_trade.side == "long":
                    hit_sl = low_price <= open_trade.stop_loss_price
                    hit_tp = high_price >= open_trade.take_profit_price
                else:  # short (futures only)
                    hit_sl = high_price >= open_trade.stop_loss_price
                    hit_tp = low_price <= open_trade.take_profit_price

                if hit_sl and hit_tp:
                    hit_tp = False  # conservative: SL wins when both touched same candle

                if hit_sl or hit_tp:
                    close_p = open_trade.stop_loss_price if hit_sl else open_trade.take_profit_price
                    reason = "stop_loss" if hit_sl else "take_profit"
                    symbol_orders.append(
                        _finalize_trade(
                            open_trade=open_trade,
                            closed_at=candle_dt,
                            close_price=close_p,
                            close_reason=reason,
                            margin_per_trade=margin_per_trade,
                            leverage=leverage,
                            bars_held=max(index - open_trade.opened_index, 1),
                        )
                    )
                    open_trade = None

            # ── Step 3: look for a new MACD signal ────────────────────────
            if open_trade is not None or pending_entry is not None:
                continue
            if index >= len(candles) - 1:
                continue

            signal = get_macd_signal(closes)
            if signal is None:
                continue

            next_date = datetime.fromtimestamp(candles[index + 1][0] / 1000, tz=UTC).date()
            if daily_trade_count.get(next_date, 0) >= 2:
                continue

            if signal.is_bullish_crossover:
                pending_entry = "long"
            elif signal.is_bearish_crossover and is_futures:
                # SHORT only available in futures mode
                pending_entry = "short"

        # Force-close any trade still open at end of window
        if open_trade is not None:
            symbol_orders.append(
                _finalize_trade(
                    open_trade=open_trade,
                    closed_at=symbol_period_end,
                    close_price=float(candles[-1][4]),
                    close_reason="final_close",
                    margin_per_trade=margin_per_trade,
                    leverage=leverage,
                    bars_held=max(len(candles) - 1 - open_trade.opened_index, 1),
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
    )
