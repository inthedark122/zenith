from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Unified strategy response schemas
# ---------------------------------------------------------------------------

class StrategyConfigResponse(BaseModel):
    """
    Generic response for any strategy configuration.
    Strategy-specific params are under ``settings``.
    """
    id: int
    user_id: int
    strategy_type: str
    symbol: str
    is_active: int
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StrategyTradeResponse(BaseModel):
    """
    Generic response for any strategy trade.
    Strategy-specific trade data is under ``details``.
    """
    id: int
    user_id: int
    config_id: Optional[int]
    strategy_type: str
    symbol: str
    exchange: str
    status: str
    trade_date: Optional[date]
    details: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# DCA strategy — request schemas
# ---------------------------------------------------------------------------

class DCAConfigCreate(BaseModel):
    symbol: str
    base_amount: Decimal
    safety_order_multiplier: float = 2.0
    price_deviation: float = 0.04
    max_safety_orders: int = 6


# ---------------------------------------------------------------------------
# MACD D1 strategy — request schemas
# ---------------------------------------------------------------------------

class MACDConfigCreate(BaseModel):
    symbol: str
    margin_per_trade: Decimal
    leverage: float = 20.0
    rr_ratio: float = 2.0


class MACDTradeOpen(BaseModel):
    entry_price: float


class MACDTradeClose(BaseModel):
    result: str   # 'win' or 'loss'


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
