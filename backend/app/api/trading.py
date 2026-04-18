"""
Trading API (MACD D1 — user-facing)
=====================================

Design
------
* Admin creates predefined ``AdminStrategy`` records via /admin/strategies.
* Users browse active strategies via GET /trading/strategies.
* Users launch a trade by providing only:
    - strategy_id  — which admin-defined strategy to use
    - margin       — how much USDT to risk (validated ≤ wallet balance)
* All other parameters (leverage, rr_ratio, symbol, exchange) come from the
  AdminStrategy record or the user's connected exchange — nothing is
  hardcoded.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.exchange import UserExchange
from app.models.strategy import AdminStrategy
from app.models.subscription import Subscription
from app.models.trade import StrategyTrade
from app.models.user import User
from app.models.wallet import Wallet
from app.schemas.strategy import AdminStrategyResponse
from app.schemas.trade import (
    MACDSignalResponse,
    MACDTradeClose,
    MACDTradeLaunchRequest,
    StrategyTradeResponse,
)
from app.services.exchange import exchange_service
from app.services.macd_strategy import (
    calculate_stop_loss,
    calculate_take_profit,
    check_daily_trade_status,
    get_macd_signal,
)

router = APIRouter(prefix="/trading", tags=["trading"])


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


def _get_strategy_or_404(strategy_id: int, db: Session) -> AdminStrategy:
    strategy = (
        db.query(AdminStrategy)
        .filter(AdminStrategy.id == strategy_id, AdminStrategy.is_active)
        .first()
    )
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return strategy


def _resolve_exchange_id(user_id: int, db: Session) -> str:
    """
    Return the exchange_id to record on the trade.

    Preference order:
    1. The user's default connected exchange.
    2. Any connected exchange (first by created_at).
    3. Falls back to "okx" if the user has not connected any exchange yet.
    """
    exc = (
        db.query(UserExchange)
        .filter(UserExchange.user_id == user_id)
        .order_by(UserExchange.is_default.desc(), UserExchange.created_at.asc())
        .first()
    )
    return exc.exchange_id if exc else "okx"


# ---------------------------------------------------------------------------
# Public strategy listing (users browse available strategies)
# ---------------------------------------------------------------------------

@router.get("/strategies", response_model=List[AdminStrategyResponse])
def list_active_strategies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all active strategy templates that users can trade."""
    return (
        db.query(AdminStrategy)
        .filter(AdminStrategy.is_active)
        .order_by(AdminStrategy.id.asc())
        .all()
    )


# ---------------------------------------------------------------------------
# MACD signal (live + worker cache)
# ---------------------------------------------------------------------------

@router.get("/signal/{strategy_id}", response_model=MACDSignalResponse)
def get_signal(
    strategy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the latest D1 MACD signal for a strategy's symbol.

    Served from the market-listener worker cache when available;
    falls back to a live exchange fetch otherwise.
    """
    from app.workers.market_listener import LATEST_SIGNALS

    strategy = _get_strategy_or_404(strategy_id, db)

    signal = LATEST_SIGNALS.get(strategy.symbol)
    if signal is None:
        try:
            exchange = exchange_service.get_default_exchange()
            ohlcv = exchange.fetch_ohlcv(strategy.symbol, timeframe="1d", limit=60)
            closes = [candle[4] for candle in ohlcv]
            signal = get_macd_signal(closes) if len(closes) >= 35 else None
        except Exception:
            signal = None

    today = date.today()
    today_trades = (
        db.query(StrategyTrade)
        .filter(
            StrategyTrade.user_id == current_user.id,
            StrategyTrade.strategy_id == strategy_id,
            StrategyTrade.trade_date == today,
        )
        .order_by(StrategyTrade.created_at.asc())
        .all()
    )
    daily_status = check_daily_trade_status([t.status for t in today_trades])

    return MACDSignalResponse(
        symbol=strategy.symbol,
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
# Launch a trade — user supplies only margin; all params from AdminStrategy
# ---------------------------------------------------------------------------

@router.post("/launch", response_model=StrategyTradeResponse, status_code=status.HTTP_201_CREATED)
def launch_trade(
    payload: MACDTradeLaunchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Open a MACD D1 long trade.

    The user only provides:
    - strategy_id  — which admin strategy to trade
    - margin       — USDT margin to risk (must be ≤ wallet balance)
    - entry_price  — the current mark/last price to compute TP and SL

    All other parameters (leverage, rr_ratio, daily limits, symbol) come from
    the AdminStrategy record, not from user input.
    """
    _get_active_subscription_or_403(current_user, db)
    strategy = _get_strategy_or_404(payload.strategy_id, db)

    # --- Validate margin against wallet balance ---
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    available = Decimal(str(wallet.balance)) if wallet else Decimal("0")
    margin = Decimal(str(payload.margin))
    if margin <= Decimal("0"):
        raise HTTPException(status_code=400, detail="Margin must be positive")
    if margin > available:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Margin {margin} exceeds available {available} USDT",
        )

    # --- Enforce daily trade limits ---
    today = date.today()
    today_trades = (
        db.query(StrategyTrade)
        .filter(
            StrategyTrade.user_id == current_user.id,
            StrategyTrade.strategy_id == payload.strategy_id,
            StrategyTrade.trade_date == today,
        )
        .order_by(StrategyTrade.created_at.asc())
        .all()
    )
    daily_status = check_daily_trade_status([t.status for t in today_trades])

    if not daily_status.can_open_trade:
        raise HTTPException(status_code=400, detail=daily_status.reason)

    # --- Enforce daily margin cap if set by admin ---
    if strategy.max_daily_margin_usd > 0:
        used_today = sum(
            Decimal(str(t.details.get("margin", 0))) for t in today_trades
        )
        if (used_today + margin) > Decimal(str(strategy.max_daily_margin_usd)):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Daily margin cap of ${strategy.max_daily_margin_usd} would be exceeded. "
                    f"Already used: ${used_today}"
                ),
            )

    entry_number = daily_status.next_entry_number
    timeframe = "d1" if entry_number == 1 else "15m"

    leverage = strategy.leverage
    rr_ratio = strategy.rr_ratio
    margin_float = float(margin)

    tp = calculate_take_profit(
        entry_price=payload.entry_price,
        margin=margin_float,
        leverage=leverage,
        rr_ratio=rr_ratio,
    )
    sl = calculate_stop_loss(
        entry_price=payload.entry_price,
        margin=margin_float,
        leverage=leverage,
    )

    # Resolve exchange from user's connected accounts
    exchange_id = _resolve_exchange_id(current_user.id, db)

    trade = StrategyTrade(
        user_id=current_user.id,
        strategy_id=payload.strategy_id,
        strategy_type="macd",
        symbol=strategy.symbol,
        exchange=exchange_id,
        status="open",
        trade_date=today,
        details={
            "timeframe": timeframe,
            "entry_number": entry_number,
            "entry_price": str(payload.entry_price),
            "take_profit_price": str(tp),
            "stop_loss_price": str(sl),
            "margin": str(margin),
            "leverage": leverage,
            "rr_ratio": rr_ratio,
        },
    )
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade


# ---------------------------------------------------------------------------
# Close a trade manually
# ---------------------------------------------------------------------------

@router.post("/close/{trade_id}", response_model=StrategyTradeResponse)
def close_trade(
    trade_id: int,
    payload: MACDTradeClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Close an open MACD trade and record the result ('win' or 'loss')."""
    if payload.result not in ("win", "loss"):
        raise HTTPException(status_code=400, detail="result must be 'win' or 'loss'")

    trade = (
        db.query(StrategyTrade)
        .filter(
            StrategyTrade.id == trade_id,
            StrategyTrade.user_id == current_user.id,
            StrategyTrade.strategy_type == "macd",
        )
        .first()
    )
    if trade is None:
        raise HTTPException(status_code=404, detail="Trade not found")
    if trade.status != "open":
        raise HTTPException(status_code=400, detail="Trade is already closed")

    trade.status = payload.result
    db.commit()
    db.refresh(trade)
    return trade


# ---------------------------------------------------------------------------
# Trade history
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
