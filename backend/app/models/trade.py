from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.orm import relationship

from app.db.base import Base


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
