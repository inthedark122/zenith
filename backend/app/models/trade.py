from datetime import datetime
from enum import Enum

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class TradeStatus(str, Enum):
    OPEN = "open"
    WIN = "win"
    LOSS = "loss"
    PENDING = "pending" # limit order placed on exchange, not yet filled
    CLOSED = "closed"   # force-closed when the parent worker is stopped
    STOPPED = "stopped" # stale — exchange position no longer exists


class StrategyTrade(Base):
    """
    Read-only trade history record.

    Trades are created exclusively by strategy worker implementations
    (e.g. the DCA_MACD_DAILY worker).  Users and API endpoints cannot
    create or close trades — the worker controls the full lifecycle.

    Status lifecycle (DCA_MACD_DAILY):
        open → win   (TP hit — set by the worker)
        open → loss  (SL hit — set by the worker)

    Fields
    ------
    user_id       — the user this trade belongs to
    worker_id     — the StrategyWorker that opened this trade
    strategy_id   — the Strategy template used
    symbol        — trading pair, e.g. "BTC/USDT"
    exchange      — exchange_id at the time the trade was opened
    status        — "open" | "win" | "loss"
    trade_date    — UTC calendar date when the trade was opened
    details       — JSON bag: entry_price, take_profit_price, stop_loss_price,
                    margin, leverage, rr_ratio, entry_number, timeframe
    """

    __tablename__ = "strategy_trades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("strategy_workers.id"), nullable=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=True)
    symbol = Column(String, nullable=False)
    exchange = Column(String, nullable=False)
    status = Column(String, default=TradeStatus.OPEN)          # TradeStatus
    trade_date = Column(Date, nullable=True)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="strategy_trades")
    worker = relationship("StrategyWorker", back_populates="trades")
