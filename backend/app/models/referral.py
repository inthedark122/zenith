from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.orm import relationship

from app.db.base import Base


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)
    referrer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    referred_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    level = Column(Integer, nullable=False)                    # 1, 2, or 3
    commission_rate = Column(Numeric(5, 2), nullable=False)    # 0.50, 0.30, 0.20
    commission_earned = Column(Numeric(20, 8), default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    referrer = relationship("User", foreign_keys=[referrer_id], backref="downstream_referrals")
    referred = relationship("User", foreign_keys=[referred_id], backref="upstream_referrals")
    commission_payments = relationship("CommissionPayment", back_populates="referral")


class CommissionPayment(Base):
    __tablename__ = "commission_payments"

    id = Column(Integer, primary_key=True, index=True)
    referral_id = Column(Integer, ForeignKey("referrals.id"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    amount = Column(Numeric(20, 8), nullable=False)
    paid_at = Column(DateTime, default=datetime.utcnow)

    referral = relationship("Referral", back_populates="commission_payments")
    subscription = relationship("Subscription", back_populates="commission_payments")
