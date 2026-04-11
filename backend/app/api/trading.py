from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.subscription import Subscription
from app.models.trade import DCAConfig, Trade
from app.models.user import User
from app.schemas.trade import DCAConfigCreate, DCAConfigResponse, TradeResponse
from app.services.dca_strategy import calculate_dca_orders
from app.services.exchange import exchange_service

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


@router.post("/dca-configs", response_model=DCAConfigResponse, status_code=status.HTTP_201_CREATED)
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

    config = DCAConfig(
        user_id=current_user.id,
        symbol=payload.symbol,
        base_amount=payload.base_amount,
        safety_order_multiplier=payload.safety_order_multiplier,
        price_deviation=payload.price_deviation,
        max_safety_orders=payload.max_safety_orders,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.get("/dca-configs", response_model=List[DCAConfigResponse])
def list_dca_configs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(DCAConfig).filter(DCAConfig.user_id == current_user.id).all()


@router.put("/dca-configs/{config_id}", response_model=DCAConfigResponse)
def update_dca_config(
    config_id: int,
    payload: DCAConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = (
        db.query(DCAConfig)
        .filter(DCAConfig.id == config_id, DCAConfig.user_id == current_user.id)
        .first()
    )
    if config is None:
        raise HTTPException(status_code=404, detail="DCA config not found")
    if config.is_active:
        raise HTTPException(status_code=400, detail="Cannot update a running bot; stop it first")

    config.symbol = payload.symbol
    config.base_amount = payload.base_amount
    config.safety_order_multiplier = payload.safety_order_multiplier
    config.price_deviation = payload.price_deviation
    config.max_safety_orders = payload.max_safety_orders
    db.commit()
    db.refresh(config)
    return config


@router.post("/start/{config_id}", response_model=TradeResponse)
def start_bot(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_has_active_subscription(current_user, db)
    config = (
        db.query(DCAConfig)
        .filter(DCAConfig.id == config_id, DCAConfig.user_id == current_user.id)
        .first()
    )
    if config is None:
        raise HTTPException(status_code=404, detail="DCA config not found")
    if config.is_active:
        raise HTTPException(status_code=400, detail="Bot is already running")

    # Compute the DCA order ladder for informational purposes
    try:
        exchange = exchange_service.get_default_exchange()
        ticker = exchange_service.get_ticker(exchange, config.symbol)
        current_price = ticker["last"]
    except Exception:
        current_price = 0.0  # graceful degradation when exchange creds not set

    orders = calculate_dca_orders(
        base_amount=float(config.base_amount),
        current_price=current_price,
        multiplier=config.safety_order_multiplier,
        deviation=config.price_deviation,
        max_orders=config.max_safety_orders,
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

    trade = Trade(
        user_id=current_user.id,
        symbol=config.symbol,
        exchange="okx",
        strategy="dca",
        status="active",
        base_order_amount=config.base_amount,
        safety_orders=safety_orders_data,
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
    config = (
        db.query(DCAConfig)
        .filter(DCAConfig.id == config_id, DCAConfig.user_id == current_user.id)
        .first()
    )
    if config is None:
        raise HTTPException(status_code=404, detail="DCA config not found")
    if not config.is_active:
        raise HTTPException(status_code=400, detail="Bot is not running")

    active_trade = (
        db.query(Trade)
        .filter(
            Trade.user_id == current_user.id,
            Trade.symbol == config.symbol,
            Trade.status == "active",
        )
        .order_by(Trade.created_at.desc())
        .first()
    )
    if active_trade:
        active_trade.status = "stopped"

    config.is_active = 0
    db.commit()
    return {"detail": f"Bot for {config.symbol} stopped"}
