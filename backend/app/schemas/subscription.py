from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, field_validator


class SubscriptionPlan(int, Enum):
    ONE_COIN = 1
    TWO_COINS = 2
    THREE_COINS = 3


PLAN_PRICES = {1: Decimal("15.00"), 2: Decimal("20.00"), 3: Decimal("25.00")}


class SubscriptionCreate(BaseModel):
    plan: SubscriptionPlan
    coins: List[str]

    @field_validator("coins")
    @classmethod
    def validate_coins_length(cls, v, info):
        plan = info.data.get("plan")
        if plan and len(v) != int(plan):
            raise ValueError(f"Plan {plan} requires exactly {int(plan)} coin(s)")
        return v


class SubscriptionResponse(BaseModel):
    id: int
    user_id: int
    plan: int
    price: Decimal
    status: str
    started_at: Optional[datetime]
    expires_at: Optional[datetime]
    coins: List[str]
    created_at: datetime

    model_config = {"from_attributes": True}
