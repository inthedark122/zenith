from datetime import date, datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Unified trade response
# ---------------------------------------------------------------------------

class StrategyTradeResponse(BaseModel):
    """Response for any strategy trade. All trade-specific data is under ``details``."""
    id: int
    user_id: int
    strategy_id: Optional[int]
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
# MACD trade — request schemas
# ---------------------------------------------------------------------------

class MACDTradeLaunchRequest(BaseModel):
    """
    User-facing trade launch payload.

    Users supply only what they control:
    - strategy_id — which admin-predefined strategy to use
    - margin      — USDT margin to risk (validated ≤ wallet balance)
    - entry_price — current mark price (used to compute TP/SL levels)
    """
    strategy_id: int
    margin: float
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
