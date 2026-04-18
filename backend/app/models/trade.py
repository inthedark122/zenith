from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class StrategyTrade(Base):
    """
    Records every trade opened by a user.

    ``strategy_id``  — links to the AdminStrategy that was used.
    ``strategy_type`` — denormalized for quick filtering (always "macd" currently).
    ``exchange``     — resolved from the user's connected UserExchange at launch time.
    ``details``      — JSON bag: entry_price, take_profit_price, stop_loss_price,
                       margin, leverage, rr_ratio, entry_number, timeframe.

    Status lifecycle (MACD):
        open → win  (TP hit, manually or by market_listener worker)
        open → loss (SL hit, manually or by market_listener worker)
    """

    __tablename__ = "strategy_trades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    strategy_id = Column(Integer, ForeignKey("admin_strategies.id"), nullable=True)
    strategy_type = Column(String, nullable=False, default="macd")
    symbol = Column(String, nullable=False)
    exchange = Column(String, nullable=False)           # from user's UserExchange
    status = Column(String, default="open")             # open / win / loss
    trade_date = Column(Date, nullable=True)            # UTC calendar date
    details = Column(JSON, default=dict)                # all trade-specific data
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="strategy_trades")
