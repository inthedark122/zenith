"""
Admin API — strategy management.

Only users with ``is_admin=True`` can access these endpoints.
Admins create and manage predefined strategy templates that regular users
can select when launching trades via the /trading/launch endpoint.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin, get_db
from app.models.strategy import AdminStrategy
from app.models.user import User
from app.schemas.strategy import AdminStrategyCreate, AdminStrategyResponse, AdminStrategyUpdate

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/strategies", response_model=List[AdminStrategyResponse])
def list_strategies(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """List all strategy templates (active and inactive)."""
    return db.query(AdminStrategy).order_by(AdminStrategy.id.asc()).all()


@router.post("/strategies", response_model=AdminStrategyResponse, status_code=status.HTTP_201_CREATED)
def create_strategy(
    payload: AdminStrategyCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Create a new predefined strategy template."""
    strategy = AdminStrategy(**payload.model_dump())
    db.add(strategy)
    db.commit()
    db.refresh(strategy)
    return strategy


@router.put("/strategies/{strategy_id}", response_model=AdminStrategyResponse)
def update_strategy(
    strategy_id: int,
    payload: AdminStrategyUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Update an existing strategy template."""
    strategy = db.query(AdminStrategy).filter(AdminStrategy.id == strategy_id).first()
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
    strategy = db.query(AdminStrategy).filter(AdminStrategy.id == strategy_id).first()
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    db.delete(strategy)
    db.commit()
