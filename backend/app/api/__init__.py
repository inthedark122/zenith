from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.referral import router as referral_router
from app.api.subscriptions import router as subscriptions_router
from app.api.trading import router as trading_router
from app.api.wallet import router as wallet_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(subscriptions_router)
api_router.include_router(wallet_router)
api_router.include_router(trading_router)
api_router.include_router(referral_router)
