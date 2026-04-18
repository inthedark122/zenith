from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base

# Symbols supported by the MACD D1 strategy
MACD_ALLOWED_SYMBOLS = ["BTC/USDT", "ETH/USDT", "HYPE/USDT"]


class AdminStrategy(Base):
    """
    Admin-controlled strategy template.

    Admins create and manage these records via the /admin/strategies API.
    Users cannot modify strategy parameters — they can only pick a strategy
    and supply their margin when launching a trade.

    Fields
    ------
    name          — human-readable label, e.g. "BTC MACD D1 Long"
    symbol        — trading pair (must be one of MACD_ALLOWED_SYMBOLS)
    leverage      — exchange leverage multiplier (e.g. 20)
    rr_ratio      — risk-to-reward ratio (default 2 = 1:2)
    max_daily_trades        — max entries allowed per user per calendar day
    max_daily_margin_usd    — maximum total margin a user may risk in one day
                              (0 = no limit enforced at strategy level)
    is_active     — only active strategies are visible to users
    """

    __tablename__ = "admin_strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    leverage = Column(Float, nullable=False, default=20.0)
    rr_ratio = Column(Float, nullable=False, default=2.0)
    max_daily_trades = Column(Integer, nullable=False, default=2)
    max_daily_margin_usd = Column(Float, nullable=False, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
