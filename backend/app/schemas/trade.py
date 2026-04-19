from datetime import date, datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class StrategyTradeResponse(BaseModel):
    """Response for any strategy trade. All trade-specific data is under ``details``."""
    id: int
    user_id: int
    worker_id: Optional[int]
    strategy_id: Optional[int]
    symbol: str
    exchange: str
    status: str
    trade_date: Optional[date]
    details: Dict[str, Any]
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
