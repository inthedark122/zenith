"""
DCA_MACD_DAILY — strategy worker implementation.

Strategy rules
--------------
- Symbols     : admin-configured list (e.g. BTC/USDT, ETH/USDT, HYPE/USDT)
- Timeframe   : D1 for entry signal; 15 m for recovery (2nd entry)
- Direction   : LONG only, following the D1 MACD trend
- Entry signal: D1 MACD bullish crossover (MACD crosses above signal line)
- Risk/Reward : 1:RR  (risk 100% of margin per trade, target RR× that)
- Stop loss   : entry_price × (1 − 1/leverage)
- Daily limits:
    * Entry #1 — triggered by D1 MACD bullish crossover
    * After win  → 1 follow-up entry allowed (still D1 signal)
    * After loss → 1 recovery entry allowed (15 m correction timeframe)
    * After 2nd entry (win or loss) → no more trades that day
- Daily margin cap enforced from Strategy.max_daily_margin_usd (0 = no cap)

This module is called by the market-listener orchestrator once per poll
cycle for every *running* StrategyWorker whose strategy.strategy == "DCA_MACD_DAILY".
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.models.trade import StrategyTrade, TradeStatus
from app.models.worker import StrategyWorker
from app.strategies.dca_macd_daily.strategy import (
    MACDSignal,
    calculate_stop_loss,
    calculate_take_profit,
    check_daily_trade_status,
)

log = logging.getLogger(__name__)


def run_for_worker(
    worker: StrategyWorker,
    latest_signals: Dict[str, Optional[MACDSignal]],
    current_prices: Dict[str, float],
    db: Session,
) -> None:
    """
    Evaluate the DCA_MACD_DAILY strategy for a single running worker.

    Steps
    -----
    1. For every symbol in worker.strategy.symbols:
       a. Check daily trade limits (max_daily_trades from Strategy).
       b. Check daily margin cap (max_daily_margin_usd from Strategy).
       c. If a D1 bullish crossover is cached for this symbol → open a trade.
    2. For every open trade owned by this worker:
       a. Check if current price ≥ take_profit_price → close as win.
       b. Check if current price ≤ stop_loss_price  → close as loss.
    """
    strategy = worker.strategy
    today = date.today()
    margin = float(worker.margin)

    # Read DCA_MACD_DAILY-specific settings from the Strategy.settings JSON field
    settings = strategy.settings or {}
    max_daily_trades: int = int(settings.get("max_daily_trades", 2))
    max_daily_margin_usd: float = float(settings.get("max_daily_margin_usd", 0.0))

    # ------------------------------------------------------------------
    # 1.  Evaluate entry signals for each symbol
    # ------------------------------------------------------------------
    for symbol in (strategy.symbols or []):
        signal = latest_signals.get(symbol)
        if signal is None:
            continue

        # Fetch daily trades for this worker + symbol
        today_trades = (
            db.query(StrategyTrade)
            .filter(
                StrategyTrade.worker_id == worker.id,
                StrategyTrade.symbol == symbol,
                StrategyTrade.trade_date == today,
            )
            .order_by(StrategyTrade.created_at.asc())
            .all()
        )
        daily_status = check_daily_trade_status([t.status for t in today_trades])

        # Enforce max_daily_trades from settings
        if daily_status.trades_today >= max_daily_trades:
            continue

        if not daily_status.can_open_trade:
            continue

        # Check daily margin cap from settings
        if max_daily_margin_usd > 0:
            used = 0.0
            for t in today_trades:
                raw = t.details.get("margin")
                if raw is None:
                    log.warning(
                        "Worker #%d: trade #%d has no margin in details — skipping for cap calc",
                        worker.id, t.id,
                    )
                    continue
                used += float(raw)
            if used + margin > max_daily_margin_usd:
                log.debug(
                    "Worker #%d/%s: daily margin cap reached (%.2f/%.2f)",
                    worker.id, symbol, used, max_daily_margin_usd,
                )
                continue

        # Only open on a fresh D1 bullish crossover for entry #1
        entry_number = daily_status.next_entry_number
        if entry_number == 1 and not signal.is_bullish_crossover:
            continue
        # Entry #2 (recovery / follow-up) uses 15 m — no D1 cross required

        # We need a current price to compute TP/SL
        current_price = current_prices.get(symbol)
        if current_price is None:
            log.warning(
                "Worker #%d: no price available for %s — skipping entry", worker.id, symbol
            )
            continue

        timeframe = "1d" if entry_number == 1 else "15m"
        leverage = strategy.leverage
        rr_ratio = strategy.rr_ratio

        tp = calculate_take_profit(
            entry_price=current_price,
            margin=margin,
            leverage=leverage,
            rr_ratio=rr_ratio,
        )
        sl = calculate_stop_loss(
            entry_price=current_price,
            margin=margin,
            leverage=leverage,
        )

        trade = StrategyTrade(
            user_id=worker.user_id,
            worker_id=worker.id,
            strategy_id=strategy.id,
            symbol=symbol,
            exchange=worker.exchange_id,
            status=TradeStatus.OPEN,
            trade_date=today,
            details={
                "timeframe": timeframe,
                "entry_number": entry_number,
                "entry_price": str(current_price),
                "take_profit_price": str(tp),
                "stop_loss_price": str(sl),
                "margin": str(margin),
                "leverage": leverage,
                "rr_ratio": rr_ratio,
            },
        )
        db.add(trade)
        log.info(
            "Worker #%d: opened %s LONG entry #%d at %.4f (TP %.4f / SL %.4f)",
            worker.id, symbol, entry_number, current_price, tp, sl,
        )

    # ------------------------------------------------------------------
    # 2.  Monitor open trades for TP / SL
    # ------------------------------------------------------------------
    open_trades = (
        db.query(StrategyTrade)
        .filter(
            StrategyTrade.worker_id == worker.id,
            StrategyTrade.status == TradeStatus.OPEN,
        )
        .all()
    )
    for trade in open_trades:
        current_price = current_prices.get(trade.symbol)
        if current_price is None:
            continue

        details = trade.details or {}
        tp_str = details.get("take_profit_price")
        sl_str = details.get("stop_loss_price")
        if tp_str is None or sl_str is None:
            continue

        tp_price = float(tp_str)
        sl_price = float(sl_str)

        if current_price >= tp_price:
            trade.status = TradeStatus.WIN
            log.info(
                "Worker #%d trade #%d (%s) HIT TP at %.4f (TP=%.4f)",
                worker.id, trade.id, trade.symbol, current_price, tp_price,
            )
        elif current_price <= sl_price:
            trade.status = TradeStatus.LOSS
            log.info(
                "Worker #%d trade #%d (%s) HIT SL at %.4f (SL=%.4f)",
                worker.id, trade.id, trade.symbol, current_price, sl_price,
            )
