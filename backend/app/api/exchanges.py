from typing import List

import ccxt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.exchange import SUPPORTED_EXCHANGES, UserExchange
from app.models.user import User
from app.schemas.exchange import (
    ExchangeBalanceResponse,
    ExchangeAccountBalance,
    UserExchangeCreate,
    UserExchangeResponse,
    UserExchangeUpdate,
)

router = APIRouter(prefix="/exchanges", tags=["exchanges"])


@router.get("/supported")
def list_supported_exchanges():
    """Return the list of exchange IDs that users may connect."""
    return {"exchanges": SUPPORTED_EXCHANGES}


@router.get("", response_model=List[UserExchangeResponse])
def list_user_exchanges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all exchange connections for the current user."""
    return (
        db.query(UserExchange)
        .filter(UserExchange.user_id == current_user.id)
        .order_by(UserExchange.created_at.asc())
        .all()
    )


@router.post("", response_model=UserExchangeResponse, status_code=status.HTTP_201_CREATED)
def add_exchange(
    payload: UserExchangeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Connect a new exchange to the current user's account."""
    # Check for duplicate (user_id, exchange_id) — one connection per exchange
    existing = (
        db.query(UserExchange)
        .filter(
            UserExchange.user_id == current_user.id,
            UserExchange.exchange_id == payload.exchange_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Exchange '{payload.exchange_id}' is already connected. Use PUT to update.",
        )

    # If this is the first exchange or is_default=True, ensure it becomes default
    existing_count = (
        db.query(UserExchange)
        .filter(UserExchange.user_id == current_user.id)
        .count()
    )
    is_default = payload.is_default or (existing_count == 0)

    if is_default:
        # Clear any existing default
        db.query(UserExchange).filter(
            UserExchange.user_id == current_user.id,
            UserExchange.is_default == True,  # noqa: E712
        ).update({"is_default": False})

    exc = UserExchange(
        user_id=current_user.id,
        exchange_id=payload.exchange_id,
        label=payload.label,
        api_key=payload.api_key,
        api_secret=payload.api_secret,
        passphrase=payload.passphrase,
        is_default=is_default,
    )
    db.add(exc)
    db.commit()
    db.refresh(exc)
    return exc


@router.get("/{exchange_id}/balance", response_model=ExchangeBalanceResponse)
def get_exchange_balance(
    exchange_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch live USDT balance from the connected exchange account."""
    exc = (
        db.query(UserExchange)
        .filter(
            UserExchange.user_id == current_user.id,
            UserExchange.exchange_id == exchange_id,
        )
        .first()
    )
    if exc is None:
        raise HTTPException(status_code=404, detail="Exchange connection not found")

    exchange_cls = getattr(ccxt, exchange_id, None)
    if exchange_cls is None:
        raise HTTPException(status_code=400, detail=f"Unsupported exchange: {exchange_id}")

    try:
        client = exchange_cls({
            "enableRateLimit": True,
            "apiKey": exc.api_key,
            "secret": exc.api_secret,
            "password": exc.passphrase or "",
        })

        # OKX uses a single unified Trading account for spot + derivatives
        if exchange_id == "okx":
            raw = client.fetch_balance({"type": "trading"})
            free = float(raw.get("free", {}).get("USDT", 0.0))
            total = float(raw.get("total", {}).get("USDT", 0.0))
            accounts = [ExchangeAccountBalance(label="Trading", usdt_free=free, usdt_total=total)]
        else:
            raw = client.fetch_balance()
            free = float(raw.get("free", {}).get("USDT", 0.0))
            total = float(raw.get("total", {}).get("USDT", 0.0))
            accounts = [ExchangeAccountBalance(label="Spot", usdt_free=free, usdt_total=total)]

        return ExchangeBalanceResponse(accounts=accounts)

    except Exception as exc_err:
        return ExchangeBalanceResponse(accounts=[], error=str(exc_err))


@router.put("/{exchange_id}", response_model=UserExchangeResponse)
def update_exchange(
    exchange_id: str,
    payload: UserExchangeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update credentials or settings for a connected exchange."""
    exc = (
        db.query(UserExchange)
        .filter(
            UserExchange.user_id == current_user.id,
            UserExchange.exchange_id == exchange_id,
        )
        .first()
    )
    if exc is None:
        raise HTTPException(status_code=404, detail="Exchange connection not found")

    if payload.label is not None:
        exc.label = payload.label
    if payload.api_key is not None:
        exc.api_key = payload.api_key
    if payload.api_secret is not None:
        exc.api_secret = payload.api_secret
    if payload.passphrase is not None:
        exc.passphrase = payload.passphrase
    if payload.is_default is True:
        # Clear other defaults first
        db.query(UserExchange).filter(
            UserExchange.user_id == current_user.id,
            UserExchange.is_default == True,  # noqa: E712
        ).update({"is_default": False})
        exc.is_default = True

    db.commit()
    db.refresh(exc)
    return exc


@router.delete("/{exchange_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_exchange(
    exchange_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a connected exchange."""
    exc = (
        db.query(UserExchange)
        .filter(
            UserExchange.user_id == current_user.id,
            UserExchange.exchange_id == exchange_id,
        )
        .first()
    )
    if exc is None:
        raise HTTPException(status_code=404, detail="Exchange connection not found")

    was_default = exc.is_default
    db.delete(exc)
    db.commit()

    # Promote another connection to default if the deleted one was default
    if was_default:
        remaining = (
            db.query(UserExchange)
            .filter(UserExchange.user_id == current_user.id)
            .order_by(UserExchange.created_at.asc())
            .first()
        )
        if remaining:
            remaining.is_default = True
            db.commit()
