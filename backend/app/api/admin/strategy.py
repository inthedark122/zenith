"""Admin API — strategy management and backtesting."""
from datetime import datetime
from typing import List

import ccxt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin, get_db
from app.models.strategy import Strategy
from app.models.user import User
from app.schemas.strategy import (
    StrategyBacktestRequest,
    StrategyCreate,
    StrategyResponse,
    StrategyUpdate,
)
from app.services.backtesting import run_strategy_backtest

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/strategies", response_model=List[StrategyResponse])
def list_strategies(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """List all strategy templates (active and inactive)."""
    return db.query(Strategy).order_by(Strategy.id.asc()).all()


@router.post("/strategies", response_model=StrategyResponse, status_code=status.HTTP_201_CREATED)
def create_strategy(
    payload: StrategyCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Create a new predefined strategy template."""
    strategy = Strategy(**payload.model_dump())
    db.add(strategy)
    db.commit()
    db.refresh(strategy)
    return strategy


@router.put("/strategies/{strategy_id}", response_model=StrategyResponse)
def update_strategy(
    strategy_id: int,
    payload: StrategyUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Update an existing strategy template."""
    strategy = db.query(Strategy).filter(Strategy.id == strategy_id).first()
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(strategy, field, value)

    db.commit()
    db.refresh(strategy)
    return strategy


@router.delete("/strategies/{strategy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_strategy(
    strategy_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Delete a strategy template."""
    strategy = db.query(Strategy).filter(Strategy.id == strategy_id).first()
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    db.delete(strategy)
    db.commit()


@router.post("/strategies/{strategy_id}/backtest", response_model=StrategyResponse)
def run_backtest(
    strategy_id: int,
    payload: StrategyBacktestRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    strategy = db.query(Strategy).filter(Strategy.id == strategy_id).first()
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")

    try:
        strategy.backtest_summary = run_strategy_backtest(
            strategy,
            lookback_days=payload.lookback_days,
            margin_per_trade=payload.margin_per_trade,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ccxt.BaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Backtest failed: {exc}",
        )

    strategy.backtest_updated_at = datetime.utcnow()
    db.commit()
    db.refresh(strategy)
    return strategy
