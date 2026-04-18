"""
Exchange service wrapping ccxt.

Each ``ExchangeService`` instance represents one exchange connection.
Use the class-method constructors:

    ExchangeService.default()                    — unauthenticated OKX
    ExchangeService.from_user_exchange(row)      — authenticated from DB row
    ExchangeService(exchange_id, api_key, ...)   — explicit credentials

OKX supports public OHLCV / ticker endpoints without credentials.
"""
from typing import Any, Dict, List, Optional

import ccxt


class ExchangeService:
    def __init__(
        self,
        exchange_id: str = "okx",
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        passphrase: str = "",
    ) -> None:
        if not hasattr(ccxt, exchange_id):
            raise ValueError(f"Unsupported exchange: {exchange_id}")
        exchange_class = getattr(ccxt, exchange_id)
        config: Dict[str, Any] = {"enableRateLimit": True}
        if api_key:
            config["apiKey"] = api_key
            config["secret"] = api_secret
            config["password"] = passphrase
        self.exchange: ccxt.Exchange = exchange_class(config)
        self.exchange_id = exchange_id

    # ------------------------------------------------------------------
    # Constructors
    # ------------------------------------------------------------------

    @classmethod
    def default(cls) -> "ExchangeService":
        """Unauthenticated OKX instance for public market-data calls."""
        return cls(exchange_id="okx")

    @classmethod
    def from_user_exchange(cls, user_exchange) -> "ExchangeService":
        """Build an authenticated instance from a UserExchange ORM row."""
        return cls(
            exchange_id=user_exchange.exchange_id,
            api_key=user_exchange.api_key,
            api_secret=user_exchange.api_secret,
            passphrase=user_exchange.passphrase or "",
        )

    # ------------------------------------------------------------------
    # Market data
    # ------------------------------------------------------------------

    def fetch_ohlcv(
        self, symbol: str, timeframe: str = "1d", limit: int = 60
    ) -> List[List[Any]]:
        """Fetch OHLCV candles for the given symbol and timeframe."""
        return self.exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)

    def fetch_ticker(self, symbol: str) -> Dict[str, Any]:
        """
        Fetch ticker data for a symbol.
        Returns dict with keys: symbol, last, bid, ask, high, low, volume, timestamp.
        """
        ticker = self.exchange.fetch_ticker(symbol)
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

    # ------------------------------------------------------------------
    # Account / orders
    # ------------------------------------------------------------------

    def get_balance(self, currency: str = "USDT") -> float:
        """Return the free balance for the given currency."""
        balance = self.exchange.fetch_balance()
        return balance.get("free", {}).get(currency, 0.0)

    def place_order(
        self,
        symbol: str,
        order_type: str,
        side: str,
        amount: float,
        price: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Place an order on the exchange.  price is required for limit orders."""
        if order_type == "limit" and price is None:
            raise ValueError("Price is required for limit orders")
        return self.exchange.create_order(
            symbol=symbol,
            type=order_type,
            side=side,
            amount=amount,
            price=price,
        )

    def get_open_orders(self, symbol: str) -> list:
        """Return all open orders for a symbol."""
        return self.exchange.fetch_open_orders(symbol)

    def cancel_order(self, order_id: str, symbol: str) -> Dict[str, Any]:
        """Cancel an open order."""
        return self.exchange.cancel_order(order_id, symbol)

