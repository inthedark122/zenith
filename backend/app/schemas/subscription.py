from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, field_validator


class SubscriptionPlan(str, Enum):
    STARTER = "starter"   # 1 coin, $15
    TRADER = "trader"     # 2 coins, $20
    PRO = "pro"           # 3 coins, $25


PLAN_COINS = {
    SubscriptionPlan.STARTER: 1,
    SubscriptionPlan.TRADER: 2,
    SubscriptionPlan.PRO: 3,
}

PLAN_PRICES = {
    SubscriptionPlan.STARTER: Decimal("15.00"),
    SubscriptionPlan.TRADER: Decimal("20.00"),
    SubscriptionPlan.PRO: Decimal("25.00"),
}


class SubscriptionCreate(BaseModel):
    plan: SubscriptionPlan
    coins: List[str]

    @field_validator("coins")
    @classmethod
    def validate_coins_length(cls, v, info):
        plan = info.data.get("plan")
        if plan:
            expected = PLAN_COINS[plan]
            if len(v) != expected:
                raise ValueError(f"Plan '{plan}' requires exactly {expected} coin(s)")
        return v


class SubscriptionResponse(BaseModel):
    id: int
    user_id: int
    plan: str
    price: Decimal
    status: str
    started_at: Optional[datetime]
    expires_at: Optional[datetime]
    coins: List[str]
    created_at: datetime

    model_config = {"from_attributes": True}

