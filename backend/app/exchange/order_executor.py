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

Hedge-mode detection
--------------------
Per-exchange adapters (`app/exchange/adapters/`) detect the account's position
mode once on first use and cache the result by API key for the lifetime of the
process.  When the adapter detects a mode-mismatch error (e.g. OKX 51000), the
cache entry is invalidated so the next poll cycle re-detects automatically.

    net mode  → no posSide / positionSide needed
    hedge mode → adapter injects the correct side params (e.g. posSide="long")

Spot markets use quoteOrderQty to spend a fixed USDT amount.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, Optional

import ccxt

from app.exchange.adapters import get_adapter
from app.models.exchange import UserExchange

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Hedge-mode cache  {api_key: is_hedge_mode}
# ---------------------------------------------------------------------------

_hedge_cache: Dict[str, bool] = {}


def _get_hedge_mode(exchange: ccxt.Exchange) -> bool:
    """Return cached hedge-mode flag, detecting from exchange on first call."""
    key = exchange.apiKey
    if key not in _hedge_cache:
        adapter = get_adapter(exchange.id)
        is_hedge = adapter.detect_hedge_mode(exchange)
        _hedge_cache[key] = is_hedge
        log.info(
            "[%s] Position mode detected: %s",
            exchange.id,
            "hedge (long/short)" if is_hedge else "net (one-way)",
        )
    return _hedge_cache[key]


def _clear_hedge_mode(exchange: ccxt.Exchange) -> None:
    """Invalidate the cached hedge-mode for *exchange* so it is re-detected next cycle."""
    removed = _hedge_cache.pop(exchange.apiKey, None)
    if removed is not None:
        log.warning(
            "[%s] Hedge-mode cache invalidated — will re-detect on next cycle",
            exchange.id,
        )


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
    if getattr(user_exchange, "is_demo", False):
        client.set_sandbox_mode(True)
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
    # Reserve a small buffer for taker fees (typically 0.05–0.1% of notional).
    # Without this, margin + fee > available balance and OKX rejects the order.
    try:
        fee_rate = float(
            exchange.fees.get("trading", {}).get("taker", 0.001)
        )
    except Exception:
        fee_rate = 0.001
    fee_buffer = 1.0 / (1.0 + fee_rate * leverage)
    position_value *= fee_buffer
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
            adapter = get_adapter(exchange.id)
            is_hedge = _get_hedge_mode(exchange)

            # Use isolated margin — draws from account balance directly.
            # Cross margin requires a separate margin pool which may be empty.
            try:
                exchange.set_leverage(
                    leverage, symbol,
                    adapter.set_leverage_params(is_hedge),
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
                params=adapter.open_swap_params(is_hedge),
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
        if market_type == "swap":
            adapter = get_adapter(exchange.id)
            if adapter.is_pos_mode_error(exc):
                _clear_hedge_mode(exchange)
                log.warning(
                    "[%s] Position mode mismatch on open — cache cleared, "
                    "will re-detect next cycle",
                    exchange.id,
                )
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
            adapter = get_adapter(exchange.id)
            is_hedge = _get_hedge_mode(exchange)
            order = exchange.create_order(
                symbol, "market", "sell", contracts, None,
                params=adapter.close_swap_params(is_hedge),
            )
        else:
            order = exchange.create_market_sell_order(symbol, contracts)

        result["order_id"] = str(order.get("id", ""))
        result["filled_price"] = float(order.get("average") or order.get("price") or 0.0)

    except Exception as exc:
        if market_type == "swap":
            adapter = get_adapter(exchange.id)
            if adapter.is_pos_mode_error(exc):
                _clear_hedge_mode(exchange)
                log.warning(
                    "[%s] Position mode mismatch on close — cache cleared, "
                    "will re-detect next cycle",
                    exchange.id,
                )
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


def place_limit_buy(
    exchange: ccxt.Exchange,
    symbol: str,
    usdt_margin: float,
    leverage: int,
    market_type: str,  # "spot" | "swap"
    limit_price: float,
) -> Dict[str, Any]:
    """
    Place a limit buy order at *limit_price*.

    Returns a dict with:
        order_id   — exchange order ID (str)
        contracts  — contracts / base amount ordered
        skipped    — True if order was not placed (below min size or error)
        error      — error message if order failed (None if success)
    """
    result: Dict[str, Any] = {
        "order_id": None,
        "contracts": None,
        "skipped": False,
        "error": None,
    }

    try:
        if market_type == "swap":
            adapter = get_adapter(exchange.id)
            is_hedge = _get_hedge_mode(exchange)

            contracts, skipped = _calc_swap_contracts(
                exchange, symbol, usdt_margin, leverage, limit_price
            )
            if skipped:
                result["skipped"] = True
                result["contracts"] = contracts
                return result

            order = exchange.create_order(
                symbol, "limit", "buy", contracts, limit_price,
                params=adapter.open_swap_params(is_hedge),
            )
        else:
            # Spot: buy base amount at limit price, funded by usdt_margin
            amount = usdt_margin / limit_price
            order = exchange.create_order(
                symbol, "limit", "buy", amount, limit_price,
            )
            contracts = amount

        result["order_id"] = str(order.get("id", ""))
        result["contracts"] = float(order.get("amount") or contracts)

    except Exception as exc:
        if market_type == "swap":
            adapter = get_adapter(exchange.id)
            if adapter.is_pos_mode_error(exc):
                _clear_hedge_mode(exchange)
        log.exception("place_limit_buy failed for %s @ %.8f: %s", symbol, limit_price, exc)
        result["error"] = str(exc)
        result["skipped"] = True

    return result


def place_limit_sell_close(
    exchange: ccxt.Exchange,
    symbol: str,
    contracts: float,
    limit_price: float,
    market_type: str,  # "spot" | "swap"
) -> Dict[str, Any]:
    """
    Place a limit sell order to close a long position (TP order).

    Returns a dict with:
        order_id — exchange order ID (str)
        error    — error message if failed (None if success)
    """
    result: Dict[str, Any] = {
        "order_id": None,
        "error": None,
    }

    try:
        if market_type == "swap":
            adapter = get_adapter(exchange.id)
            is_hedge = _get_hedge_mode(exchange)
            order = exchange.create_order(
                symbol, "limit", "sell", contracts, limit_price,
                params=adapter.close_swap_params(is_hedge),
            )
        else:
            order = exchange.create_order(
                symbol, "limit", "sell", contracts, limit_price,
            )

        result["order_id"] = str(order.get("id", ""))

    except Exception as exc:
        if market_type == "swap":
            adapter = get_adapter(exchange.id)
            if adapter.is_pos_mode_error(exc):
                _clear_hedge_mode(exchange)
        log.exception(
            "place_limit_sell_close failed for %s %.6f @ %.8f: %s",
            symbol, contracts, limit_price, exc,
        )
        result["error"] = str(exc)

    return result


def fetch_order_status(
    exchange: ccxt.Exchange,
    symbol: str,
    order_id: str,
) -> str:
    """
    Fetch the status of an order.

    Returns one of: "filled", "open", "cancelled", "unknown".
    CCXT normalizes OKX status: live/partially_filled → "open", filled → "closed".
    """
    try:
        order = exchange.fetch_order(order_id, symbol)
        raw_status = (order.get("status") or "").lower()
        if raw_status == "closed":
            return "filled"
        elif raw_status in ("canceled", "cancelled", "expired"):
            return "cancelled"
        elif raw_status == "open":
            return "open"
        else:
            return "unknown"
    except Exception as exc:
        log.warning(
            "fetch_order_status failed for order %s [%s]: %s",
            order_id, symbol, exc,
        )
        return "unknown"


def cancel_limit_order(
    exchange: ccxt.Exchange,
    symbol: str,
    order_id: str,
) -> bool:
    """
    Cancel a specific order. Returns True on success, False on failure.
    Already-filled or already-cancelled orders are treated as success.
    """
    try:
        exchange.cancel_order(order_id, symbol)
        log.info("cancel_limit_order: cancelled %s for %s", order_id, symbol)
        return True
    except Exception as exc:
        msg = str(exc).lower()
        # Treat "order already completed/cancelled" as success
        if any(k in msg for k in ("filled", "completed", "cancelled", "not exist", "not found")):
            log.info(
                "cancel_limit_order: order %s [%s] already closed — %s",
                order_id, symbol, exc,
            )
            return True
        log.warning(
            "cancel_limit_order failed for order %s [%s]: %s",
            order_id, symbol, exc,
        )
        return False


def liquidate_symbol(
    exchange: ccxt.Exchange,
    symbol: str,
    market_type: str,
    spot_contracts: float = 0.0,
) -> list[str]:
    """
    Cancel all open orders and close any open position for *symbol*.

    For swap markets the live position size is queried directly from the
    exchange so stale ``contracts`` values in the database are not relied on.
    For spot markets the caller must supply *spot_contracts* (sum of DB
    contract amounts for the symbol).

    Returns a list of non-fatal error strings (empty on full success).
    """
    errors: list[str] = []

    # ── 1. Cancel all open orders ─────────────────────────────────────────
    try:
        open_orders = exchange.fetch_open_orders(symbol)
        for order in open_orders:
            order_id = order.get("id")
            try:
                exchange.cancel_order(order_id, symbol)
                log.info("liquidate_symbol: cancelled order %s for %s", order_id, symbol)
            except Exception as exc:
                msg = f"cancel order {order_id}: {exc}"
                log.warning("liquidate_symbol [%s]: %s", symbol, msg)
                errors.append(msg)
    except Exception as exc:
        msg = f"fetch_open_orders: {exc}"
        log.warning("liquidate_symbol [%s]: %s", symbol, msg)
        errors.append(msg)

    # ── 2. Close open position ────────────────────────────────────────────
    if market_type == "swap":
        size = get_open_position_size(exchange, symbol) or 0.0
    else:
        size = spot_contracts

    if size > 0:
        result = close_long_position(exchange, symbol, size, market_type)
        if result["error"]:
            msg = f"close_position ({size}): {result['error']}"
            log.warning("liquidate_symbol [%s]: %s", symbol, msg)
            errors.append(msg)
        else:
            log.info(
                "liquidate_symbol: closed %s %.6f @ %.6f",
                symbol, size, result["filled_price"] or 0,
            )

    return errors
