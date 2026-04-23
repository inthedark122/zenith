from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator

from app.models.exchange import SUPPORTED_EXCHANGES


class UserExchangeCreate(BaseModel):
    exchange_id: str
    label: Optional[str] = None
    api_key: str
    api_secret: str
    passphrase: Optional[str] = None
    is_default: bool = False

    @field_validator("exchange_id")
    @classmethod
    def validate_exchange_id(cls, v: str) -> str:
        if v not in SUPPORTED_EXCHANGES:
            raise ValueError(f"exchange_id must be one of {SUPPORTED_EXCHANGES}")
        return v


class UserExchangeUpdate(BaseModel):
    label: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    passphrase: Optional[str] = None
    is_default: Optional[bool] = None


class UserExchangeResponse(BaseModel):
    id: int
    user_id: int
    exchange_id: str
    label: Optional[str]
    is_default: bool
    status: str
    balance_usdt_free: Optional[float] = None
    balance_usdt_total: Optional[float] = None
    balance_updated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # NOTE: api_key, api_secret and passphrase are intentionally omitted
    #       from the response to avoid leaking credentials.

    model_config = {"from_attributes": True}


class ExchangeAccountBalance(BaseModel):
    label: str
    usdt_free: float
    usdt_total: float


class ExchangeBalanceResponse(BaseModel):
    accounts: List[ExchangeAccountBalance]
    last_updated: Optional[datetime] = None
    error: Optional[str] = None
