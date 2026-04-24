from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class WorkerStatus(str, Enum):
    RUNNING = "running"
    STOPPED = "stopped"


class StrategyWorker(Base):
    """
    Tracks each user's activation of a strategy.

    A StrategyWorker represents the user's intent to trade a particular
    ``Strategy``.  The market-listener orchestrator reads all ``running``
    workers and calls the appropriate strategy implementation (e.g. DCA_MACD_DAILY)
    to evaluate signals and open / close trades.

    Users never create trades directly — the worker does it on their behalf.
    Per-symbol budgets are stored in ``symbol_margins`` ({symbol: usdt_amount}).

    Status lifecycle
    ----------------
    pending  → running   (after the user starts tokens via POST /trading/tokens/start)
    running  → stopped   (after the user stops all tokens via POST /trading/tokens/stop)

    Fields
    ------
    user_id       — the user who owns this worker
    strategy_id   — which Strategy template this worker executes
    exchange_id   — resolved from user's connected UserExchange at start time
    symbol_margins — per-symbol USDT budget {symbol: usdt_amount}
    status        — "running" | "stopped"
    started_at    — when the worker was last started
    stopped_at    — when the worker was last stopped
    """

    __tablename__ = "strategy_workers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False)
    exchange_id = Column(String, nullable=False)
    user_exchange_id = Column(Integer, ForeignKey("user_exchanges.id"), nullable=True)
    selected_symbols = Column(JSON, nullable=True, default=list)
    symbol_margins = Column(JSON, nullable=True, default=dict)  # {symbol: margin_usdt}
    status = Column(String, default=WorkerStatus.RUNNING)      # WorkerStatus
    started_at = Column(DateTime, default=datetime.utcnow)
    stopped_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="strategy_workers")
    strategy = relationship("Strategy", back_populates="workers")
    trades = relationship("StrategyTrade", back_populates="worker")
    user_exchange = relationship("UserExchange", foreign_keys=[user_exchange_id])
