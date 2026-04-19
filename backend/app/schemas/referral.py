from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class ReferralResponse(BaseModel):
    id: int
    referrer_id: int
    referred_id: int
    level: int
    commission_rate: Decimal
    commission_earned: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


class CommissionResponse(BaseModel):
    id: int
    referral_id: int
    subscription_id: int
    amount: Decimal
    paid_at: datetime

    model_config = {"from_attributes": True}


class MLMMemberNode(BaseModel):
    user_id: int
    username: str
    level: int
    commission_earned: Decimal
    children: List["MLMMemberNode"] = []


class MLMTreeResponse(BaseModel):
    root_user_id: int
    total_commission: Decimal
    members: List[MLMMemberNode]
