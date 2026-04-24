from datetime import datetime
from typing import Dict, List, Optional

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
    symbol_margins: Dict[str, float] = {}
    strategy_symbols: List[str] = []
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
        # Ensure symbol_margins is a dict (may be None in DB)
        if instance.symbol_margins is None:
            instance.symbol_margins = {}
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

    - margin is only required when no running worker exists yet.
    - symbol_margins: per-symbol budget override; if omitted for a symbol, falls back to global margin.
    - user_exchange_id: None = auto-select the user's default exchange.
    """
    strategy_id: int
    symbols: List[str]
    margin: Optional[float] = None
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

    - margin is only required when no running worker exists yet.
    - user_exchange_id: None = auto-select the user's default exchange.
    """
    strategy_id: int
    symbols: List[str]
    margin: Optional[float] = None
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
