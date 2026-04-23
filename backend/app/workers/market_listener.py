"""
Market Listener — orchestrator
================================

This worker runs as an asyncio background task for the lifetime of the
application.  It is responsible for two things:

1. **Signal cache refresh** — polls D1 OHLCV from the exchange every
   ``MARKET_POLL_INTERVAL`` seconds for all symbols referenced by any
   active Strategy record and stores the result in the strategy's
   ``signal_cache`` (LRU cache keyed by exchange-symbol-strategy-timeframe).

2. **Strategy worker dispatch** — for every *running* StrategyWorker,
   calls the matching strategy-implementation module so it can evaluate
   entry signals and monitor open trades.

Strategy implementations live under ``app/strategies/<strategy_id>/worker.py``
and each exposes a single function::

    def run_for_worker(
        worker: StrategyWorker,
        latest_signals: Dict[str, Optional[MACDSignal]],
        current_prices: Dict[str, float],
        db: Session,
    ) -> None: ...

Currently supported strategies:
  - ``DCA_MACD_DAILY`` → app.strategies.dca_macd_daily.worker
"""

import asyncio
import logging
from typing import Dict, Optional

import ccxt

import app.models  # ensure all models registered before any query  # noqa: F401
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.strategy import STRATEGY_DCA, STRATEGY_DCA_MACD_DAILY, Strategy
from app.models.worker import StrategyWorker, WorkerStatus
from app.strategies.dca_macd_daily.strategy import (
    STRATEGY_NAME as DCA_MACD_DAILY_STRATEGY_NAME,
    MACDSignal,
    get_macd_signal,
    signal_cache as dca_signal_cache,
)
from app.strategies.dca_macd_daily import worker as dca_macd_daily_worker
from app.strategies.dca import worker as dca_worker

log = logging.getLogger(__name__)

MARKET_POLL_INTERVAL: int = settings.MARKET_POLL_INTERVAL

# Mapping from strategy identifier → worker module
_STRATEGY_IMPL = {
    STRATEGY_DCA_MACD_DAILY: dca_macd_daily_worker,
    STRATEGY_DCA: dca_worker,
}

# Source exchange for public market data
_PUBLIC_EXCHANGE_ID = "okx"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _collect_symbols(db) -> set:
    """Return all symbols referenced by any active Strategy."""
    strategies = db.query(Strategy).filter(Strategy.is_active).all()
    symbols: set = set()
    for s in strategies:
        for sym_cfg in s.symbols or []:
            # sym_cfg is a dict: {"symbol": "BTC/USDT", "market_type": "spot", "leverage": 1}
            sym = sym_cfg["symbol"] if isinstance(sym_cfg, dict) else sym_cfg
            symbols.add(sym)
    return symbols


async def _refresh_signals(symbols: set) -> None:
    """Fetch D1 OHLCV for each symbol and update the strategy LRU signal cache."""
    if not symbols:
        return
    try:
        exchange = ccxt.okx({"enableRateLimit": True})
    except Exception as exc:
        log.warning("Cannot initialise OKX exchange for MACD refresh: %s", exc)
        return

    for symbol in symbols:
        try:
            ohlcv = await asyncio.to_thread(
                exchange.fetch_ohlcv, symbol, "1d", 60
            )
            closes = [candle[4] for candle in ohlcv]
            signal = get_macd_signal(closes) if len(closes) >= 35 else None
            dca_signal_cache.set(_PUBLIC_EXCHANGE_ID, symbol, DCA_MACD_DAILY_STRATEGY_NAME, "1d", signal)
            if signal:
                log.debug(
                    "%s MACD signal: macd=%.4f signal=%.4f bull=%s",
                    symbol, signal.macd, signal.signal, signal.is_bullish_crossover,
                )
        except Exception as exc:
            log.warning("Failed to fetch OHLCV for %s: %s", symbol, exc)


async def _fetch_prices(symbols: set) -> Dict[str, float]:
    """Fetch the latest mark/last price for each symbol."""
    if not symbols:
        return {}
    try:
        exchange = ccxt.okx({"enableRateLimit": True})
    except Exception as exc:
        log.warning("Cannot initialise OKX exchange for price fetch: %s", exc)
        return {}

    prices: Dict[str, float] = {}
    for sym in symbols:
        try:
            ticker = await asyncio.to_thread(exchange.fetch_ticker, sym)
            prices[sym] = ticker["last"]
        except Exception as exc:
            log.warning("Cannot fetch ticker for %s: %s", sym, exc)
    return prices


def _build_signals_snapshot(symbols: set) -> Dict[str, Optional[MACDSignal]]:
    """Read the current LRU cache state for all active symbols."""
    return {
        sym: dca_signal_cache.get(_PUBLIC_EXCHANGE_ID, sym, DCA_MACD_DAILY_STRATEGY_NAME, "1d")
        for sym in symbols
    }


async def _dispatch_strategy_workers(
    signals: Dict[str, Optional[MACDSignal]],
    prices: Dict[str, float],
) -> None:
    """
    Iterate over all running StrategyWorkers and call the matching strategy
    implementation in a thread so it can safely use synchronous SQLAlchemy.
    """
    db = SessionLocal()
    try:
        running_workers = (
            db.query(StrategyWorker)
            .filter(StrategyWorker.status == WorkerStatus.RUNNING)
            .all()
        )

        for worker in running_workers:
            strategy_key = worker.strategy.strategy if worker.strategy else None
            impl = _STRATEGY_IMPL.get(strategy_key)
            if impl is None:
                log.warning(
                    "Worker #%d: no implementation found for strategy '%s'",
                    worker.id, strategy_key,
                )
                continue
            try:
                impl.run_for_worker(
                    worker=worker,
                    latest_signals=signals,
                    current_prices=prices,
                    db=db,
                )
            except Exception as exc:
                log.exception(
                    "Worker #%d (%s): unhandled error in strategy implementation: %s",
                    worker.id, strategy_key, exc,
                )

        db.commit()
    except Exception as exc:
        log.exception("Error in _dispatch_strategy_workers: %s", exc)
        db.rollback()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Main orchestrator loop
# ---------------------------------------------------------------------------

async def market_listener_loop() -> None:
    """
    Entry point for the market-listener orchestrator.
    Runs forever; each cycle refreshes signals, fetches prices,
    then dispatches all running strategy workers.
    """
    log.info("Market listener orchestrator started. Poll interval: %ds", MARKET_POLL_INTERVAL)

    while True:
        db = SessionLocal()
        try:
            symbols = _collect_symbols(db)
        finally:
            db.close()

        if symbols:
            await _refresh_signals(symbols)
            prices = await _fetch_prices(symbols)
            signals = _build_signals_snapshot(symbols)
            await _dispatch_strategy_workers(signals, prices)
        else:
            log.debug("No active strategies — skipping market poll")

        await asyncio.sleep(MARKET_POLL_INTERVAL)
