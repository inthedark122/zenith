from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class WalletResponse(BaseModel):
    id: int
    user_id: int
    currency: str
    balance: Decimal
    deposit_address: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionCreate(BaseModel):
    tx_hash: str
    amount: Decimal


class TransactionResponse(BaseModel):
    id: int
    wallet_id: int
    tx_hash: Optional[str]
    amount: Decimal
    type: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}

