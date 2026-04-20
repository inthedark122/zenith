from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, field_validator

from app.models.strategy import SUPPORTED_STRATEGIES


class StrategyCreate(BaseModel):
    name: str
    strategy: str = "DCA_MACD_DAILY"
    symbols: List[str]
    leverage: float = 20.0
    rr_ratio: float = 2.0
    # Strategy-specific configuration — keys depend on the strategy implementation.
    # DCA_MACD_DAILY accepts: {"max_daily_trades": int, "max_daily_margin_usd": float}
    settings: Dict[str, Any] = {}
    is_active: bool = True

    @field_validator("strategy")
    @classmethod
    def validate_strategy(cls, v: str) -> str:
        if v not in SUPPORTED_STRATEGIES:
            raise ValueError(
                f"strategy must be one of: {', '.join(SUPPORTED_STRATEGIES)}"
            )
        return v

    @field_validator("symbols")
    @classmethod
    def validate_symbols(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("symbols must contain at least one trading pair")
        return v

    @field_validator("leverage")
    @classmethod
    def validate_leverage(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("leverage must be positive")
        return v

    @field_validator("rr_ratio")
    @classmethod
    def validate_rr(cls, v: float) -> float:
        if v < 1:
            raise ValueError("rr_ratio must be >= 1")
        return v


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    symbols: Optional[List[str]] = None
    leverage: Optional[float] = None
    rr_ratio: Optional[float] = None
    settings: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class StrategyBacktestRequest(BaseModel):
    lookback_days: int = 365
    margin_per_trade: float = 100.0

    @field_validator("lookback_days")
    @classmethod
    def validate_lookback_days(cls, v: int) -> int:
        if v < 60 or v > 1000:
            raise ValueError("lookback_days must be between 60 and 1000")
        return v

    @field_validator("margin_per_trade")
    @classmethod
    def validate_margin_per_trade(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("margin_per_trade must be positive")
        return v


class StrategyBacktestSymbolSummary(BaseModel):
    symbol: str
    total_trades: int
    wins: int
    losses: int
    win_rate: float
    net_profit_usd: float


class StrategyBacktestSummary(BaseModel):
    strategy: str
    timeframe: str
    lookback_days: int
    margin_per_trade: float
    generated_at: datetime
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    assumption_notes: List[str]
    total_trades: int
    wins: int
    losses: int
    win_rate: float
    net_profit_usd: float
    symbol_results: List[StrategyBacktestSymbolSummary]


class StrategyResponse(BaseModel):
    id: int
    name: str
    strategy: str
    symbols: List[str]
    leverage: float
    rr_ratio: float
    settings: Dict[str, Any]
    backtest_summary: Optional[StrategyBacktestSummary] = None
    backtest_updated_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
