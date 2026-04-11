from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan = Column(Integer, nullable=False)          # 1, 2, or 3 coins
    price = Column(Numeric(10, 2), nullable=False)  # 15, 20, or 25 USD
    status = Column(String, default="pending")      # pending / active / expired
    started_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    coins = Column(JSON, default=list)              # e.g. ["BTC/USDT", "ETH/USDT"]
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="subscriptions")
    commission_payments = relationship("CommissionPayment", back_populates="subscription")
