"""
Base exchange adapter — safe defaults for net (one-way) position mode.

All methods here return values that work for any exchange that does not
require position-side parameters (i.e. net / one-way mode).
Subclass this for exchange-specific behaviour.
"""
from __future__ import annotations

import ccxt


class BaseAdapter:
    EXCHANGE_ID = ""

    # ------------------------------------------------------------------
    # Hedge mode detection
    # ------------------------------------------------------------------

    def detect_hedge_mode(self, exchange: ccxt.Exchange) -> bool:
        """
        Query the exchange and return True if the account is in hedge
        (long/short dual-side) position mode.

        Default implementation returns False (safe net-mode assumption).
        """
        return False

    # ------------------------------------------------------------------
    # Error classification
    # ------------------------------------------------------------------

    def is_pos_mode_error(self, exc: Exception) -> bool:
        """
        Return True if *exc* indicates a position-mode mismatch so the
        caller can invalidate the cached hedge-mode setting.
        """
        return False

    # ------------------------------------------------------------------
    # Order param builders
    # ------------------------------------------------------------------

    def set_leverage_params(self, is_hedge: bool) -> dict:
        """Extra params for set_leverage()."""
        return {"mgnMode": "isolated"}

    def open_swap_params(self, is_hedge: bool) -> dict:
        """Extra params for create_order() when opening a swap long."""
        return {"tdMode": "isolated"}

    def close_swap_params(self, is_hedge: bool) -> dict:
        """Extra params for create_order() when closing a swap long."""
        return {"tdMode": "isolated", "reduceOnly": True}
