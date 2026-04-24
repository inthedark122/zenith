"""
Binance Futures (USDT-M) exchange adapter.

Hedge mode detection:
    exchange.fapiPrivateGetPositionSideDual() → dualSidePosition
    true  → hedge (True)
    false → net   (False)

Error signature for position-mode mismatch:
    "hedge mode" or "positionside" in the message.
"""
from __future__ import annotations

import logging

import ccxt

from app.exchange.adapters.base import BaseAdapter

log = logging.getLogger(__name__)


class BinanceAdapter(BaseAdapter):
    EXCHANGE_ID = "binance"

    def detect_hedge_mode(self, exchange: ccxt.Exchange) -> bool:
        try:
            resp = exchange.fapiPrivateGetPositionSideDual()
            return bool(resp.get("dualSidePosition", False))
        except Exception as exc:
            log.warning("[binance] Could not detect position mode: %s — assuming net", exc)
            return False

    def is_pos_mode_error(self, exc: Exception) -> bool:
        msg = str(exc).lower()
        return "hedge mode" in msg or "positionside" in msg

    def set_leverage_params(self, is_hedge: bool) -> dict:
        # Binance futures don't need mgnMode here
        return {}

    def open_swap_params(self, is_hedge: bool) -> dict:
        if is_hedge:
            return {"positionSide": "LONG"}
        return {}

    def close_swap_params(self, is_hedge: bool) -> dict:
        if is_hedge:
            return {"positionSide": "LONG"}
        return {"reduceOnly": True}
