from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, field_validator


class WorkerLaunchRequest(BaseModel):
    """
    Legacy payload to start a strategy worker (kept for backward compat).
    Prefer POST /trading/tokens/start with symbol_margins instead.
    """
    strategy_id: int
    user_exchange_id: Optional[int] = None
    selected_symbols: List[str] = []
    symbol_margins: Optional[Dict[str, float]] = None


class WorkerResponse(BaseModel):
    id: int
    user_id: int
    strategy_id: int
    exchange_id: str
    user_exchange_id: Optional[int] = None
    selected_symbols: Optional[List[str]] = None
    symbol_margins: Dict[str, float] = {}
    strategy_symbols: List[str] = []

    @field_validator("symbol_margins", mode="before")
    @classmethod
    def coerce_margins(cls, v: object) -> dict:
        return v if isinstance(v, dict) else {}

    @field_validator("strategy_symbols", mode="before")
    @classmethod
    def coerce_strategy_symbols(cls, v: object) -> list:
        return v if isinstance(v, list) else []
    status: str
    started_at: Optional[datetime]
    stopped_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        instance = super().model_validate(obj, *args, **kwargs)
        # Populate strategy_symbols from the related strategy
        try:
            syms = obj.strategy.symbols or []
            instance.strategy_symbols = [
                (s["symbol"] if isinstance(s, dict) else s) for s in syms
            ]
        except Exception:
            pass
        return instance


class WorkerStopResponse(WorkerResponse):
    """Extended response returned when a worker is force-stopped."""
    closed_trades_count: int = 0
    message: str = ""


# ---------------------------------------------------------------------------
# Token-level start / stop (user-facing, worker is internal)
# ---------------------------------------------------------------------------

class TokenStartRequest(BaseModel):
    """
    Start trading specific symbols for a strategy.

    The backend transparently creates a new StrategyWorker or reuses the
    existing running one for the same (user, strategy, exchange) combination.

    - symbol_margins: per-symbol USDT budget {symbol: amount}. Required for new workers.
    - user_exchange_id: None = auto-select the user's default exchange.
    """
    strategy_id: int
    symbols: List[str]
    symbol_margins: Optional[Dict[str, float]] = None
    user_exchange_id: Optional[int] = None


class TokenStopRequest(BaseModel):
    """
    Stop trading specific symbols for a strategy.

    Symbols are liquidated on the exchange and removed from the running
    worker.  If no symbols remain the worker is stopped automatically.
    """
    strategy_id: int
    symbols: List[str]
    user_exchange_id: Optional[int] = None


class TokenStopResponse(BaseModel):
    stopped_symbols: List[str]
    worker_stopped: bool
    message: str



