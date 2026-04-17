from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base

# Supported exchange IDs (ccxt identifiers)
SUPPORTED_EXCHANGES = ["okx", "binance", "bybit", "kucoin", "gate"]


class UserExchange(Base):
    """
    Stores a user's exchange API credentials.

    Each user can connect multiple exchanges.  The ``is_default`` flag marks
    which connection is used when no explicit exchange is specified.  Only one
    connection per (user, exchange_id) pair is allowed.
    """

    __tablename__ = "user_exchanges"
    __table_args__ = (UniqueConstraint("user_id", "exchange_id", name="uq_user_exchange"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    exchange_id = Column(String, nullable=False)   # ccxt exchange id, e.g. "okx"
    label = Column(String, nullable=True)          # optional user-friendly name
    api_key = Column(String, nullable=False)
    api_secret = Column(String, nullable=False)
    passphrase = Column(String, nullable=True)     # required by OKX, optional elsewhere
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="exchanges")
