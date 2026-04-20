from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.db.base import Base

# The one strategy implementation available today
STRATEGY_DCA_MACD_DAILY = "DCA_MACD_DAILY"
SUPPORTED_STRATEGIES = [STRATEGY_DCA_MACD_DAILY]


class Strategy(Base):
    """
    Admin-controlled strategy template.

    Admins create and manage these records via the /admin/strategies API.
    Users cannot modify strategy parameters — they only supply ``margin``
    when starting a StrategyWorker.

    Fields
    ------
    name          — human-readable label, e.g. "BTC/ETH MACD D1 Long"
    strategy      — strategy implementation identifier, e.g. "DCA_MACD_DAILY"
    symbols       — JSON list of allowed trading pairs, e.g. ["BTC/USDT","ETH/USDT"]
    leverage      — exchange leverage multiplier (e.g. 20)
    rr_ratio      — risk-to-reward ratio (default 2 = 1:2)
    max_daily_trades        — max entries allowed per user per calendar day
    max_daily_margin_usd    — maximum total margin a user may risk in one day
                              (0 = no limit enforced at strategy level)
    is_active     — only active strategies are visible to users
    """

    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    strategy = Column(String, nullable=False, default=STRATEGY_DCA_MACD_DAILY)
    symbols = Column(JSON, nullable=False, default=list)   # e.g. ["BTC/USDT", "ETH/USDT"]
    leverage = Column(Float, nullable=False, default=20.0)
    rr_ratio = Column(Float, nullable=False, default=2.0)
    # Strategy-specific configuration; keys vary per strategy implementation.
    # DCA_MACD_DAILY default: {"max_daily_trades": 2, "max_daily_margin_usd": 0.0}
    settings = Column(JSON, nullable=False, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workers = relationship("StrategyWorker", back_populates="strategy")
    backtest_runs = relationship(
        "StrategyBacktestRun",
        back_populates="strategy_template",
        order_by="desc(StrategyBacktestRun.generated_at)",
        cascade="all, delete-orphan",
    )

    @property
    def latest_backtest(self):
        return self.backtest_runs[0] if self.backtest_runs else None
