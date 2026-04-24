"""
OKX-specific exchange adapter.

Hedge mode detection:
    exchange.privateGetAccountConfig() → data[0].posMode
    "long_short_mode" → hedge (True)
    "net_mode"        → net   (False)

Error signature for position-mode mismatch:
    OKX error code 51000 with "posside" in the message.
"""
from __future__ import annotations

import logging

import ccxt

from app.exchange.adapters.base import BaseAdapter

log = logging.getLogger(__name__)


class OKXAdapter(BaseAdapter):
    EXCHANGE_ID = "okx"

    def detect_hedge_mode(self, exchange: ccxt.Exchange) -> bool:
        try:
            resp = exchange.privateGetAccountConfig()
            pos_mode = resp.get("data", [{}])[0].get("posMode", "net_mode")
            return pos_mode == "long_short_mode"
        except Exception as exc:
            log.warning("[okx] Could not detect position mode: %s — assuming net", exc)
            return False

    def is_pos_mode_error(self, exc: Exception) -> bool:
        msg = str(exc).lower()
        return "51000" in msg or "posside" in msg

    def set_leverage_params(self, is_hedge: bool) -> dict:
        params = {"mgnMode": "isolated"}
        if is_hedge:
            params["posSide"] = "long"
        return params

    def open_swap_params(self, is_hedge: bool) -> dict:
        params = {"tdMode": "isolated"}
        if is_hedge:
            params["posSide"] = "long"
        return params

    def close_swap_params(self, is_hedge: bool) -> dict:
        if is_hedge:
            # In hedge mode reduceOnly is implicit (selling the long side closes it)
            return {"tdMode": "isolated", "posSide": "long"}
        return {"tdMode": "isolated", "reduceOnly": True}
