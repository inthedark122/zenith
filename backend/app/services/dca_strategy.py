"""
DCA (Dollar-Cost Averaging) strategy implementation.

Default parameters (per spec):
  - Safety order multiplier : 2x  (each order uses 2× previous amount)
  - Price deviation         : 4%  (place next order when price drops 4%)
  - Max safety orders       : 6
"""

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_DOWN
from typing import List


@dataclass
class DCAOrder:
    order_number: int       # 0 = base order, 1..n = safety orders
    amount: Decimal
    target_price: Decimal
    total_invested: Decimal
    average_price: Decimal
    total_quantity: Decimal


def calculate_dca_orders(
    base_amount: float,
    current_price: float,
    multiplier: float = 2.0,
    deviation: float = 0.04,
    max_orders: int = 6,
) -> List[DCAOrder]:
    """
    Compute the full DCA order ladder.

    Returns a list of DCAOrder objects starting with the base order (index 0)
    followed by up to max_orders safety orders.
    """
    orders: List[DCAOrder] = []

    base_amt = Decimal(str(base_amount))
    price = Decimal(str(current_price))
    mult = Decimal(str(multiplier))
    dev = Decimal(str(deviation))

    total_invested = Decimal("0")
    total_quantity = Decimal("0")

    current_amount = base_amt
    current_price_level = price

    for i in range(max_orders + 1):
        quantity = (current_amount / current_price_level).quantize(
            Decimal("0.00000001"), rounding=ROUND_DOWN
        )
        total_invested += current_amount
        total_quantity += quantity
        avg_price = (total_invested / total_quantity).quantize(
            Decimal("0.00000001"), rounding=ROUND_DOWN
        )

        orders.append(
            DCAOrder(
                order_number=i,
                amount=current_amount.quantize(Decimal("0.01")),
                target_price=current_price_level.quantize(Decimal("0.00000001")),
                total_invested=total_invested.quantize(Decimal("0.01")),
                average_price=avg_price,
                total_quantity=total_quantity,
            )
        )

        # Prepare next safety order
        current_amount = current_amount * mult
        current_price_level = current_price_level * (Decimal("1") - dev)

    return orders


def check_should_place_safety_order(
    current_price: float,
    base_price: float,
    deviation: float = 0.04,
) -> bool:
    """
    Return True when the current price has dropped by at least `deviation`
    from the base price (i.e. the entry price of the previous order).
    """
    threshold = base_price * (1.0 - deviation)
    return current_price <= threshold


def calculate_average_price(orders: List[DCAOrder]) -> Decimal:
    """
    Given a list of already-placed DCAOrders, return the weighted average
    entry price across all of them.
    """
    if not orders:
        return Decimal("0")

    total_invested = sum((o.amount for o in orders), Decimal("0"))
    total_quantity = sum((o.total_quantity - (orders[i - 1].total_quantity if i > 0 else Decimal("0"))
                          for i, o in enumerate(orders)), Decimal("0"))

    # Re-derive per-order quantities for accuracy
    qty_list = []
    for i, o in enumerate(orders):
        if i == 0:
            qty_list.append(o.total_quantity)
        else:
            qty_list.append(o.total_quantity - orders[i - 1].total_quantity)

    total_qty = sum(qty_list, Decimal("0"))
    if total_qty == 0:
        return Decimal("0")

    weighted = sum(o.target_price * qty for o, qty in zip(orders, qty_list))
    return (weighted / total_qty).quantize(Decimal("0.00000001"), rounding=ROUND_DOWN)
