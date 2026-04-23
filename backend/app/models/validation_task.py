from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text

from app.db.base import Base


class ExchangeValidationTask(Base):
    """
    Short-lived task record used to proxy exchange credential validation
    through the trading worker (which has the whitelisted outbound IP).

    Lifecycle:
    - Backend creates record + sends NOTIFY to worker
    - Worker processes: calls exchange, writes result, sends NOTIFY back
    - Backend reads result from the NOTIFY payload
    - Records older than 1 hour are cleaned up by the worker
    """

    __tablename__ = "exchange_validation_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    exchange_id = Column(String, nullable=False)
    api_key = Column(String, nullable=False)
    api_secret = Column(String, nullable=False)
    passphrase = Column(String, nullable=True)
    status = Column(String, nullable=False, default="processing")  # processing | done | error
    result_ok = Column(Boolean, nullable=True)
    result_balance = Column(Float, nullable=True)
    result_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
