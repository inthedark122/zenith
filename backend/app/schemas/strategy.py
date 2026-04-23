from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, field_validator

from app.models.strategy import SUPPORTED_STRATEGIES


class StrategySymbol(BaseModel):
    """A single tradeable instrument entry within a strategy."""
    symbol: str                             # ccxt symbol: "BTC/USDT" (spot) or "BTC/USDT:USDT" (swap)
    market_type: Literal["spot", "swap"]    # determines which exchange market is used
    leverage: int = 1                       # 1 for spot; ≥1 for swap

    @field_validator("leverage")
    @classmethod
    def validate_leverage(cls, v: int) -> int:
        if v < 1:
            raise ValueError("leverage must be ≥ 1")
        return v


class StrategyCreate(BaseModel):
    name: str
    strategy: str = "DCA_MACD_DAILY"
    symbols: List[StrategySymbol]
    leverage: float = 20.0          # kept for backwards compat / MACD strategy default
    rr_ratio: float = 2.0
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
    def validate_symbols(cls, v: List[StrategySymbol]) -> List[StrategySymbol]:
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
    symbols: Optional[List[StrategySymbol]] = None
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
        if v < 14 or v > 1000:
            raise ValueError("lookback_days must be between 14 and 1000")
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
    id: int
    strategy_id: int
    strategy: str
    timeframe: str
    lookback_days: int
    margin_per_trade: float
    generated_at: datetime
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    assumption_notes: List[str]
    total_trades: int
    wins: int
    losses: int
    win_rate: float
    gross_profit_usd: float
    gross_loss_usd: float
    net_profit_usd: float
    avg_win_usd: float
    avg_loss_usd: float
    profit_factor: Optional[float] = None
    max_drawdown_usd: float
    max_drawdown_pct: float
    best_trade_usd: Optional[float] = None
    worst_trade_usd: Optional[float] = None
    symbol_results: List[StrategyBacktestSymbolSummary]
    is_public: bool = False

    model_config = {"from_attributes": True}


class StrategyBacktestOrder(BaseModel):
    symbol: str
    side: str
    status: str
    opened_at: datetime
    closed_at: datetime
    entry_price: float
    exit_price: float
    take_profit_price: float
    stop_loss_price: float
    margin_per_trade: float
    leverage: float
    pnl_usd: float
    pnl_pct: float
    close_reason: str
    bars_held: int


class StrategyBacktestRunResponse(StrategyBacktestSummary):
    orders: List[StrategyBacktestOrder]


class StrategyResponse(BaseModel):
    id: int
    name: str
    strategy: str
    symbols: List[StrategySymbol]
    leverage: float
    rr_ratio: float
    settings: Dict[str, Any]
    latest_backtest: Optional[StrategyBacktestSummary] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
