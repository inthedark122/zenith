import random
import string
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


def _generate_referral_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    referral_code = Column(String(6), unique=True, index=True, nullable=False, default=_generate_referral_code)
    referred_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    referrer = relationship("User", remote_side=[id], backref="referrals")
    subscriptions = relationship("Subscription", back_populates="user")
    wallet = relationship("Wallet", back_populates="user", uselist=False)
    exchanges = relationship("UserExchange", back_populates="user")
    strategy_workers = relationship("StrategyWorker", back_populates="user")
    strategy_trades = relationship("StrategyTrade", back_populates="user")
