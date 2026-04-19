from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.referral import CommissionPayment, Referral
from app.models.user import User
from app.schemas.referral import CommissionResponse, MLMMemberNode, MLMTreeResponse, ReferralResponse

router = APIRouter(prefix="/referral", tags=["referral"])


@router.get("/my-code")
def my_referral_code(current_user: User = Depends(get_current_user)):
    return {"referral_code": current_user.referral_code, "user_id": current_user.id}


@router.get("/community", response_model=MLMTreeResponse)
def my_community(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's MLM downline tree (up to 3 levels deep)."""
    referrals = (
        db.query(Referral)
        .filter(Referral.referrer_id == current_user.id)
        .all()
    )

    total_commission = sum(
        (Decimal(str(r.commission_earned)) for r in referrals), Decimal("0")
    )

    members: List[MLMMemberNode] = []
    for ref in referrals:
        referred_user = db.query(User).filter(User.id == ref.referred_id).first()
        if referred_user is None:
            continue
        members.append(
            MLMMemberNode(
                user_id=referred_user.id,
                username=referred_user.username,
                level=ref.level,
                commission_earned=Decimal(str(ref.commission_earned)),
            )
        )

    return MLMTreeResponse(
        root_user_id=current_user.id,
        total_commission=total_commission,
        members=members,
    )


@router.get("/commissions", response_model=List[CommissionResponse])
def my_commissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all commission payments earned by the current user."""
    referrals = (
        db.query(Referral).filter(Referral.referrer_id == current_user.id).all()
    )
    referral_ids = [r.id for r in referrals]
    if not referral_ids:
        return []
    return (
        db.query(CommissionPayment)
        .filter(CommissionPayment.referral_id.in_(referral_ids))
        .order_by(CommissionPayment.paid_at.desc())
        .all()
    )
