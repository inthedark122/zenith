"""Safe ccxt exchange factory.

OKX (and occasionally other exchanges) return malformed market entries
where `base` or `quote` is None.  ccxt's default `parse_markets` crashes
with ``TypeError: unsupported operand type(s) for +: 'NoneType' and 'str'``
when it tries to build the symbol string ``base + '/' + quote``.

This module provides ``create_exchange`` which monkey-patches ``parse_markets``
on the instance so that any malformed entry is silently skipped instead of
raising an exception.
"""

from __future__ import annotations

import types
from typing import Any, Dict, List, Optional

import ccxt

SUPPORTED_EXCHANGES: Dict[str, Any] = {
    "okx": ccxt.okx,
    "binance": ccxt.binance,
    "bybit": ccxt.bybit,
}


def _safe_parse_markets_method(self, markets_data: List[Any], params: Optional[Dict] = None) -> List[Any]:
    """Replacement for ccxt's parse_markets that skips malformed entries."""
    result = []
    for raw in markets_data or []:
        try:
            parsed = type(self).parse_market(self, raw)
            if parsed and parsed.get("base") and parsed.get("quote"):
                result.append(parsed)
        except Exception:
            pass
    return result


def create_exchange(exchange_id: str, options: Optional[Dict[str, Any]] = None) -> ccxt.Exchange:
    """Return a ccxt exchange instance with safe market parsing.

    Parameters
    ----------
    exchange_id:
        One of the keys in ``SUPPORTED_EXCHANGES`` (e.g. ``"okx"``).
    options:
        Extra ccxt constructor options merged with ``{"enableRateLimit": True}``.

    Raises
    ------
    ValueError
        If *exchange_id* is not in ``SUPPORTED_EXCHANGES``.
    """
    exchange_id = exchange_id.lower()
    if exchange_id not in SUPPORTED_EXCHANGES:
        raise ValueError(
            f"Unsupported exchange '{exchange_id}'. Supported: {list(SUPPORTED_EXCHANGES)}"
        )

    constructor_opts: Dict[str, Any] = {"enableRateLimit": True}
    if options:
        constructor_opts.update(options)

    ex: ccxt.Exchange = SUPPORTED_EXCHANGES[exchange_id](constructor_opts)
    # Monkey-patch parse_markets so malformed entries are skipped gracefully
    ex.parse_markets = types.MethodType(_safe_parse_markets_method, ex)
    return ex
