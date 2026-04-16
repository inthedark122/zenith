from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.db.base import Base

# Symbols supported by the MACD D1 strategy
MACD_ALLOWED_SYMBOLS = ["BTC/USDT", "ETH/USDT", "HYPE/USDT"]

STRATEGY_TYPES = ["dca", "macd"]


class StrategyConfig(Base):
    """
    Unified configuration for all strategy bots (DCA, MACD, …).

    Strategy-specific parameters are stored in the ``settings`` JSON column.

    DCA settings keys:
        base_amount, safety_order_multiplier, price_deviation, max_safety_orders

    MACD settings keys:
        margin_per_trade, leverage, rr_ratio
    """

    __tablename__ = "strategy_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    strategy_type = Column(String, nullable=False)   # "dca" | "macd"
    symbol = Column(String, nullable=False)
    is_active = Column(Integer, default=0)           # 0=idle, 1=running
    settings = Column(JSON, default=dict)            # strategy-specific params
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="strategy_configs")
    trades = relationship("StrategyTrade", back_populates="config")


class StrategyTrade(Base):
    """
    Unified trade record for all strategies (DCA, MACD, …).

    Strategy-specific fields are stored in the ``details`` JSON column.

    DCA details keys:
        base_order_amount, safety_orders

    MACD details keys:
        timeframe, entry_number, entry_price, take_profit_price,
        stop_loss_price, margin, leverage
    """

    __tablename__ = "strategy_trades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    config_id = Column(Integer, ForeignKey("strategy_configs.id"), nullable=True)
    strategy_type = Column(String, nullable=False)   # "dca" | "macd"
    symbol = Column(String, nullable=False)
    exchange = Column(String, default="okx")
    # DCA: "active" / "completed" / "stopped"
    # MACD: "open" / "win" / "loss"
    status = Column(String, default="open")
    trade_date = Column(Date, nullable=True)         # UTC date (MACD) or None (DCA)
    details = Column(JSON, default=dict)             # strategy-specific trade data
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="strategy_trades")
    config = relationship("StrategyConfig", back_populates="trades")

