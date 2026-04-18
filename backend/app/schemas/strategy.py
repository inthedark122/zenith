from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator

from app.models.strategy import SUPPORTED_STRATEGIES


class StrategyCreate(BaseModel):
    name: str
    strategy: str = "DCA_MACD_DAILY"
    symbols: List[str]
    leverage: float = 20.0
    rr_ratio: float = 2.0
    max_daily_trades: int = 2
    max_daily_margin_usd: float = 0.0
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
    max_daily_trades: Optional[int] = None
    max_daily_margin_usd: Optional[float] = None
    is_active: Optional[bool] = None


class StrategyResponse(BaseModel):
    id: int
    name: str
    strategy: str
    symbols: List[str]
    leverage: float
    rr_ratio: float
    max_daily_trades: int
    max_daily_margin_usd: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
