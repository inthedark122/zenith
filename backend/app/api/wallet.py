from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.models.wallet import Transaction, Wallet
from app.schemas.wallet import TransactionCreate, TransactionResponse, WalletResponse
from app.services import wallet as wallet_service

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("", response_model=WalletResponse)
def get_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return wallet_service.get_or_create_wallet(current_user.id, db)


@router.get("/deposit-address")
def deposit_address(current_user: User = Depends(get_current_user)):
    return {"address": wallet_service.get_deposit_address(), "currency": "USDT", "network": "TRC-20"}


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def submit_deposit(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Prevent duplicate submissions for the same tx_hash
    existing = db.query(Transaction).filter(Transaction.tx_hash == payload.tx_hash).first()
    if existing:
        raise HTTPException(status_code=400, detail="Transaction already submitted")

    if payload.amount <= Decimal("0"):
        raise HTTPException(status_code=400, detail="Amount must be positive")

    tx = wallet_service.credit_wallet(current_user.id, payload.amount, db, tx_hash=payload.tx_hash)
    return tx


@router.get("/transactions", response_model=List[TransactionResponse])
def list_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wallet = wallet_service.get_or_create_wallet(current_user.id, db)
    return (
        db.query(Transaction)
        .filter(Transaction.wallet_id == wallet.id)
        .order_by(Transaction.created_at.desc())
        .all()
    )
