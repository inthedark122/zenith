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
def deposit_address(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return this user's unique USDT (ERC-20) deposit address.

    Each user has a distinct address derived from the server's HD wallet seed,
    so incoming payments can be attributed automatically without the user
    having to submit a transaction hash.  The blockchain listener worker
    monitors all user addresses and credits balances once transfers are
    confirmed on-chain.
    """
    try:
        address = wallet_service.get_user_deposit_address(current_user.id, db)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"address": address, "currency": "USDT", "network": "ERC-20"}


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def submit_deposit(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Pre-register a deposit by submitting its on-chain tx hash.

    The transaction is recorded as *pending* and will be confirmed (and the
    wallet balance updated) only after the blockchain listener worker verifies
    the transfer on-chain.  This endpoint intentionally does NOT credit the
    balance immediately.
    """
    tx = wallet_service.submit_pending_deposit(
        current_user.id, payload.amount, db, tx_hash=payload.tx_hash
    )
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

