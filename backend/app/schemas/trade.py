from datetime import date, datetime
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


# ---------------------------------------------------------------------------
# MACD D1 strategy schemas
# ---------------------------------------------------------------------------

class MACDConfigCreate(BaseModel):
    symbol: str
    margin_per_trade: Decimal
    leverage: float = 20.0
    rr_ratio: float = 2.0


class MACDConfigResponse(BaseModel):
    id: int
    user_id: int
    symbol: str
    margin_per_trade: Decimal
    leverage: float
    rr_ratio: float
    is_active: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MACDTradeOpen(BaseModel):
    entry_price: float


class MACDTradeClose(BaseModel):
    result: str   # 'win' or 'loss'


class MACDTradeResponse(BaseModel):
    id: int
    user_id: int
    config_id: int
    symbol: str
    timeframe: str
    entry_number: int
    entry_price: Optional[Decimal]
    take_profit_price: Optional[Decimal]
    stop_loss_price: Optional[Decimal]
    margin: Decimal
    leverage: float
    result: str
    trade_date: date
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MACDSignalResponse(BaseModel):
    symbol: str
    macd: float
    signal: float
    histogram: float
    is_bullish_crossover: bool
    is_bearish_crossover: bool
    can_open_trade: bool
    next_entry_number: int
    daily_status_reason: str
