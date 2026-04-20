from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class StrategyBacktestRun(Base):
    __tablename__ = "strategy_backtest_runs"

    id = Column(Integer, primary_key=True, index=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False, index=True)
    timeframe = Column(String, nullable=False, default="1d")
    lookback_days = Column(Integer, nullable=False)
    margin_per_trade = Column(Float, nullable=False)
    generated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    assumption_notes = Column(JSON, nullable=False, default=list)
    total_trades = Column(Integer, nullable=False, default=0)
    wins = Column(Integer, nullable=False, default=0)
    losses = Column(Integer, nullable=False, default=0)
    win_rate = Column(Float, nullable=False, default=0.0)
    gross_profit_usd = Column(Float, nullable=False, default=0.0)
    gross_loss_usd = Column(Float, nullable=False, default=0.0)
    net_profit_usd = Column(Float, nullable=False, default=0.0)
    avg_win_usd = Column(Float, nullable=False, default=0.0)
    avg_loss_usd = Column(Float, nullable=False, default=0.0)
    profit_factor = Column(Float, nullable=True)
    max_drawdown_usd = Column(Float, nullable=False, default=0.0)
    max_drawdown_pct = Column(Float, nullable=False, default=0.0)
    best_trade_usd = Column(Float, nullable=True)
    worst_trade_usd = Column(Float, nullable=True)
    symbol_results = Column(JSON, nullable=False, default=list)
    orders = Column(JSON, nullable=False, default=list)

    strategy_template = relationship("Strategy", back_populates="backtest_runs")

    @property
    def strategy(self) -> str:
        return self.strategy_template.strategy if self.strategy_template else ""
