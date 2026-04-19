from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.orm import relationship

from app.db.base import Base

# Valid plan codes and their properties
PLAN_CODES = ("starter", "trader", "pro")
PLAN_COINS = {"starter": 1, "trader": 2, "pro": 3}
PLAN_PRICES_MAP = {"starter": "15.00", "trader": "20.00", "pro": "25.00"}


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint("plan IN ('starter', 'trader', 'pro')", name="ck_subscription_plan"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan = Column(String, nullable=False)           # "starter" | "trader" | "pro"
    price = Column(Numeric(10, 2), nullable=False)  # 15, 20, or 25 USD
    status = Column(String, default="pending")      # pending / active / expired
    started_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    coins = Column(JSON, default=list)              # e.g. ["BTC/USDT", "ETH/USDT"]
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="subscriptions")
    commission_payments = relationship("CommissionPayment", back_populates="subscription")



