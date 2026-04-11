"""
MLM (Multi-Level Marketing) commission service.

Commission rates:
  Level 1 referrer (direct):          50%
  Level 2 referrer (referrer's referrer): 30%
  Level 3 referrer:                    20%
"""
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.referral import CommissionPayment, Referral
from app.models.user import User
from app.models.wallet import Transaction, Wallet

LEVEL_RATES: Dict[int, Decimal] = {
    1: Decimal("0.50"),
    2: Decimal("0.30"),
    3: Decimal("0.20"),
}


def get_referral_chain(user_id: int, db: Session) -> List[Tuple[int, int]]:
    """
    Walk up the referrer chain from `user_id` up to 3 levels.

    Returns a list of (referrer_user_id, level) tuples, e.g.:
        [(level1_id, 1), (level2_id, 2), (level3_id, 3)]
    """
    chain: List[Tuple[int, int]] = []
    current_id = user_id
    for level in range(1, 4):
        user = db.query(User).filter(User.id == current_id).first()
        if user is None or user.referred_by is None:
            break
        chain.append((user.referred_by, level))
        current_id = user.referred_by
    return chain


def calculate_commissions(
    subscription_price: Decimal,
    chain: List[Tuple[int, int]],
) -> Dict[int, Decimal]:
    """
    Given the subscription price and the referral chain, return a mapping of
    {referrer_user_id: commission_amount}.
    """
    result: Dict[int, Decimal] = {}
    for referrer_id, level in chain:
        rate = LEVEL_RATES.get(level, Decimal("0"))
        commission = (subscription_price * rate).quantize(Decimal("0.01"))
        result[referrer_id] = commission
    return result


def _get_or_create_wallet(user_id: int, db: Session) -> Wallet:
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if wallet is None:
        wallet = Wallet(user_id=user_id, currency="USDT", balance=Decimal("0"))
        db.add(wallet)
        db.flush()
    return wallet


def _get_or_create_referral(
    referrer_id: int, referred_id: int, level: int, db: Session
) -> Referral:
    referral = (
        db.query(Referral)
        .filter(Referral.referred_id == referred_id, Referral.referrer_id == referrer_id)
        .first()
    )
    if referral is None:
        referral = Referral(
            referrer_id=referrer_id,
            referred_id=referred_id,
            level=level,
            commission_rate=LEVEL_RATES[level],
            commission_earned=Decimal("0"),
        )
        db.add(referral)
        db.flush()
    return referral


def distribute_commissions(
    user_id: int,
    subscription_id: int,
    subscription_price: Decimal,
    db: Session,
) -> List[CommissionPayment]:
    """
    Calculate and distribute MLM commissions for a newly activated subscription.

    - Creates/updates Referral records.
    - Credits each referrer's wallet.
    - Records CommissionPayment entries.

    Returns the list of CommissionPayment records created.
    """
    chain = get_referral_chain(user_id, db)
    commissions = calculate_commissions(subscription_price, chain)

    payments: List[CommissionPayment] = []
    for (referrer_id, level), commission_amount in zip(chain, commissions.values()):
        if commission_amount <= 0:
            continue

        referral = _get_or_create_referral(referrer_id, user_id, level, db)
        referral.commission_earned = (
            Decimal(str(referral.commission_earned)) + commission_amount
        )

        wallet = _get_or_create_wallet(referrer_id, db)
        wallet.balance = Decimal(str(wallet.balance)) + commission_amount

        tx = Transaction(
            wallet_id=wallet.id,
            amount=commission_amount,
            type="commission",
            status="confirmed",
        )
        db.add(tx)

        payment = CommissionPayment(
            referral_id=referral.id,
            subscription_id=subscription_id,
            amount=commission_amount,
        )
        db.add(payment)
        payments.append(payment)

    db.commit()
    return payments
