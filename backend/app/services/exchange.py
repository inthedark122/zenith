"""
Exchange service wrapping ccxt for spot trading on OKX (and other exchanges).
"""
from typing import Any, Dict, Optional

import ccxt

from app.core.config import settings


class ExchangeService:
    def get_exchange(
        self,
        api_key: str,
        api_secret: str,
        passphrase: str,
        exchange_id: str = "okx",
    ) -> ccxt.Exchange:
        """Instantiate and return an authenticated ccxt exchange object."""
        exchange_class = getattr(ccxt, exchange_id)
        exchange: ccxt.Exchange = exchange_class(
            {
                "apiKey": api_key,
                "secret": api_secret,
                "password": passphrase,  # OKX uses 'password' as passphrase field
                "enableRateLimit": True,
                "options": {"defaultType": "spot"},
            }
        )
        return exchange

    def get_default_exchange(self) -> ccxt.Exchange:
        """Return an exchange authenticated with the server-level OKX credentials."""
        return self.get_exchange(
            api_key=settings.OKX_API_KEY,
            api_secret=settings.OKX_API_SECRET,
            passphrase=settings.OKX_PASSPHRASE,
        )

    def get_ticker(self, exchange: ccxt.Exchange, symbol: str) -> Dict[str, Any]:
        """
        Fetch ticker data for a symbol.
        Returns dict with keys: symbol, last, bid, ask, high, low, volume, timestamp.
        """
        ticker = exchange.fetch_ticker(symbol)
        return {
            "symbol": ticker["symbol"],
            "last": ticker["last"],
            "bid": ticker["bid"],
            "ask": ticker["ask"],
            "high": ticker["high"],
            "low": ticker["low"],
            "volume": ticker["baseVolume"],
            "timestamp": ticker["timestamp"],
        }

    def place_spot_order(
        self,
        exchange: ccxt.Exchange,
        symbol: str,
        order_type: str,   # "market" or "limit"
        side: str,         # "buy" or "sell"
        amount: float,
        price: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Place a spot order on the exchange.

        For limit orders, `price` is required.
        Returns the raw order dict from ccxt.
        """
        if order_type == "limit" and price is None:
            raise ValueError("Price is required for limit orders")

        order = exchange.create_order(
            symbol=symbol,
            type=order_type,
            side=side,
            amount=amount,
            price=price,
        )
        return order

    def get_balance(self, exchange: ccxt.Exchange, currency: str = "USDT") -> float:
        """Return the free balance for the given currency."""
        balance = exchange.fetch_balance()
        return balance.get("free", {}).get(currency, 0.0)

    def get_open_orders(self, exchange: ccxt.Exchange, symbol: str) -> list:
        """Return all open orders for a symbol."""
        return exchange.fetch_open_orders(symbol)

    def cancel_order(self, exchange: ccxt.Exchange, order_id: str, symbol: str) -> Dict[str, Any]:
        """Cancel an open order."""
        return exchange.cancel_order(order_id, symbol)


exchange_service = ExchangeService()
