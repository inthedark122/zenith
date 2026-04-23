from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class WorkerLaunchRequest(BaseModel):
    """
    User-facing payload to start a strategy worker.

    Users supply:
    - strategy_id      — which admin-defined Strategy to run
    - margin           — USDT margin per trade (validated against cached exchange balance)
    - user_exchange_id — which verified exchange to use (None = auto-select default)
    - selected_symbols — symbols from strategy presets the user wants to trade
    """
    strategy_id: int
    margin: float
    user_exchange_id: Optional[int] = None
    selected_symbols: List[str] = []


class WorkerResponse(BaseModel):
    id: int
    user_id: int
    strategy_id: int
    margin: float
    exchange_id: str
    user_exchange_id: Optional[int] = None
    selected_symbols: Optional[List[str]] = None
    status: str
    started_at: Optional[datetime]
    stopped_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkerStopResponse(WorkerResponse):
    """Extended response returned when a worker is force-stopped."""
    closed_trades_count: int = 0
    message: str = ""
