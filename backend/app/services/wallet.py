"""
Wallet service – manages USDT balances and deposit/debit operations.

Deposit flow
------------
1.  User calls GET /wallet/deposit-address → receives their unique on-chain address.
2.  User sends USDT (ERC-20) to that address.
3.  The blockchain listener worker (workers/blockchain_listener.py) detects the
    transfer on-chain and calls `confirm_deposit` with the tx hash and amount.
4.  Only confirmed on-chain transactions update the balance — the HTTP endpoint
    `/wallet/transactions` is intentionally NOT trusted and only creates a
    pending record that the worker must confirm.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.wallet import Transaction, Wallet
from app.services.deposit_address import derive_deposit_address


def get_or_create_wallet(user_id: int, db: Session) -> Wallet:
    """Return the user's USDT wallet, creating it (with a unique deposit address) if needed."""
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if wallet is None:
        # Derive a unique on-chain deposit address for this user
        try:
            addr = derive_deposit_address(user_id)
        except RuntimeError:
            addr = None  # HD_WALLET_SEED not configured yet — address will be set later

        wallet = Wallet(
            user_id=user_id,
            currency="USDT",
            balance=Decimal("0"),
            deposit_address=addr,
        )
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


def get_user_deposit_address(user_id: int, db: Session) -> str:
    """
    Return the user's unique USDT deposit address.

    If the wallet already has an address assigned it is returned directly.
    Otherwise a fresh address is derived and persisted.
    """
    wallet = get_or_create_wallet(user_id, db)
    if not wallet.deposit_address:
        wallet.deposit_address = derive_deposit_address(user_id)
        db.commit()
        db.refresh(wallet)
    return wallet.deposit_address


def submit_pending_deposit(
    user_id: int,
    amount: Decimal,
    db: Session,
    tx_hash: Optional[str] = None,
) -> Transaction:
    """
    Record a user-submitted deposit as *pending*.

    The balance is NOT credited here.  The blockchain listener worker will
    call `confirm_deposit` once it verifies the transaction on-chain.
    """
    wallet = get_or_create_wallet(user_id, db)

    # Prevent duplicate tx_hash submissions
    if tx_hash:
        existing = db.query(Transaction).filter(Transaction.tx_hash == tx_hash).first()
        if existing:
            raise HTTPException(status_code=400, detail="Transaction already submitted")

    if amount <= Decimal("0"):
        raise HTTPException(status_code=400, detail="Amount must be positive")

    tx = Transaction(
        wallet_id=wallet.id,
        tx_hash=tx_hash,
        amount=amount,
        type="deposit",
        status="pending",
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def confirm_deposit(
    tx_hash: str,
    amount: Decimal,
    deposit_address: str,
    db: Session,
) -> Optional[Transaction]:
    """
    Called by the blockchain listener worker when it detects an on-chain
    USDT transfer to a user's deposit address.

    Looks up the wallet by ``deposit_address``, credits the balance, and
    marks any matching pending transaction as confirmed.  If no pending record
    exists a new confirmed transaction is created (covers the case where the
    user didn't pre-submit the hash).

    Returns the Transaction record, or None if the address is unknown.
    """
    # Find the wallet that owns this deposit address
    wallet = db.query(Wallet).filter(Wallet.deposit_address == deposit_address).first()
    if wallet is None:
        return None  # address not managed by us — ignore

    # Idempotency: skip if already confirmed
    already = (
        db.query(Transaction)
        .filter(Transaction.tx_hash == tx_hash, Transaction.status == "confirmed")
        .first()
    )
    if already:
        return already

    # Credit the balance
    wallet.balance = Decimal(str(wallet.balance)) + amount
    wallet.updated_at = datetime.utcnow()

    # Update existing pending record or create a new confirmed one
    tx = db.query(Transaction).filter(Transaction.tx_hash == tx_hash).first()
    if tx:
        tx.status = "confirmed"
        tx.amount = amount  # authoritative amount from chain, not user-submitted
    else:
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


def credit_wallet(
    user_id: int,
    amount: Decimal,
    db: Session,
    tx_hash: Optional[str] = None,
) -> Transaction:
    """
    Directly credit ``amount`` USDT to the user's wallet (e.g. test/admin use).
    For regular on-chain deposits use confirm_deposit instead.
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

