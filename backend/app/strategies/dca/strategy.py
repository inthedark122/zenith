"""
DCA strategy — pure helper functions.

A DCA (Dollar Cost Averaging) bot opens an initial order then places
progressively larger "safety orders" each time the price drops by
``step_percent`` from the previous entry.  All orders share a single
take-profit target set at the weighted-average entry price plus
``take_profit_percent``.

Settings (stored in Strategy.settings JSON):
    amount_multiplier   — each safety order is multiplier × previous amount  (default 2.0)
    step_percent        — price must drop this % from last entry to trigger safety order (default 0.5)
    max_orders          — maximum orders per DCA cycle including the initial (default 5)
    take_profit_percent — TP is set this % above the weighted average entry (default 1.0)
"""

from typing import List


STRATEGY_NAME = "DCA"


def calculate_avg_entry(entries: List[tuple[float, float]]) -> float:
    """
    Weighted average entry price.

    ``entries`` is a list of (entry_price, amount_usdt) tuples.
    """
    total_cost = sum(price * amount for price, amount in entries)
    total_amount = sum(amount for _, amount in entries)
    return total_cost / total_amount if total_amount > 0 else 0.0


def calculate_take_profit(avg_entry: float, take_profit_percent: float) -> float:
    """TP price = avg_entry × (1 + take_profit_percent / 100)."""
    return round(avg_entry * (1 + take_profit_percent / 100), 8)


def calculate_next_amount(prev_amount: float, multiplier: float) -> float:
    """Next safety order amount = previous × multiplier."""
    return round(prev_amount * multiplier, 8)


def calculate_base_order(total_margin: float, multiplier: float, max_orders: int) -> float:
    """
    Derive the base (first) order amount from the total DCA budget.

    The full budget is distributed across all orders proportionally:
        total_weight = 1 + m + m² + … + m^(max_orders-1)
        base_order   = total_margin / total_weight

    This ensures that if every order fires, the sum of all order amounts
    equals exactly ``total_margin``.
    """
    if max_orders <= 0:
        return total_margin
    total_weight = sum(multiplier ** i for i in range(max_orders))
    return total_margin / total_weight if total_weight > 0 else total_margin
