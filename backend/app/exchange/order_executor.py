"""
Exchange order executor.

Provides helpers to open and close long positions on any CCXT-supported
exchange, handling both spot and swap (perpetual futures) markets.

Swap amount calculation
-----------------------
    position_value_usdt = usdt_margin * leverage
    base_amount         = position_value_usdt / entry_price
    contracts           = base_amount / contract_size
    contracts           = floor(contracts / min_lot) * min_lot   (round to lot)
    if contracts < min_contracts: skip (log warning, return skipped=True)

OKX one-way isolated-margin params used for swap (isolated draws from account
balance directly, avoiding the cross-margin pool issue). Do NOT pass posSide
for one-way accounts — OKX rejects 'net' as an invalid value for isolated mode:
    open:  {'tdMode': 'isolated'}
    close: {'tdMode': 'isolated', 'reduceOnly': True}

Spot markets use quoteOrderQty to spend a fixed USDT amount.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, Optional

import ccxt

from app.models.exchange import UserExchange

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exchange factory
# ---------------------------------------------------------------------------

def build_authenticated_exchange(user_exchange: UserExchange) -> ccxt.Exchange:
    """Return an initialised, authenticated CCXT exchange instance."""
    exchange_cls = getattr(ccxt, user_exchange.exchange_id, None)
    if exchange_cls is None:
        raise ValueError(f"Unsupported exchange: {user_exchange.exchange_id}")

    client: ccxt.Exchange = exchange_cls({
        "enableRateLimit": True,
        "apiKey": user_exchange.api_key,
        "secret": user_exchange.api_secret,
        "password": user_exchange.passphrase or "",
    })
    return client


# ---------------------------------------------------------------------------
# Amount calculation helpers
# ---------------------------------------------------------------------------

def _calc_swap_contracts(
    exchange: ccxt.Exchange,
    symbol: str,
    usdt_margin: float,
    leverage: int,
    entry_price: float,
) -> tuple[float, bool]:
    """
    Return (contracts, skipped).

    skipped=True if the calculated contracts are below the exchange minimum.
    """
    try:
        market = exchange.market(symbol)
    except Exception:
        exchange.load_markets()
        market = exchange.market(symbol)

    contract_size: float = float(market.get("contractSize") or 1.0)
    min_amount: float = float(market.get("limits", {}).get("amount", {}).get("min") or 1.0)
    amount_precision: int = int(market.get("precision", {}).get("amount") or 0)

    # Calculate lot granularity from precision
    lot = 10 ** (-amount_precision) if amount_precision > 0 else 1.0

    position_value = usdt_margin * leverage
    base_amount = position_value / entry_price
    raw_contracts = base_amount / contract_size

    # Round DOWN to lot size
    contracts = math.floor(raw_contracts / lot) * lot
    contracts = round(contracts, amount_precision)

    log.info(
        "Swap %s: margin=%.2f lev=%d price=%.6f contract_size=%.4f → "
        "%.4f raw contracts → %.4f (min=%.4f lot=%.6f)",
        symbol, usdt_margin, leverage, entry_price, contract_size,
        raw_contracts, contracts, min_amount, lot,
    )

    if contracts < min_amount:
        log.warning(
            "Swap %s: calculated %.6f contracts < min %.6f — skipping",
            symbol, contracts, min_amount,
        )
        return contracts, True

    return contracts, False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def open_long_position(
    exchange: ccxt.Exchange,
    symbol: str,
    usdt_margin: float,
    leverage: int,
    market_type: str,  # "spot" | "swap"
) -> Dict[str, Any]:
    """
    Open a long position on the exchange.

    Returns a dict with:
        order_id      — exchange order ID (str)
        filled_price  — average fill price (float)
        contracts     — contracts / base amount placed
        skipped       — True if order was not placed (below min size)
        error         — error message if order failed (None if success)
    """
    result: Dict[str, Any] = {
        "order_id": None,
        "filled_price": None,
        "contracts": None,
        "skipped": False,
        "error": None,
    }

    try:
        if market_type == "swap":
            # Use isolated margin — draws from account balance directly.
            # Cross margin requires a separate margin pool which may be empty.
            try:
                exchange.set_leverage(
                    leverage, symbol,
                    {"mgnMode": "isolated"},
                )
            except Exception as exc:
                log.warning("Could not set leverage for %s: %s", symbol, exc)

            # Fetch current price for contract calculation
            ticker = exchange.fetch_ticker(symbol)
            entry_price = float(ticker["last"] or ticker["close"])

            contracts, skipped = _calc_swap_contracts(
                exchange, symbol, usdt_margin, leverage, entry_price
            )
            if skipped:
                result["skipped"] = True
                result["contracts"] = contracts
                return result

            order = exchange.create_order(
                symbol, "market", "buy", contracts, None,
                params={"tdMode": "isolated"},
            )

        else:  # spot
            # Buy with a fixed USDT amount
            order = exchange.create_market_buy_order(
                symbol,
                None,
                params={"quoteOrderQty": usdt_margin},
            )

        result["order_id"] = str(order.get("id", ""))
        result["filled_price"] = float(order.get("average") or order.get("price") or 0.0)
        result["contracts"] = float(order.get("filled") or order.get("amount") or 0.0)

    except Exception as exc:
        log.exception("open_long_position failed for %s: %s", symbol, exc)
        result["error"] = str(exc)
        result["skipped"] = True

    return result


def close_long_position(
    exchange: ccxt.Exchange,
    symbol: str,
    contracts: float,
    market_type: str,  # "spot" | "swap"
) -> Dict[str, Any]:
    """
    Close a long position on the exchange.

    Returns a dict with:
        order_id     — exchange order ID
        filled_price — average fill price
        error        — error message if failed
    """
    result: Dict[str, Any] = {
        "order_id": None,
        "filled_price": None,
        "error": None,
    }

    try:
        if market_type == "swap":
            order = exchange.create_order(
                symbol, "market", "sell", contracts, None,
                params={"tdMode": "isolated", "reduceOnly": True},
            )
        else:
            order = exchange.create_market_sell_order(symbol, contracts)

        result["order_id"] = str(order.get("id", ""))
        result["filled_price"] = float(order.get("average") or order.get("price") or 0.0)

    except Exception as exc:
        log.exception("close_long_position failed for %s: %s", symbol, exc)
        result["error"] = str(exc)

    return result


def get_open_position_size(
    exchange: ccxt.Exchange,
    symbol: str,
) -> Optional[float]:
    """
    Query the exchange for the current open long position size (in contracts/base).
    Returns None if no position or on error.
    """
    try:
        positions = exchange.fetch_positions([symbol])
        for pos in positions:
            side = (pos.get("side") or "").lower()
            contracts = float(pos.get("contracts") or pos.get("size") or 0.0)
            if side == "long" and contracts > 0:
                return contracts
        return None
    except Exception as exc:
        log.warning("get_open_position_size failed for %s: %s", symbol, exc)
        return None
