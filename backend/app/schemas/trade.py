from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class DCAConfigCreate(BaseModel):
    symbol: str
    base_amount: Decimal
    safety_order_multiplier: float = 2.0
    price_deviation: float = 0.04
    max_safety_orders: int = 6


class DCAConfigResponse(BaseModel):
    id: int
    user_id: int
    symbol: str
    base_amount: Decimal
    safety_order_multiplier: float
    price_deviation: float
    max_safety_orders: int
    is_active: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TradeCreate(BaseModel):
    symbol: str
    exchange: str = "okx"
    base_order_amount: Decimal


class TradeResponse(BaseModel):
    id: int
    user_id: int
    symbol: str
    exchange: str
    strategy: str
    status: str
    base_order_amount: Decimal
    safety_orders: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
