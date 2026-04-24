from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Dict, List, Optional

from app.models.strategy import STRATEGY_DCA, STRATEGY_DCA_MACD_DAILY, Strategy


def _round(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    return round(float(value), 2)


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
    timeframe: str = "1d/15m",
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
        "timeframe": timeframe,
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
    """Dispatch to the per-strategy backtest implementation."""
    if strategy.strategy == STRATEGY_DCA_MACD_DAILY:
        from app.strategies.dca_macd_daily.backtest import run_dca_macd_daily_backtest
        return run_dca_macd_daily_backtest(
            strategy, lookback_days=lookback_days, margin_per_trade=margin_per_trade
        )
    if strategy.strategy == STRATEGY_DCA:
        from app.strategies.dca.backtest import run_dca_backtest
        return run_dca_backtest(
            strategy, lookback_days=lookback_days, margin_per_trade=margin_per_trade
        )
    raise ValueError(f"Backtesting is not implemented for strategy '{strategy.strategy}'")

