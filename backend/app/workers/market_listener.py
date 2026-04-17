"""
Market Listener Worker
======================

An internal asyncio runner that continuously monitors exchange market data and
user open trades in real time.  This replaces the on-demand REST polling used
by the /trading/macd-signal endpoint.

Responsibilities
----------------
1. **MACD signal tracking** — polls D1 OHLCV for BTC/USDT, ETH/USDT, HYPE/USDT
   every ``MARKET_POLL_INTERVAL`` seconds and caches the latest MACDSignal.

2. **TP / SL auto-close** — for every open MACD trade, fetches the latest mark
   price from OKX (or the user's connected exchange) and automatically closes
   the trade (status → "win" or "loss") when TP or SL is hit.

Cached signal state
-------------------
The ``LATEST_SIGNALS`` dict maps symbol → MACDSignal (or None).
API handlers can read from this cache instead of hitting the exchange.

Configuration (via .env / environment variables)
-------------------------------------------------
MARKET_POLL_INTERVAL   — seconds between market data polls (default 60)
"""

import asyncio
import logging
from datetime import date
from typing import Dict, Optional

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.trade import MACD_ALLOWED_SYMBOLS, StrategyTrade
from app.services.exchange import exchange_service
from app.services.macd_strategy import MACDSignal, get_macd_signal

log = logging.getLogger(__name__)

# Shared cache: symbol → latest MACDSignal (None until first successful fetch)
# Protected by _signals_lock for writes; readers may read without locking since
# Python dict assignment is atomic (GIL) and stale reads are acceptable here.
LATEST_SIGNALS: Dict[str, Optional[MACDSignal]] = {s: None for s in MACD_ALLOWED_SYMBOLS}
_signals_lock = asyncio.Lock()

# How often to re-poll market data (seconds)
MARKET_POLL_INTERVAL: int = settings.MARKET_POLL_INTERVAL


# ---------------------------------------------------------------------------
# MACD signal refresh
# ---------------------------------------------------------------------------

async def _refresh_macd_signals() -> None:
    """Fetch D1 OHLCV for every allowed symbol and update LATEST_SIGNALS."""
    try:
        exchange = exchange_service.get_default_exchange()
    except Exception as exc:
        log.warning("Cannot initialise default exchange for market data: %s", exc)
        return

    for symbol in MACD_ALLOWED_SYMBOLS:
        try:
            ohlcv = await asyncio.to_thread(
                exchange.fetch_ohlcv, symbol, "1d", limit=60
            )
            closes = [candle[4] for candle in ohlcv]
            signal = get_macd_signal(closes) if len(closes) >= 35 else None
            async with _signals_lock:
                LATEST_SIGNALS[symbol] = signal
            if signal:
                log.debug(
                    "%s MACD signal updated: macd=%.4f signal=%.4f bull=%s bear=%s",
                    symbol, signal.macd, signal.signal,
                    signal.is_bullish_crossover, signal.is_bearish_crossover,
                )
        except Exception as exc:
            log.warning("Failed to fetch OHLCV for %s: %s", symbol, exc)


# ---------------------------------------------------------------------------
# TP / SL monitoring
# ---------------------------------------------------------------------------

async def _check_open_trades() -> None:
    """
    For every open MACD trade, check whether the current price has hit the
    take-profit or stop-loss level and auto-close the trade if so.
    """
    db = SessionLocal()
    try:
        open_trades = (
            db.query(StrategyTrade)
            .filter(
                StrategyTrade.strategy_type == "macd",
                StrategyTrade.status == "open",
            )
            .all()
        )
        if not open_trades:
            return

        try:
            exchange = exchange_service.get_default_exchange()
        except Exception as exc:
            log.warning("Cannot initialise exchange for TP/SL check: %s", exc)
            return

        # Fetch tickers only for symbols that have open trades (deduplicated)
        symbols_needed = {t.symbol for t in open_trades}
        prices: Dict[str, float] = {}
        for sym in symbols_needed:
            try:
                ticker = await asyncio.to_thread(exchange_service.get_ticker, exchange, sym)
                prices[sym] = ticker["last"]
            except Exception as exc:
                log.warning("Cannot fetch ticker for %s: %s", sym, exc)

        for trade in open_trades:
            current_price = prices.get(trade.symbol)
            if current_price is None:
                continue

            details = trade.details or {}
            tp = details.get("take_profit_price")
            sl = details.get("stop_loss_price")

            if tp is None or sl is None:
                continue

            tp_price = float(tp)
            sl_price = float(sl)

            if current_price >= tp_price:
                trade.status = "win"
                log.info(
                    "Trade #%d (%s) HIT TAKE PROFIT at %.4f (TP=%.4f)",
                    trade.id, trade.symbol, current_price, tp_price,
                )
            elif current_price <= sl_price:
                trade.status = "loss"
                log.info(
                    "Trade #%d (%s) HIT STOP LOSS at %.4f (SL=%.4f)",
                    trade.id, trade.symbol, current_price, sl_price,
                )

        db.commit()
    except Exception as exc:
        log.exception("Error during TP/SL check: %s", exc)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Main runner loop
# ---------------------------------------------------------------------------

async def market_listener_loop() -> None:
    """
    Entry-point for the market listener.
    Runs forever; exceptions are caught per-task and the loop retries.
    """
    log.info(
        "Market listener started. Poll interval: %ds. Watching: %s",
        MARKET_POLL_INTERVAL,
        ", ".join(MACD_ALLOWED_SYMBOLS),
    )

    while True:
        await asyncio.gather(
            _refresh_macd_signals(),
            _check_open_trades(),
            return_exceptions=True,
        )
        await asyncio.sleep(MARKET_POLL_INTERVAL)
