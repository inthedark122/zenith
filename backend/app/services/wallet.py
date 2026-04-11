"""
Wallet service – manages USDT balances and deposit/debit operations.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.wallet import Transaction, Wallet


def get_or_create_wallet(user_id: int, db: Session) -> Wallet:
    """Return the user's USDT wallet, creating it if it doesn't yet exist."""
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if wallet is None:
        wallet = Wallet(user_id=user_id, currency="USDT", balance=Decimal("0"))
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


def credit_wallet(
    user_id: int,
    amount: Decimal,
    db: Session,
    tx_hash: Optional[str] = None,
) -> Transaction:
    """
    Credit `amount` USDT to the user's wallet (e.g. on confirmed on-chain deposit).
    Creates a 'deposit' transaction record and updates the balance.
    """
    wallet = get_or_create_wallet(user_id, db)
    wallet.balance = Decimal(str(wallet.balance)) + amount
    wallet.updated_at = datetime.utcnow()

    tx = Transaction(
        wallet_id=wallet.id,
        tx_hash=tx_hash,
        amount=amount,
        type="deposit",
        status="confirmed",
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def debit_wallet(user_id: int, amount: Decimal, db: Session) -> Transaction:
    """
    Debit `amount` USDT from the user's wallet (e.g. for subscription payment).
    Raises 402 if the balance is insufficient.
    """
    wallet = get_or_create_wallet(user_id, db)
    current_balance = Decimal(str(wallet.balance))
    if current_balance < amount:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient balance. Required: {amount}, Available: {current_balance}",
        )

    wallet.balance = current_balance - amount
    wallet.updated_at = datetime.utcnow()

    tx = Transaction(
        wallet_id=wallet.id,
        amount=amount,
        type="subscription",
        status="confirmed",
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def get_deposit_address() -> str:
    """Return the server's configured USDT (TRC-20/ERC-20) deposit address."""
    address = settings.USDT_DEPOSIT_ADDRESS
    if not address:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Deposit address not configured",
        )
    return address
