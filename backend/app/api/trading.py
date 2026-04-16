from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.subscription import Subscription
from app.models.trade import MACD_ALLOWED_SYMBOLS, StrategyConfig, StrategyTrade
from app.models.user import User
from app.schemas.trade import (
    DCAConfigCreate,
    MACDConfigCreate,
    MACDSignalResponse,
    MACDTradeClose,
    MACDTradeOpen,
    StrategyConfigResponse,
    StrategyTradeResponse,
)
from app.services.dca_strategy import calculate_dca_orders
from app.services.exchange import exchange_service
from app.services.macd_strategy import (
    calculate_stop_loss,
    calculate_take_profit,
    check_daily_trade_status,
    get_macd_signal,
)

router = APIRouter(prefix="/trading", tags=["trading"])


def _assert_has_active_subscription(user: User, db: Session):
    active = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id, Subscription.status == "active")
        .first()
    )
    if active is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An active subscription is required to use trading features",
        )
    return active


def _get_config_or_404(
    config_id: int,
    strategy_type: str,
    user_id: int,
    db: Session,
) -> StrategyConfig:
    cfg = (
        db.query(StrategyConfig)
        .filter(
            StrategyConfig.id == config_id,
            StrategyConfig.strategy_type == strategy_type,
            StrategyConfig.user_id == user_id,
        )
        .first()
    )
    if cfg is None:
        raise HTTPException(status_code=404, detail=f"{strategy_type.upper()} config not found")
    return cfg


# ---------------------------------------------------------------------------
# DCA strategy endpoints
# ---------------------------------------------------------------------------

@router.post("/dca-configs", response_model=StrategyConfigResponse, status_code=status.HTTP_201_CREATED)
def create_dca_config(
    payload: DCAConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = _assert_has_active_subscription(current_user, db)
    if payload.symbol not in sub.coins:
        raise HTTPException(
            status_code=400,
            detail=f"Symbol {payload.symbol} is not in your subscription coins",
        )

    config = StrategyConfig(
        user_id=current_user.id,
        strategy_type="dca",
        symbol=payload.symbol,
        settings={
            "base_amount": str(payload.base_amount),
            "safety_order_multiplier": payload.safety_order_multiplier,
            "price_deviation": payload.price_deviation,
            "max_safety_orders": payload.max_safety_orders,
        },
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.get("/dca-configs", response_model=List[StrategyConfigResponse])
def list_dca_configs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(StrategyConfig)
        .filter(
            StrategyConfig.user_id == current_user.id,
            StrategyConfig.strategy_type == "dca",
        )
        .all()
    )


@router.put("/dca-configs/{config_id}", response_model=StrategyConfigResponse)
def update_dca_config(
    config_id: int,
    payload: DCAConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = _get_config_or_404(config_id, "dca", current_user.id, db)
    if config.is_active:
        raise HTTPException(status_code=400, detail="Cannot update a running bot; stop it first")

    config.symbol = payload.symbol
    config.settings = {
        "base_amount": str(payload.base_amount),
        "safety_order_multiplier": payload.safety_order_multiplier,
        "price_deviation": payload.price_deviation,
        "max_safety_orders": payload.max_safety_orders,
    }
    db.commit()
    db.refresh(config)
    return config


@router.post("/start/{config_id}", response_model=StrategyTradeResponse)
def start_bot(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_has_active_subscription(current_user, db)
    config = _get_config_or_404(config_id, "dca", current_user.id, db)
    if config.is_active:
        raise HTTPException(status_code=400, detail="Bot is already running")

    try:
        exchange = exchange_service.get_default_exchange()
        ticker = exchange_service.get_ticker(exchange, config.symbol)
        current_price = ticker["last"]
    except Exception:
        current_price = 0.0

    orders = calculate_dca_orders(
        base_amount=float(config.settings.get("base_amount", 0)),
        current_price=current_price,
        multiplier=config.settings.get("safety_order_multiplier", 2.0),
        deviation=config.settings.get("price_deviation", 0.04),
        max_orders=config.settings.get("max_safety_orders", 6),
    )
    safety_orders_data = [
        {
            "order_number": o.order_number,
            "amount": str(o.amount),
            "target_price": str(o.target_price),
            "total_invested": str(o.total_invested),
            "average_price": str(o.average_price),
        }
        for o in orders
    ]

    trade = StrategyTrade(
        user_id=current_user.id,
        config_id=config.id,
        strategy_type="dca",
        symbol=config.symbol,
        exchange="okx",
        status="active",
        details={
            "base_order_amount": config.settings.get("base_amount"),
            "safety_orders": safety_orders_data,
        },
    )
    db.add(trade)
    config.is_active = 1
    db.commit()
    db.refresh(trade)
    return trade


@router.post("/stop/{config_id}")
def stop_bot(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = _get_config_or_404(config_id, "dca", current_user.id, db)
    if not config.is_active:
        raise HTTPException(status_code=400, detail="Bot is not running")

    active_trade = (
        db.query(StrategyTrade)
        .filter(
            StrategyTrade.user_id == current_user.id,
            StrategyTrade.config_id == config.id,
            StrategyTrade.status == "active",
        )
        .order_by(StrategyTrade.created_at.desc())
        .first()
    )
    if active_trade:
        active_trade.status = "stopped"

    config.is_active = 0
    db.commit()
    return {"detail": f"Bot for {config.symbol} stopped"}


# ---------------------------------------------------------------------------
# MACD D1 strategy endpoints
# ---------------------------------------------------------------------------

@router.post("/macd-configs", response_model=StrategyConfigResponse, status_code=status.HTTP_201_CREATED)
def create_macd_config(
    payload: MACDConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a MACD D1 bot configuration. Only BTC/USDT, ETH/USDT, HYPE/USDT are supported."""
    _assert_has_active_subscription(current_user, db)
    if payload.symbol not in MACD_ALLOWED_SYMBOLS:
        raise HTTPException(
            status_code=400,
            detail=f"Symbol must be one of {MACD_ALLOWED_SYMBOLS}",
        )
    if payload.leverage <= 0:
        raise HTTPException(status_code=400, detail="Leverage must be positive")
    if payload.margin_per_trade <= 0:
        raise HTTPException(status_code=400, detail="Margin per trade must be positive")

    config = StrategyConfig(
        user_id=current_user.id,
        strategy_type="macd",
        symbol=payload.symbol,
        settings={
            "margin_per_trade": str(payload.margin_per_trade),
            "leverage": payload.leverage,
            "rr_ratio": payload.rr_ratio,
        },
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.get("/macd-configs", response_model=List[StrategyConfigResponse])
def list_macd_configs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all MACD D1 bot configurations for the current user."""
    return (
        db.query(StrategyConfig)
        .filter(
            StrategyConfig.user_id == current_user.id,
            StrategyConfig.strategy_type == "macd",
        )
        .all()
    )


@router.get("/macd-signal/{config_id}", response_model=MACDSignalResponse)
def get_macd_signal_for_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch current D1 MACD signal from the exchange and return it together with
    the user's daily trade status for the given config.
    """
    config = _get_config_or_404(config_id, "macd", current_user.id, db)

    try:
        exchange = exchange_service.get_default_exchange()
        ohlcv = exchange.fetch_ohlcv(config.symbol, timeframe="1d", limit=60)
        closes = [candle[4] for candle in ohlcv]
    except Exception:
        closes = []

    signal = get_macd_signal(closes) if len(closes) >= 35 else None

    today = date.today()
    today_trades = (
        db.query(StrategyTrade)
        .filter(
            StrategyTrade.user_id == current_user.id,
            StrategyTrade.config_id == config_id,
            StrategyTrade.trade_date == today,
        )
        .order_by(StrategyTrade.created_at.asc())
        .all()
    )
    daily_status = check_daily_trade_status([t.status for t in today_trades])

    return MACDSignalResponse(
        symbol=config.symbol,
        macd=round(signal.macd, 6) if signal else 0.0,
        signal=round(signal.signal, 6) if signal else 0.0,
        histogram=round(signal.histogram, 6) if signal else 0.0,
        is_bullish_crossover=signal.is_bullish_crossover if signal else False,
        is_bearish_crossover=signal.is_bearish_crossover if signal else False,
        can_open_trade=daily_status.can_open_trade,
        next_entry_number=daily_status.next_entry_number,
        daily_status_reason=daily_status.reason,
    )


@router.post("/macd-open/{config_id}", response_model=StrategyTradeResponse, status_code=status.HTTP_201_CREATED)
def open_macd_trade(
    config_id: int,
    payload: MACDTradeOpen,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Open a MACD D1 trade.

    - Entry #1 uses the D1 MACD signal timeframe.
    - Entry #2 (after a win or loss) uses the 15m correction timeframe.
    - Enforces the daily limit of 2 trades and maximum daily margin.
    """
    _assert_has_active_subscription(current_user, db)
    config = _get_config_or_404(config_id, "macd", current_user.id, db)

    today = date.today()
    today_trades = (
        db.query(StrategyTrade)
        .filter(
            StrategyTrade.user_id == current_user.id,
            StrategyTrade.config_id == config_id,
            StrategyTrade.trade_date == today,
        )
        .order_by(StrategyTrade.created_at.asc())
        .all()
    )
    daily_status = check_daily_trade_status([t.status for t in today_trades])

    if not daily_status.can_open_trade:
        raise HTTPException(status_code=400, detail=daily_status.reason)

    entry_number = daily_status.next_entry_number
    timeframe = "d1" if entry_number == 1 else "15m"

    margin = float(config.settings.get("margin_per_trade", 0))
    leverage = float(config.settings.get("leverage", 20.0))
    rr_ratio = float(config.settings.get("rr_ratio", 2.0))

    tp = calculate_take_profit(
        entry_price=payload.entry_price,
        margin=margin,
        leverage=leverage,
        rr_ratio=rr_ratio,
    )
    sl = calculate_stop_loss(
        entry_price=payload.entry_price,
        margin=margin,
        leverage=leverage,
    )

    trade = StrategyTrade(
        user_id=current_user.id,
        config_id=config.id,
        strategy_type="macd",
        symbol=config.symbol,
        exchange="okx",
        status="open",
        trade_date=today,
        details={
            "timeframe": timeframe,
            "entry_number": entry_number,
            "entry_price": str(payload.entry_price),
            "take_profit_price": str(tp),
            "stop_loss_price": str(sl),
            "margin": config.settings.get("margin_per_trade"),
            "leverage": leverage,
        },
    )
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade


@router.post("/macd-close/{trade_id}", response_model=StrategyTradeResponse)
def close_macd_trade(
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
        raise HTTPException(status_code=404, detail="MACD trade not found")
    if trade.status != "open":
        raise HTTPException(status_code=400, detail="Trade is already closed")

    trade.status = payload.result
    db.commit()
    db.refresh(trade)
    return trade


@router.get("/macd-trades", response_model=List[StrategyTradeResponse])
def list_macd_trades(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all MACD trades for the current user, most recent first."""
    return (
        db.query(StrategyTrade)
        .filter(
            StrategyTrade.user_id == current_user.id,
            StrategyTrade.strategy_type == "macd",
        )
        .order_by(StrategyTrade.created_at.desc())
        .all()
    )
