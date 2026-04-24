"""
Per-exchange adapter registry.

Usage:
    from app.exchange.adapters import get_adapter

    adapter = get_adapter(exchange.id)           # e.g. "okx" / "binance"
    is_hedge = adapter.detect_hedge_mode(exchange)
"""
from __future__ import annotations

from app.exchange.adapters.base import BaseAdapter
from app.exchange.adapters.okx import OKXAdapter
from app.exchange.adapters.binance import BinanceAdapter

_REGISTRY: dict[str, BaseAdapter] = {
    "okx": OKXAdapter(),
    "binance": BinanceAdapter(),
}

_DEFAULT = BaseAdapter()


def get_adapter(exchange_id: str) -> BaseAdapter:
    """Return the adapter for *exchange_id*, falling back to the base adapter."""
    return _REGISTRY.get(exchange_id.lower(), _DEFAULT)
