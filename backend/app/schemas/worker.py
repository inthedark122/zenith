from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class WorkerLaunchRequest(BaseModel):
    """
    User-facing payload to start a strategy worker.

    Users supply only:
    - strategy_id — which admin-defined Strategy to run
    - margin      — USDT margin per trade (validated against connected exchange balance)
    """
    strategy_id: int
    margin: float


class WorkerResponse(BaseModel):
    id: int
    user_id: int
    strategy_id: int
    margin: float
    exchange_id: str
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
