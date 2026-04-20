import random
import string
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserResponse
from app.services.mlm import _get_or_create_referral

router = APIRouter(prefix="/auth", tags=["auth"])


def _generate_unique_referral_code(db: Session) -> str:
    while True:
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not db.query(User).filter(User.referral_code == code).first():
            return code


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    referred_by_id = None
    if payload.referral_code:
        referrer = db.query(User).filter(User.referral_code == payload.referral_code).first()
        if referrer is None:
            raise HTTPException(status_code=400, detail="Invalid referral code")
        referred_by_id = referrer.id

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=get_password_hash(payload.password),
        referral_code=_generate_unique_referral_code(db),
        referred_by=referred_by_id,
        is_admin=(
            bool(settings.ADMIN_EMAIL)
            and payload.email.strip().lower() == settings.ADMIN_EMAIL.strip().lower()
        ),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Build referral records for all 3 levels
    if referred_by_id:
        from app.services.mlm import get_referral_chain, LEVEL_RATES
        # Level 1: direct referrer already known; build chain from new user's perspective
        chain = get_referral_chain(user.id, db)
        for referrer_user_id, level in chain:
            _get_or_create_referral(referrer_user_id, user.id, level, db)
        db.commit()

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
