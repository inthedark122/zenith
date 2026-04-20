from typing import List

import ccxt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_admin, get_db
from app.models.backtest import StrategyBacktestRun
from app.models.strategy import Strategy
from app.models.user import User
from app.schemas.strategy import (
    StrategyBacktestRequest,
    StrategyBacktestRunResponse,
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
    return (
        db.query(Strategy)
        .options(selectinload(Strategy.backtest_runs))
        .order_by(Strategy.id.asc())
        .all()
    )


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
    strategy = (
        db.query(Strategy)
        .options(selectinload(Strategy.backtest_runs))
        .filter(Strategy.id == strategy_id)
        .first()
    )
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


@router.get("/strategies/{strategy_id}/backtests", response_model=List[StrategyBacktestRunResponse])
def list_backtests(
    strategy_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    strategy = db.query(Strategy).filter(Strategy.id == strategy_id).first()
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")

    return (
        db.query(StrategyBacktestRun)
        .options(selectinload(StrategyBacktestRun.strategy_template))
        .filter(StrategyBacktestRun.strategy_id == strategy_id)
        .order_by(StrategyBacktestRun.generated_at.desc(), StrategyBacktestRun.id.desc())
        .all()
    )


@router.post("/strategies/{strategy_id}/backtest", response_model=StrategyBacktestRunResponse)
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
        backtest_run = StrategyBacktestRun(
            strategy_id=strategy.id,
            **run_strategy_backtest(
                strategy,
                lookback_days=payload.lookback_days,
                margin_per_trade=payload.margin_per_trade,
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ccxt.BaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Backtest failed: {exc}",
        )

    backtest_run.strategy_template = strategy
    db.add(backtest_run)
    db.commit()
    db.refresh(backtest_run)
    return backtest_run


class BacktestPublishPayload(BaseModel):
    is_public: bool


@router.patch(
    "/strategies/{strategy_id}/backtests/{backtest_id}",
    response_model=StrategyBacktestRunResponse,
)
def patch_backtest(
    strategy_id: int,
    backtest_id: int,
    payload: BacktestPublishPayload,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Toggle is_public (or any future patch field) on a specific backtest run."""
    run = (
        db.query(StrategyBacktestRun)
        .options(selectinload(StrategyBacktestRun.strategy_template))
        .filter(
            StrategyBacktestRun.id == backtest_id,
            StrategyBacktestRun.strategy_id == strategy_id,
        )
        .first()
    )
    if run is None:
        raise HTTPException(status_code=404, detail="Backtest run not found")
    run.is_public = payload.is_public
    db.commit()
    db.refresh(run)
    return run
