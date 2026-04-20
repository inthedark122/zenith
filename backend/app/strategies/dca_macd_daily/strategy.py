"""
MACD D1 (Daily) trading strategy implementation.

Strategy rules:
  - Supported symbols : BTC/USDT, ETH/USDT, HYPE/USDT
  - Timeframe         : D1 for entry signal; 15m for recovery (2nd entry)
  - Direction         : LONG on bullish D1 MACD crossover,
                        SHORT on bearish D1 MACD crossover
  - Entry signal      : D1 MACD crossover detected at candle close;
                        entered at the OPEN of the following candle
  - Risk / Reward     : 1 : 2  (risk 100 % of margin, target 200 %)
  - Stop loss         : entry moves against by (1 / leverage)  → −100 % margin
  - Take profit       : entry moves in favour by (rr_ratio / leverage) → +200 % margin
  - Daily limits      :
      * Max 2 trades per symbol per calendar day
      * After 2 entries (any combination of win/loss) → no more trades that day
      * Released margin (closed trade) may be re-deployed on the 2nd entry
  - Max daily margin  : 2 × margin_per_trade per symbol
"""

import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_DOWN
from typing import Any, List, Optional, Tuple

# ---------------------------------------------------------------------------
# EMA / MACD helpers (pure Python — no external TA library needed)
# ---------------------------------------------------------------------------

def _ema(prices: List[float], period: int) -> List[float]:
    """Return the Exponential Moving Average series for the given period."""
    if len(prices) < period:
        return []
    k = 2.0 / (period + 1)
    ema_values: List[float] = []
    # Seed with the simple average of the first `period` prices
    seed = sum(prices[:period]) / period
    ema_values.append(seed)
    for price in prices[period:]:
        ema_values.append(price * k + ema_values[-1] * (1 - k))
    return ema_values


def calculate_macd(
    closes: List[float],
    fast: int = 12,
    slow: int = 26,
    signal_period: int = 9,
) -> Tuple[List[float], List[float], List[float]]:
    """
    Calculate MACD line, signal line and histogram.

    Returns (macd_line, signal_line, histogram).  All lists are aligned to the
    *same* index — the shortest valid range across all three series.
    """
    ema_fast = _ema(closes, fast)
    ema_slow = _ema(closes, slow)

    # EMA series start at different offsets; align them
    offset = slow - fast            # ema_slow is shorter by (slow-fast) values
    ema_fast_aligned = ema_fast[offset:]  # trim head of fast EMA to match slow

    macd_line = [f - s for f, s in zip(ema_fast_aligned, ema_slow)]

    signal_line = _ema(macd_line, signal_period)

    # Align macd_line to the length of signal_line
    trim = len(macd_line) - len(signal_line)
    macd_trimmed = macd_line[trim:]

    histogram = [m - s for m, s in zip(macd_trimmed, signal_line)]

    return macd_trimmed, signal_line, histogram


@dataclass
class MACDSignal:
    macd: float
    signal: float
    histogram: float
    prev_macd: float
    prev_signal: float
    is_bullish_crossover: bool      # MACD crossed above signal on the last candle
    is_bearish_crossover: bool      # MACD crossed below signal on the last candle


def get_macd_signal(closes: List[float]) -> Optional[MACDSignal]:
    """
    Analyse the closes list (D1 candles, oldest first) and return a MACDSignal.
    Returns None when there are not enough candles to compute MACD.
    """
    macd_line, signal_line, histogram = calculate_macd(closes)
    if len(macd_line) < 2:
        return None

    prev_macd   = macd_line[-2]
    prev_signal = signal_line[-2]
    curr_macd   = macd_line[-1]
    curr_signal = signal_line[-1]

    is_bullish = prev_macd < prev_signal and curr_macd >= curr_signal
    is_bearish = prev_macd > prev_signal and curr_macd <= curr_signal

    return MACDSignal(
        macd=curr_macd,
        signal=curr_signal,
        histogram=histogram[-1],
        prev_macd=prev_macd,
        prev_signal=prev_signal,
        is_bullish_crossover=is_bullish,
        is_bearish_crossover=is_bearish,
    )


# ---------------------------------------------------------------------------
# Position sizing helpers
# ---------------------------------------------------------------------------

def calculate_take_profit(
    entry_price: float,
    margin: float,
    leverage: float,
    rr_ratio: float = 2.0,
    side: str = "long",
) -> float:
    """
    Return the take-profit price.

    Position size = margin × leverage
    Target profit = margin × rr_ratio
    Price move    = target_profit / position_size = rr_ratio / leverage

    LONG : TP = entry × (1 + rr_ratio / leverage)
    SHORT: TP = entry × (1 − rr_ratio / leverage)
    """
    move_pct = rr_ratio / leverage
    if side == "long":
        return round(entry_price * (1 + move_pct), 8)
    return round(entry_price * (1 - move_pct), 8)


def calculate_stop_loss(
    entry_price: float,
    margin: float,
    leverage: float,
    side: str = "long",
) -> float:
    """
    Return the stop-loss price.

    Stop loss = 100 % of margin → price moves against by (1 / leverage).

    LONG : SL = entry × (1 − 1 / leverage)
    SHORT: SL = entry × (1 + 1 / leverage)
    """
    sl_pct = 1.0 / leverage
    if side == "long":
        return round(entry_price * (1 - sl_pct), 8)
    return round(entry_price * (1 + sl_pct), 8)


# ---------------------------------------------------------------------------
# Daily trade limit enforcement
# ---------------------------------------------------------------------------

@dataclass
class DailyTradeStatus:
    trades_today: int           # number of MACD trades already opened today
    can_open_trade: bool        # whether a new trade may be opened
    next_entry_number: int      # 1 or 2 (2 = recovery / follow-up entry)
    reason: str                 # human-readable explanation


def check_daily_trade_status(
    trades_today_results: List[Optional[str]],
) -> DailyTradeStatus:
    """
    Determine whether a new MACD trade can be opened today.

    ``trades_today_results`` should be the list of 'result' values for all
    MACD trades opened today, in chronological order.  Allowed result values:
    'open', 'win', 'loss'.

    Rules:
      - No trades today        → can open entry #1
      - 1 trade, still open    → cannot open (first trade not yet resolved)
      - 1 trade, result=win    → can open entry #2 (follow-up)
      - 1 trade, result=loss   → can open entry #2 (recovery on 15 m)
      - 2+ trades today        → no more trades (daily limit reached)
    """
    n = len(trades_today_results)

    if n == 0:
        return DailyTradeStatus(
            trades_today=0,
            can_open_trade=True,
            next_entry_number=1,
            reason="No trades today — entry #1 available",
        )

    if n == 1:
        result = trades_today_results[0]
        if result == "open":
            return DailyTradeStatus(
                trades_today=1,
                can_open_trade=False,
                next_entry_number=2,
                reason="First trade still open — close it before opening entry #2",
            )
        if result in ("win", "loss", "closed"):
            # "closed" means force-stopped by the user; treated as a completed entry
            if result == "win":
                label = "follow-up"
            elif result == "loss":
                label = "recovery (15 m correction)"
            else:
                label = "recovery (15 m correction) — previous trade was force-closed"
            return DailyTradeStatus(
                trades_today=1,
                can_open_trade=True,
                next_entry_number=2,
                reason=f"Entry #1 {result} — {label} entry #2 available",
            )

    # 2 or more trades have been opened today
    return DailyTradeStatus(
        trades_today=n,
        can_open_trade=False,
        next_entry_number=3,
        reason="Daily trade limit reached (max 2 entries per day)",
    )


# ---------------------------------------------------------------------------
# LRU signal cache
# Stores MACD signals keyed by (exchange, symbol, strategy, timeframe).
# Each strategy module keeps its own cache instance.
# ---------------------------------------------------------------------------

_CacheKey = Tuple[str, str, str, str]
_CacheEntry = Tuple[Optional[MACDSignal], float]  # (signal, unix_timestamp)


class SignalCache:
    """Thread-safe LRU cache with TTL for MACD signals.

    Key: (exchange_id, symbol, strategy_name, timeframe)
    """

    def __init__(self, maxsize: int = 128, ttl: int = 300) -> None:
        self._cache: OrderedDict[_CacheKey, _CacheEntry] = OrderedDict()
        self.maxsize = maxsize
        self.ttl = ttl
        self._lock = threading.Lock()

    def get(
        self, exchange: str, symbol: str, strategy: str, timeframe: str
    ) -> Optional["MACDSignal"]:
        key: _CacheKey = (exchange, symbol, strategy, timeframe)
        with self._lock:
            if key not in self._cache:
                return None
            value, ts = self._cache[key]
            if time.time() - ts > self.ttl:
                del self._cache[key]
                return None
            self._cache.move_to_end(key)
            return value

    def set(
        self,
        exchange: str,
        symbol: str,
        strategy: str,
        timeframe: str,
        signal: Optional["MACDSignal"],
    ) -> None:
        key: _CacheKey = (exchange, symbol, strategy, timeframe)
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = (signal, time.time())
            while len(self._cache) > self.maxsize:
                self._cache.popitem(last=False)


# Module-level cache instance used by the DCA_MACD_DAILY strategy
STRATEGY_NAME = "DCA_MACD_DAILY"
signal_cache = SignalCache(maxsize=128, ttl=300)
