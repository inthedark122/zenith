from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class WorkerLaunchRequest(BaseModel):
    """
    User-facing payload to start a strategy worker.

    Users supply only:
    - strategy_id — which admin-defined Strategy to run
    - margin      — USDT margin per trade (validated ≤ wallet balance)
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
