"""
Trading API — user-facing
==========================

Design
------
* Admin defines Strategy templates via /admin/strategies.
* Users browse active strategies via GET /trading/strategies.
* Users start a StrategyWorker via POST /trading/launch.
  They supply margin, pick an exchange, and choose which symbols to trade.
  The worker runs autonomously — it opens and closes trades without user input.
* Users can force-stop a running worker via POST /trading/stop/{worker_id};
  all open trades under that worker are force-closed (status → "closed").
* GET /trading/workers   — lists the user's workers.
* GET /trading/trades    — read-only trade history (created only by workers).
* GET /trading/signal/{strategy_id} — cached D1 MACD signal.

Subscription restrictions
--------------------------
* Users must have an active subscription to start a worker.
* The number of concurrently running workers is limited by the subscription plan
  (starter → 1 token, trader → 2 tokens, pro → 3 tokens).
* Selected symbols must be within the subscription's chosen coins (if coins is set).
"""

from datetime import date, datetime
import logging
from typing import List, Optional

import ccxt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, get_db
from app.exchange.order_executor import build_authenticated_exchange, close_long_position, liquidate_symbol
from app.models.exchange import EXCHANGE_STATUS_VERIFIED, UserExchange
from app.models.strategy import Strategy
from app.models.subscription import Subscription
from app.models.trade import StrategyTrade, TradeStatus
from app.models.user import User
from app.models.worker import StrategyWorker, WorkerStatus
from app.schemas.strategy import StrategyResponse
from app.schemas.trade import MACDSignalResponse, StrategyTradeResponse
from app.schemas.worker import WorkerLaunchRequest, WorkerResponse, WorkerStopResponse, TokenStartRequest, TokenStopRequest, TokenStopResponse
from app.strategies.dca_macd_daily.strategy import (
    STRATEGY_NAME as DCA_MACD_DAILY_STRATEGY_NAME,
    check_daily_trade_status,
    get_macd_signal,
    signal_cache as dca_signal_cache,
)

router = APIRouter(prefix="/trading", tags=["trading"])
log = logging.getLogger(__name__)

# Concurrent token (worker) limits per plan
_PLAN_MAX_TOKENS = {
    "starter": 1,
    "trader": 2,
    "pro": 3,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_active_subscription_or_403(user: User, db: Session) -> Subscription:
    sub = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id, Subscription.status == "active")
        .first()
    )
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active subscription is required to use trading features",
        )
    return sub


def _get_strategy_or_404(strategy_id: int, db: Session) -> Strategy:
    strategy = (
        db.query(Strategy)
        .filter(Strategy.id == strategy_id, Strategy.is_active)
        .first()
    )
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return strategy


def _resolve_user_exchange(user_id: int, db: Session) -> Optional[UserExchange]:
    """Return the user's default exchange; falls back to the oldest if no default is set."""
    return (
        db.query(UserExchange)
        .filter(UserExchange.user_id == user_id)
        .order_by(UserExchange.is_default.desc(), UserExchange.created_at.asc())
        .first()
    )


# ---------------------------------------------------------------------------
# Strategy listing
# ---------------------------------------------------------------------------

@router.get("/strategies", response_model=List[StrategyResponse])
def list_active_strategies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all active strategy templates that users can activate."""
    return (
        db.query(Strategy)
        .options(selectinload(Strategy.backtest_runs))
        .filter(Strategy.is_active)
        .order_by(Strategy.id.asc())
        .all()
    )


# ---------------------------------------------------------------------------
# MACD signal (worker cache + live fallback)
# ---------------------------------------------------------------------------

@router.get("/signal/{strategy_id}", response_model=MACDSignalResponse)
def get_signal(
    strategy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the latest D1 MACD signal for the first symbol of the strategy.

    Served from the strategy's LRU signal cache; falls back to a live fetch.
    """
    strategy = _get_strategy_or_404(strategy_id, db)
    symbols = strategy.symbols or []
    symbol = symbols[0] if symbols else None

    signal = dca_signal_cache.get("okx", symbol, DCA_MACD_DAILY_STRATEGY_NAME, "1d") if symbol else None
    if signal is None and symbol:
        try:
            exchange = ccxt.okx({"enableRateLimit": True})
            ohlcv = exchange.fetch_ohlcv(symbol, timeframe="1d", limit=60)
            closes = [candle[4] for candle in ohlcv]
            signal = get_macd_signal(closes) if len(closes) >= 35 else None
        except Exception:
            signal = None

    today = date.today()
    today_trades = (
        db.query(StrategyTrade)
        .join(StrategyWorker, StrategyTrade.worker_id == StrategyWorker.id)
        .filter(
            StrategyWorker.user_id == current_user.id,
            StrategyTrade.strategy_id == strategy_id,
            StrategyTrade.trade_date == today,
        )
        .order_by(StrategyTrade.created_at.asc())
        .all()
    )
    daily_status = check_daily_trade_status([t.status for t in today_trades])

    return MACDSignalResponse(
        symbol=symbol or "",
        macd=round(signal.macd, 6) if signal else 0.0,
        signal=round(signal.signal, 6) if signal else 0.0,
        histogram=round(signal.histogram, 6) if signal else 0.0,
        is_bullish_crossover=signal.is_bullish_crossover if signal else False,
        is_bearish_crossover=signal.is_bearish_crossover if signal else False,
        can_open_trade=daily_status.can_open_trade,
        next_entry_number=daily_status.next_entry_number,
        daily_status_reason=daily_status.reason,
    )


# ---------------------------------------------------------------------------
# Start a strategy worker
# ---------------------------------------------------------------------------

@router.post("/launch", response_model=WorkerResponse, status_code=status.HTTP_201_CREATED)
def launch_worker(
    payload: WorkerLaunchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start a strategy worker for the authenticated user.

    The worker runs autonomously in the background. It reads the Strategy
    config and the worker's selected_symbols, and opens / closes trades on the
    user's behalf.

    Validation:
    - Active subscription required.
    - Subscription plan limits concurrent running workers.
    - Selected symbols must be within strategy.symbols and subscription.coins.
    - Margin must be > 0; validated against the cached exchange balance.
    - Exchange must be verified.
    """
    # 1. Active subscription gate
    sub = _get_active_subscription_or_403(current_user, db)
    strategy = _get_strategy_or_404(payload.strategy_id, db)

    # 2. Plan-based concurrent token limit
    max_tokens = _PLAN_MAX_TOKENS.get(sub.plan, 1)
    running_count = (
        db.query(StrategyWorker)
        .filter(
            StrategyWorker.user_id == current_user.id,
            StrategyWorker.status == WorkerStatus.RUNNING,
        )
        .count()
    )
    if running_count >= max_tokens:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Your '{sub.plan}' plan allows {max_tokens} concurrent worker(s). "
                f"Stop an existing worker before starting a new one."
            ),
        )

    # 3. Resolve exchange
    if payload.user_exchange_id:
        user_exchange_row = (
            db.query(UserExchange)
            .filter(
                UserExchange.id == payload.user_exchange_id,
                UserExchange.user_id == current_user.id,
            )
            .first()
        )
        if user_exchange_row is None:
            raise HTTPException(status_code=404, detail="Exchange not found")
    else:
        user_exchange_row = _resolve_user_exchange(current_user.id, db)

    if user_exchange_row is None:
        raise HTTPException(
            status_code=400,
            detail="No exchange connected. Connect an API key first.",
        )

    if user_exchange_row.status != EXCHANGE_STATUS_VERIFIED:
        raise HTTPException(
            status_code=400,
            detail="Exchange credentials are not verified. Please recheck your API key.",
        )

    exchange_id = user_exchange_row.exchange_id

    # 4. Validate selected symbols
    selected_symbols: List[str] = payload.selected_symbols or []
    if not selected_symbols:
        raise HTTPException(
            status_code=400,
            detail="Select at least one token to trade.",
        )

    # symbols defined on the strategy (support both dict and StrategySymbol objects)
    strategy_symbol_set = set()
    for sym in (strategy.symbols or []):
        if isinstance(sym, dict):
            strategy_symbol_set.add(sym.get("symbol", ""))
        else:
            strategy_symbol_set.add(sym.symbol)

    invalid_strategy = [s for s in selected_symbols if s not in strategy_symbol_set]
    if invalid_strategy:
        raise HTTPException(
            status_code=400,
            detail=f"Symbol(s) not in strategy: {', '.join(invalid_strategy)}",
        )

    # 5. Create worker
    worker = StrategyWorker(
        user_id=current_user.id,
        strategy_id=payload.strategy_id,
        exchange_id=exchange_id,
        user_exchange_id=user_exchange_row.id,
        selected_symbols=selected_symbols,
        symbol_margins=dict(payload.symbol_margins) if payload.symbol_margins else {},
        status=WorkerStatus.RUNNING,
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return worker


# ---------------------------------------------------------------------------
# Force-stop a strategy worker
# ---------------------------------------------------------------------------

@router.post("/stop/{worker_id}", response_model=WorkerStopResponse)
def stop_worker(
    worker_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Force-stop a running strategy worker.

    All open trades belonging to this worker are force-closed (status → "closed").
    The response includes the number of trades that were closed.
    """
    worker = (
        db.query(StrategyWorker)
        .filter(
            StrategyWorker.id == worker_id,
            StrategyWorker.user_id == current_user.id,
        )
        .first()
    )
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")
    if worker.status != WorkerStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Worker is not running")

    # Force-close all OPEN and PENDING trades under this worker.
    # liquidate_symbol() already cancels all open exchange orders (including
    # PENDING limit safety orders) — we just need to mark DB rows CLOSED too.
    active_trades = (
        db.query(StrategyTrade)
        .filter(
            StrategyTrade.worker_id == worker.id,
            StrategyTrade.status.in_([TradeStatus.OPEN, TradeStatus.PENDING]),
        )
        .all()
    )
    open_trades = [t for t in active_trades if t.status == TradeStatus.OPEN]

    # Attempt to cancel open orders and close open positions on the exchange.
    # Group by symbol so each position is liquidated exactly once (DCA may
    # have several DB trades for the same exchange position).
    if worker.user_exchange_id and worker.user_exchange:
        try:
            exchange_client = build_authenticated_exchange(worker.user_exchange)

            # Build {symbol: {market_type, spot_contracts}} from OPEN DB trades only
            # (PENDING = not yet filled, so no real spot holdings to close)
            symbol_info: dict[str, dict] = {}
            for trade in open_trades:
                details = trade.details or {}
                sym = trade.symbol
                if sym not in symbol_info:
                    symbol_info[sym] = {
                        "market_type": details.get("market_type", "spot"),
                        "spot_contracts": 0.0,
                    }
                # Accumulate spot contracts in case get_open_position_size is N/A
                symbol_info[sym]["spot_contracts"] += float(
                    details.get("contracts") or 0
                )

            for sym, info in symbol_info.items():
                errors = liquidate_symbol(
                    exchange_client,
                    sym,
                    info["market_type"],
                    spot_contracts=info["spot_contracts"],
                )
                if errors:
                    log.warning(
                        "stop_worker #%d: liquidate %s errors: %s",
                        worker.id, sym, "; ".join(errors),
                    )
        except Exception as exc:
            log.error("stop_worker #%d: exchange cleanup failed: %s", worker.id, exc)

    for trade in active_trades:
        trade.status = TradeStatus.CLOSED

    worker.status = WorkerStatus.STOPPED
    worker.stopped_at = datetime.utcnow()
    db.commit()
    db.refresh(worker)

    closed_count = len(active_trades)
    return WorkerStopResponse(
        **WorkerResponse.model_validate(worker).model_dump(),
        closed_trades_count=closed_count,
        message=(
            f"Worker stopped. {closed_count} open trade(s) were force-closed."
            if closed_count
            else "Worker stopped. No open trades to close."
        ),
    )


# ---------------------------------------------------------------------------
# Worker listing
# ---------------------------------------------------------------------------

@router.get("/workers", response_model=List[WorkerResponse])
def list_workers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all strategy workers for the current user, most recent first."""
    return (
        db.query(StrategyWorker)
        .filter(StrategyWorker.user_id == current_user.id)
        .order_by(StrategyWorker.created_at.desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Trade history (read-only — created by workers)
# ---------------------------------------------------------------------------

@router.get("/trades", response_model=List[StrategyTradeResponse])
def list_trades(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all trades for the current user, most recent first."""
    return (
        db.query(StrategyTrade)
        .filter(StrategyTrade.user_id == current_user.id)
        .order_by(StrategyTrade.created_at.desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Token-level start / stop (user-facing — worker is internal)
# ---------------------------------------------------------------------------

def _find_running_worker(
    user_id: int,
    strategy_id: int,
    user_exchange_id: int,
    db: Session,
) -> Optional[StrategyWorker]:
    return (
        db.query(StrategyWorker)
        .filter(
            StrategyWorker.user_id == user_id,
            StrategyWorker.strategy_id == strategy_id,
            StrategyWorker.user_exchange_id == user_exchange_id,
            StrategyWorker.status == WorkerStatus.RUNNING,
        )
        .first()
    )


@router.post("/tokens/start", response_model=WorkerResponse)
def start_tokens(
    payload: TokenStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start trading specific tokens for a strategy.

    The backend transparently creates a new worker or adds the symbols to the
    existing running worker for the same (user, strategy, exchange).  Workers
    are never exposed to the caller — only the resulting active state matters.
    """
    sub = _get_active_subscription_or_403(current_user, db)
    strategy = _get_strategy_or_404(payload.strategy_id, db)

    # Resolve exchange
    if payload.user_exchange_id:
        user_exchange_row = (
            db.query(UserExchange)
            .filter(
                UserExchange.id == payload.user_exchange_id,
                UserExchange.user_id == current_user.id,
            )
            .first()
        )
        if user_exchange_row is None:
            raise HTTPException(status_code=404, detail="Exchange not found")
    else:
        user_exchange_row = _resolve_user_exchange(current_user.id, db)

    if user_exchange_row is None:
        raise HTTPException(status_code=400, detail="No exchange connected. Connect an API key first.")
    if user_exchange_row.status != EXCHANGE_STATUS_VERIFIED:
        raise HTTPException(status_code=400, detail="Exchange credentials are not verified.")

    # Validate symbols
    if not payload.symbols:
        raise HTTPException(status_code=400, detail="Select at least one token to trade.")
    strategy_symbol_set = {
        (s.get("symbol", "") if isinstance(s, dict) else s.symbol)
        for s in (strategy.symbols or [])
    }
    invalid = [s for s in payload.symbols if s not in strategy_symbol_set]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Symbol(s) not in strategy: {', '.join(invalid)}")

    # Try to find an existing running worker for this strategy+exchange
    existing = _find_running_worker(current_user.id, payload.strategy_id, user_exchange_row.id, db)

    if existing:
        # Add new symbols to the existing worker (set union, preserve order)
        current_syms = list(existing.selected_symbols or [])
        merged = current_syms + [s for s in payload.symbols if s not in current_syms]
        existing.selected_symbols = merged
        # Merge per-symbol margins (new values override existing for the same symbol)
        if payload.symbol_margins:
            merged_margins = dict(existing.symbol_margins or {})
            merged_margins.update(payload.symbol_margins)
            existing.symbol_margins = merged_margins
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(existing, "symbol_margins")
        db.commit()
        db.refresh(existing)
        return existing

    # No existing worker — create one (check plan limit first)
    max_tokens = _PLAN_MAX_TOKENS.get(sub.plan, 1)
    running_count = (
        db.query(StrategyWorker)
        .filter(
            StrategyWorker.user_id == current_user.id,
            StrategyWorker.status == WorkerStatus.RUNNING,
        )
        .count()
    )
    if running_count >= max_tokens:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Your '{sub.plan}' plan allows {max_tokens} concurrent active strateg{'y' if max_tokens == 1 else 'ies'}. "
                f"Stop an existing strategy before starting a new one."
            ),
        )

    worker = StrategyWorker(
        user_id=current_user.id,
        strategy_id=payload.strategy_id,
        exchange_id=user_exchange_row.exchange_id,
        user_exchange_id=user_exchange_row.id,
        selected_symbols=list(payload.symbols),
        symbol_margins=dict(payload.symbol_margins) if payload.symbol_margins else {},
        status=WorkerStatus.RUNNING,
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return worker


@router.post("/tokens/stop", response_model=TokenStopResponse)
def stop_tokens(
    payload: TokenStopRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stop trading specific tokens for a strategy.

    Each symbol is liquidated on the exchange (open orders cancelled, open
    position closed) then removed from the worker's selected_symbols.
    If no symbols remain, the worker is stopped entirely.
    """
    # Resolve exchange
    if payload.user_exchange_id:
        user_exchange_row = (
            db.query(UserExchange)
            .filter(
                UserExchange.id == payload.user_exchange_id,
                UserExchange.user_id == current_user.id,
            )
            .first()
        )
        if user_exchange_row is None:
            raise HTTPException(status_code=404, detail="Exchange not found")
    else:
        user_exchange_row = _resolve_user_exchange(current_user.id, db)

    if user_exchange_row is None:
        raise HTTPException(status_code=400, detail="No exchange connected.")

    worker = _find_running_worker(current_user.id, payload.strategy_id, user_exchange_row.id, db)
    if worker is None:
        raise HTTPException(status_code=404, detail="No active trading session found for this strategy.")

    if not payload.symbols:
        raise HTTPException(status_code=400, detail="Specify at least one token to stop.")

    # Liquidate each symbol on the exchange.
    # Query both OPEN and PENDING trades — liquidate_symbol() cancels all open
    # exchange orders (including PENDING limit safety buys) automatically.
    active_trades = (
        db.query(StrategyTrade)
        .filter(
            StrategyTrade.worker_id == worker.id,
            StrategyTrade.status.in_([TradeStatus.OPEN, TradeStatus.PENDING]),
            StrategyTrade.symbol.in_(payload.symbols),
        )
        .all()
    )
    open_trades = [t for t in active_trades if t.status == TradeStatus.OPEN]

    # Build symbol_info from OPEN trades only (PENDING = unfilled, no real holdings)
    symbol_info: dict[str, dict] = {}
    for trade in open_trades:
        details = trade.details or {}
        sym = trade.symbol
        if sym not in symbol_info:
            symbol_info[sym] = {"market_type": details.get("market_type", "spot"), "spot_contracts": 0.0}
        symbol_info[sym]["spot_contracts"] += float(details.get("contracts") or 0)

    if symbol_info and worker.user_exchange:
        try:
            exchange_client = build_authenticated_exchange(worker.user_exchange)
            for sym, info in symbol_info.items():
                errors = liquidate_symbol(exchange_client, sym, info["market_type"], spot_contracts=info["spot_contracts"])
                if errors:
                    log.warning("stop_tokens worker #%d: liquidate %s errors: %s", worker.id, sym, "; ".join(errors))
        except Exception as exc:
            log.error("stop_tokens worker #%d: exchange cleanup failed: %s", worker.id, exc)

    for trade in active_trades:
        trade.status = TradeStatus.CLOSED

    # Remove stopped symbols from worker
    remaining = [s for s in (worker.selected_symbols or []) if s not in payload.symbols]
    worker_stopped = len(remaining) == 0

    if worker_stopped:
        worker.status = WorkerStatus.STOPPED
        worker.stopped_at = datetime.utcnow()
        worker.selected_symbols = []
    else:
        worker.selected_symbols = remaining

    db.commit()

    return TokenStopResponse(
        stopped_symbols=list(payload.symbols),
        worker_stopped=worker_stopped,
        message=(
            f"Stopped {len(payload.symbols)} token(s). Trading session ended."
            if worker_stopped
            else f"Stopped {len(payload.symbols)} token(s). {len(remaining)} still active."
        ),
    )


