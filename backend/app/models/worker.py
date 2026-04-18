from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class StrategyWorker(Base):
    """
    Tracks each user's activation of a strategy.

    A StrategyWorker represents the user's intent to trade a particular
    ``Strategy`` with a fixed ``margin`` per trade.  The market-listener
    orchestrator reads all ``running`` workers and calls the appropriate
    strategy implementation (e.g. DCA_MACD_DAILY) to evaluate signals and
    open / close trades.

    Users never create trades directly — the worker does it on their behalf.

    Status lifecycle
    ----------------
    pending  → running   (after the user starts the worker via POST /trading/launch)
    running  → stopped   (after the user stops the worker via POST /trading/stop/:id)

    Fields
    ------
    user_id       — the user who owns this worker
    strategy_id   — which Strategy template this worker executes
    margin        — USDT margin per trade (validated ≤ wallet balance at activation)
    exchange_id   — resolved from user's connected UserExchange at start time
    status        — "running" | "stopped"
    started_at    — when the worker was last started
    stopped_at    — when the worker was last stopped
    """

    __tablename__ = "strategy_workers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False)
    margin = Column(Numeric(18, 8), nullable=False)
    exchange_id = Column(String, nullable=False)
    status = Column(String, default="running")      # "running" | "stopped"
    started_at = Column(DateTime, default=datetime.utcnow)
    stopped_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="strategy_workers")
    strategy = relationship("Strategy", back_populates="workers")
    trades = relationship("StrategyTrade", back_populates="worker")
