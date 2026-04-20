from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Dict, List, Optional

import ccxt

from app.models.strategy import STRATEGY_DCA_MACD_DAILY, Strategy
from app.strategies.dca_macd_daily.strategy import (
    calculate_stop_loss,
    calculate_take_profit,
    get_macd_signal,
)

_ASSUMPTION_NOTES = [
    "Uses OKX daily OHLCV candles.",
    "Simulates D1 crossover entries only; the 15m recovery leg is not modeled in this summary.",
    "Allows one open position per symbol at a time.",
    "If a trade is still open on the final candle, it is closed at the last close for reporting.",
]


@dataclass
class _SimulatedTrade:
    entry_price: float
    take_profit_price: float
    stop_loss_price: float


def run_strategy_backtest(
    strategy: Strategy,
    *,
    lookback_days: int,
    margin_per_trade: float,
) -> Dict[str, Any]:
    if strategy.strategy != STRATEGY_DCA_MACD_DAILY:
        raise ValueError(f"Backtesting is not implemented for strategy '{strategy.strategy}'")

    exchange = ccxt.okx({"enableRateLimit": True})
    symbol_results: List[Dict[str, Any]] = []
    total_trades = 0
    total_wins = 0
    total_losses = 0
    total_net_profit = 0.0
    period_start: Optional[str] = None
    period_end: Optional[str] = None

    limit = min(max(lookback_days + 60, 120), 1000)

    for symbol in strategy.symbols or []:
        candles = exchange.fetch_ohlcv(symbol, timeframe="1d", limit=limit)
        if len(candles) < 35:
            symbol_results.append(
                {
                    "symbol": symbol,
                    "total_trades": 0,
                    "wins": 0,
                    "losses": 0,
                    "win_rate": 0.0,
                    "net_profit_usd": 0.0,
                }
            )
            continue

        symbol_period_start = datetime.fromtimestamp(candles[0][0] / 1000, tz=UTC).date().isoformat()
        symbol_period_end = datetime.fromtimestamp(candles[-1][0] / 1000, tz=UTC).date().isoformat()
        period_start = min(filter(None, [period_start, symbol_period_start]), default=symbol_period_start)
        period_end = max(filter(None, [period_end, symbol_period_end]), default=symbol_period_end)

        closes: List[float] = []
        open_trade: Optional[_SimulatedTrade] = None
        wins = 0
        losses = 0
        net_profit = 0.0

        for index, candle in enumerate(candles):
            _timestamp, open_price, high_price, low_price, close_price, _volume = candle
            closes.append(float(close_price))

            if open_trade is not None:
                if float(low_price) <= open_trade.stop_loss_price:
                    losses += 1
                    net_profit -= margin_per_trade
                    open_trade = None
                elif float(high_price) >= open_trade.take_profit_price:
                    wins += 1
                    net_profit += margin_per_trade * float(strategy.rr_ratio)
                    open_trade = None

            signal = get_macd_signal(closes)
            if signal is None or open_trade is not None:
                continue

            if signal.is_bullish_crossover and index < len(candles) - 1:
                entry_price = float(close_price)
                open_trade = _SimulatedTrade(
                    entry_price=entry_price,
                    take_profit_price=calculate_take_profit(
                        entry_price=entry_price,
                        margin=margin_per_trade,
                        leverage=float(strategy.leverage),
                        rr_ratio=float(strategy.rr_ratio),
                    ),
                    stop_loss_price=calculate_stop_loss(
                        entry_price=entry_price,
                        margin=margin_per_trade,
                        leverage=float(strategy.leverage),
                    ),
                )

        if open_trade is not None:
            final_close = float(candles[-1][4])
            pnl_ratio = (final_close - open_trade.entry_price) / open_trade.entry_price
            realized_pnl = pnl_ratio * margin_per_trade * float(strategy.leverage)
            if realized_pnl >= 0:
                wins += 1
            else:
                losses += 1
            net_profit += realized_pnl

        trades = wins + losses
        total_trades += trades
        total_wins += wins
        total_losses += losses
        total_net_profit += net_profit
        symbol_results.append(
            {
                "symbol": symbol,
                "total_trades": trades,
                "wins": wins,
                "losses": losses,
                "win_rate": round((wins / trades) * 100, 2) if trades else 0.0,
                "net_profit_usd": round(net_profit, 2),
            }
        )

    return {
        "strategy": strategy.strategy,
        "timeframe": "1d",
        "lookback_days": lookback_days,
        "margin_per_trade": margin_per_trade,
        "generated_at": datetime.now(tz=UTC).isoformat(),
        "period_start": period_start,
        "period_end": period_end,
        "assumption_notes": _ASSUMPTION_NOTES,
        "total_trades": total_trades,
        "wins": total_wins,
        "losses": total_losses,
        "win_rate": round((total_wins / total_trades) * 100, 2) if total_trades else 0.0,
        "net_profit_usd": round(total_net_profit, 2),
        "symbol_results": symbol_results,
    }
