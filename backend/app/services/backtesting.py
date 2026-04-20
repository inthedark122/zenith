from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Dict, List, Optional

import ccxt

from app.models.strategy import STRATEGY_DCA_MACD_DAILY, Strategy
from app.services.exchange_factory import create_exchange
from app.strategies.dca_macd_daily.strategy import (
    calculate_stop_loss,
    calculate_take_profit,
    get_macd_signal,
)

_ASSUMPTION_NOTES = [
    "Uses OKX daily OHLCV candles.",
    "Simulates D1 bullish crossover entries only; the 15m recovery leg is not modeled.",
    "Allows one open long position per symbol at a time.",
    "If both stop loss and take profit are touched in the same candle, stop loss wins to stay conservative.",
    "If a trade is still open on the final candle, it is closed at the last close for reporting.",
]


@dataclass
class _OpenTrade:
    symbol: str
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
    pnl_pct = ((close_price - open_trade.entry_price) / open_trade.entry_price) * leverage * 100
    pnl_usd = (pnl_pct / 100) * margin_per_trade
    status = "win" if pnl_usd >= 0 else "loss"
    return {
        "symbol": open_trade.symbol,
        "side": "long",
        "status": status,
        "opened_at": open_trade.opened_at.isoformat(),
        "closed_at": closed_at.isoformat(),
        "entry_price": round(open_trade.entry_price, 8),
        "exit_price": round(close_price, 8),
        "take_profit_price": round(open_trade.take_profit_price, 8),
        "stop_loss_price": round(open_trade.stop_loss_price, 8),
        "margin_per_trade": round(margin_per_trade, 2),
        "leverage": round(leverage, 4),
        "pnl_usd": _round(pnl_usd),
        "pnl_pct": _round(pnl_pct),
        "close_reason": close_reason,
        "bars_held": bars_held,
    }


def _build_symbol_summary(symbol: str, orders: List[Dict[str, Any]]) -> Dict[str, Any]:
    wins = sum(1 for order in orders if order["pnl_usd"] >= 0)
    losses = len(orders) - wins
    net_profit = sum(order["pnl_usd"] for order in orders)
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
    symbol_results: List[Dict[str, Any]],
    orders: List[Dict[str, Any]],
) -> Dict[str, Any]:
    wins = [order["pnl_usd"] for order in orders if order["pnl_usd"] >= 0]
    losses = [order["pnl_usd"] for order in orders if order["pnl_usd"] < 0]
    net_profit = sum(order["pnl_usd"] for order in orders)
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    equity = 0.0
    peak = 0.0
    max_drawdown = 0.0
    max_drawdown_pct = 0.0
    for order in orders:
        equity += order["pnl_usd"]
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
        "assumption_notes": _ASSUMPTION_NOTES,
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
        "best_trade_usd": _round(max((order["pnl_usd"] for order in orders), default=None)),
        "worst_trade_usd": _round(min((order["pnl_usd"] for order in orders), default=None)),
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
        symbol_period_start = datetime.fromtimestamp(candles[0][0] / 1000, tz=UTC)
        symbol_period_end = datetime.fromtimestamp(candles[-1][0] / 1000, tz=UTC)
        if overall_period_start is None or symbol_period_start < overall_period_start:
            overall_period_start = symbol_period_start
        if overall_period_end is None or symbol_period_end > overall_period_end:
            overall_period_end = symbol_period_end

        for index, candle in enumerate(candles):
            timestamp, _open, high, low, close, _volume = candle
            candle_time = datetime.fromtimestamp(timestamp / 1000, tz=UTC)
            close_price = float(close)
            closes.append(close_price)

            if open_trade is not None:
                if float(low) <= open_trade.stop_loss_price:
                    symbol_orders.append(
                        _finalize_trade(
                            open_trade=open_trade,
                            closed_at=candle_time,
                            close_price=open_trade.stop_loss_price,
                            close_reason="stop_loss",
                            margin_per_trade=margin_per_trade,
                            leverage=leverage,
                            bars_held=max(index - open_trade.opened_index, 1),
                        )
                    )
                    open_trade = None
                elif float(high) >= open_trade.take_profit_price:
                    symbol_orders.append(
                        _finalize_trade(
                            open_trade=open_trade,
                            closed_at=candle_time,
                            close_price=open_trade.take_profit_price,
                            close_reason="take_profit",
                            margin_per_trade=margin_per_trade,
                            leverage=leverage,
                            bars_held=max(index - open_trade.opened_index, 1),
                        )
                    )
                    open_trade = None

            signal = get_macd_signal(closes)
            if signal is None or open_trade is not None:
                continue

            if signal.is_bullish_crossover and index < len(candles) - 1:
                open_trade = _OpenTrade(
                    symbol=symbol,
                    opened_at=candle_time,
                    opened_index=index,
                    entry_price=close_price,
                    take_profit_price=calculate_take_profit(
                        entry_price=close_price,
                        margin=margin_per_trade,
                        leverage=leverage,
                        rr_ratio=float(strategy.rr_ratio),
                    ),
                    stop_loss_price=calculate_stop_loss(
                        entry_price=close_price,
                        margin=margin_per_trade,
                        leverage=leverage,
                    ),
                )

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

    all_orders.sort(key=lambda order: (order["closed_at"], order["symbol"]))
    return _summarize_orders(
        strategy=strategy,
        lookback_days=lookback_days,
        margin_per_trade=margin_per_trade,
        period_start=overall_period_start,
        period_end=overall_period_end,
        symbol_results=symbol_results,
        orders=all_orders,
    )
