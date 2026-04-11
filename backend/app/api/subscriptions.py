from datetime import datetime, timedelta
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.subscription import (
    PLAN_PRICES,
    SubscriptionCreate,
    SubscriptionResponse,
)
from app.services import mlm as mlm_service
from app.services import wallet as wallet_service

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

SUBSCRIPTION_DURATION_DAYS = 30


@router.get("/plans")
def list_plans():
    return [
        {"plan": 1, "coins": 1, "price": 15, "description": "1 trading coin"},
        {"plan": 2, "coins": 2, "price": 20, "description": "2 trading coins"},
        {"plan": 3, "coins": 3, "price": 25, "description": "3 trading coins"},
    ]


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def create_subscription(
    payload: SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    active = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == current_user.id,
            Subscription.status == "active",
        )
        .first()
    )
    if active:
        raise HTTPException(status_code=400, detail="You already have an active subscription")

    price = PLAN_PRICES[payload.plan]
    wallet_service.debit_wallet(current_user.id, price, db)

    now = datetime.utcnow()
    sub = Subscription(
        user_id=current_user.id,
        plan=int(payload.plan),
        price=price,
        status="active",
        started_at=now,
        expires_at=now + timedelta(days=SUBSCRIPTION_DURATION_DAYS),
        coins=payload.coins,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    # Distribute MLM commissions
    mlm_service.distribute_commissions(current_user.id, sub.id, price, db)

    return sub


@router.get("/me", response_model=List[SubscriptionResponse])
def my_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
        .all()
    )


@router.delete("/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = (
        db.query(Subscription)
        .filter(Subscription.id == subscription_id, Subscription.user_id == current_user.id)
        .first()
    )
    if sub is None:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.status = "expired"
    db.commit()
