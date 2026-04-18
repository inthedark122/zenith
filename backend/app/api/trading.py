"""
Trading API — user-facing
==========================

Design
------
* Admin defines Strategy templates via /admin/strategies.
* Users browse active strategies via GET /trading/strategies.
* Users start a StrategyWorker via POST /trading/launch (supplying only margin).
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
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.exchange import UserExchange
from app.models.strategy import Strategy
from app.models.subscription import Subscription
from app.models.trade import StrategyTrade, TradeStatus
from app.models.user import User
from app.models.worker import StrategyWorker, WorkerStatus
from app.schemas.strategy import StrategyResponse
from app.schemas.trade import MACDSignalResponse, StrategyTradeResponse
from app.schemas.worker import WorkerLaunchRequest, WorkerResponse, WorkerStopResponse
from app.services.exchange import ExchangeService
from app.strategies.dca_macd_daily.strategy import check_daily_trade_status, get_macd_signal

router = APIRouter(prefix="/trading", tags=["trading"])

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

    Served from the market-listener worker cache; falls back to a live fetch.
    """
    from app.workers.market_listener import LATEST_SIGNALS

    strategy = _get_strategy_or_404(strategy_id, db)
    symbols = strategy.symbols or []
    symbol = symbols[0] if symbols else None

    signal = LATEST_SIGNALS.get(symbol) if symbol else None
    if signal is None and symbol:
        try:
            exc_service = ExchangeService.default()
            ohlcv = exc_service.fetch_ohlcv(symbol, timeframe="1d", limit=60)
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
    config, polls market signals via the orchestrator, and opens / closes
    trades on the user's behalf — without any further user interaction.

    Validation:
    - Active subscription required.
    - Subscription plan limits concurrent active tokens (running workers).
    - Margin must be > 0; validated against the user's exchange balance when
      a connected exchange is available.
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
                f"Your '{sub.plan}' plan allows trading at most {max_tokens} "
                f"token(s) concurrently. Stop an existing worker before starting a new one."
            ),
        )

    # 3. Validate margin: check against exchange balance if possible
    margin = Decimal(str(payload.margin))
    if margin <= Decimal("0"):
        raise HTTPException(status_code=400, detail="Margin must be positive")

    user_exchange_row = _resolve_user_exchange(current_user.id, db)
    exchange_id = user_exchange_row.exchange_id if user_exchange_row else "okx"

    if user_exchange_row:
        try:
            exc_service = ExchangeService.from_user_exchange(user_exchange_row)
            available = Decimal(str(exc_service.get_balance("USDT")))
            if margin > available:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Insufficient exchange balance: margin {margin} USDT "
                        f"> available {available} USDT on {exchange_id}"
                    ),
                )
        except HTTPException:
            raise
        except Exception:
            # Balance fetch failed (e.g. wrong credentials) — proceed without blocking
            pass

    worker = StrategyWorker(
        user_id=current_user.id,
        strategy_id=payload.strategy_id,
        margin=margin,
        exchange_id=exchange_id,
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

    # Force-close all open trades under this worker
    open_trades = (
        db.query(StrategyTrade)
        .filter(
            StrategyTrade.worker_id == worker.id,
            StrategyTrade.status == TradeStatus.OPEN,
        )
        .all()
    )
    for trade in open_trades:
        trade.status = TradeStatus.CLOSED

    worker.status = WorkerStatus.STOPPED
    worker.stopped_at = datetime.utcnow()
    db.commit()
    db.refresh(worker)

    closed_count = len(open_trades)
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
