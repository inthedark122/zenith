import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.exchange import SUPPORTED_EXCHANGES, UserExchange
from app.models.user import User
from app.models.validation_task import ExchangeValidationTask
from app.schemas.exchange import (
    ExchangeAccountBalance,
    ExchangeBalanceResponse,
    UserExchangeCreate,
    UserExchangeResponse,
    UserExchangeUpdate,
)
from app.utils.pg_notify import pg_notify, pg_wait_for_notification

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
async def add_exchange(
    payload: UserExchangeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Connect a new exchange. Credentials are saved then validated via the trading worker."""
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
        status="pending",
    )
    db.add(exc)
    db.flush()  # assign exc.id

    # Create a validation task so the worker can pick up credentials
    task = ExchangeValidationTask(
        user_id=current_user.id,
        exchange_id=payload.exchange_id,
        api_key=payload.api_key,
        api_secret=payload.api_secret,
        passphrase=payload.passphrase,
    )
    db.add(task)
    db.commit()
    db.refresh(exc)
    db.refresh(task)

    # Notify the worker and wait up to 15s for the validation result
    try:
        await pg_notify("exchange_validation", str(task.id))
        raw = await pg_wait_for_notification(f"validation_result_{task.id}", timeout=15)
        if raw is not None:
            result = json.loads(raw)
            db.refresh(exc)
    except Exception:
        pass  # Return with status=pending on any notification error

    db.refresh(exc)
    return exc


@router.get("/{exchange_id}/balance", response_model=ExchangeBalanceResponse)
def get_exchange_balance(
    exchange_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return cached USDT balance from the DB (populated by the trading worker)."""
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

    if exc.status != "verified" or exc.balance_usdt_free is None:
        return ExchangeBalanceResponse(accounts=[], last_updated=None)

    accounts = [
        ExchangeAccountBalance(
            label="Trading",
            usdt_free=exc.balance_usdt_free,
            usdt_total=exc.balance_usdt_total or exc.balance_usdt_free,
        )
    ]
    return ExchangeBalanceResponse(accounts=accounts, last_updated=exc.balance_updated_at)


@router.put("/{exchange_id}", response_model=UserExchangeResponse)
async def update_exchange(
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

    credentials_changed = False
    if payload.label is not None:
        exc.label = payload.label
    if payload.api_key is not None:
        exc.api_key = payload.api_key
        credentials_changed = True
    if payload.api_secret is not None:
        exc.api_secret = payload.api_secret
        credentials_changed = True
    if payload.passphrase is not None:
        exc.passphrase = payload.passphrase
        credentials_changed = True
    if payload.is_default is True:
        db.query(UserExchange).filter(
            UserExchange.user_id == current_user.id,
            UserExchange.is_default == True,  # noqa: E712
        ).update({"is_default": False})
        exc.is_default = True

    if credentials_changed:
        exc.status = "pending"
        exc.balance_usdt_free = None
        exc.balance_usdt_total = None
        exc.balance_updated_at = None

    task = None
    if credentials_changed:
        task = ExchangeValidationTask(
            user_id=current_user.id,
            exchange_id=exchange_id,
            api_key=exc.api_key,
            api_secret=exc.api_secret,
            passphrase=exc.passphrase,
        )
        db.add(task)

    db.commit()
    db.refresh(exc)

    if credentials_changed and task is not None:
        db.refresh(task)
        try:
            await pg_notify("exchange_validation", str(task.id))
            raw = await pg_wait_for_notification(f"validation_result_{task.id}", timeout=15)
            if raw is not None:
                db.refresh(exc)
        except Exception:
            pass

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
