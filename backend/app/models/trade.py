from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.orm import relationship

from app.db.base import Base

# Symbols supported by the MACD D1 strategy
MACD_ALLOWED_SYMBOLS = ["BTC/USDT", "ETH/USDT", "HYPE/USDT"]


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False)           # e.g. BTC/USDT
    exchange = Column(String, default="okx")
    strategy = Column(String, default="dca")
    status = Column(String, default="active")         # active / completed / stopped
    base_order_amount = Column(Numeric(20, 8), nullable=False)
    safety_orders = Column(JSON, default=list)        # list of placed safety order details
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="trades")


class DCAConfig(Base):
    __tablename__ = "dca_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False)
    base_amount = Column(Numeric(20, 8), nullable=False)
    safety_order_multiplier = Column(Float, default=2.0)
    price_deviation = Column(Float, default=0.04)    # 4 %
    max_safety_orders = Column(Integer, default=6)
    is_active = Column(Integer, default=0)           # 0=idle, 1=running
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="dca_configs")


class MACDConfig(Base):
    """Configuration for the MACD D1 strategy bot."""

    __tablename__ = "macd_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False)             # must be in MACD_ALLOWED_SYMBOLS
    margin_per_trade = Column(Numeric(20, 8), nullable=False)   # e.g. 10 USDT
    leverage = Column(Float, default=20.0)              # e.g. 20×
    rr_ratio = Column(Float, default=2.0)               # 1 : 2 risk/reward
    is_active = Column(Integer, default=0)              # 0=idle, 1=running
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="macd_configs")
    trades = relationship("MACDTrade", back_populates="config")


class MACDTrade(Base):
    """Individual trade opened by the MACD D1 strategy bot."""

    __tablename__ = "macd_trades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    config_id = Column(Integer, ForeignKey("macd_configs.id"), nullable=False)
    symbol = Column(String, nullable=False)
    # 'd1' for first entry on daily MACD cross, '15m' for recovery entry
    timeframe = Column(String, default="d1")
    entry_number = Column(Integer, default=1)           # 1 or 2 per day
    entry_price = Column(Numeric(20, 8), nullable=True)
    take_profit_price = Column(Numeric(20, 8), nullable=True)
    stop_loss_price = Column(Numeric(20, 8), nullable=True)
    margin = Column(Numeric(20, 8), nullable=False)
    leverage = Column(Float, nullable=False)
    result = Column(String, default="open")             # open / win / loss
    trade_date = Column(Date, nullable=False)           # UTC date of the trade
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="macd_trades")
    config = relationship("MACDConfig", back_populates="trades")
