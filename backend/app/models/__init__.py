# Import all models here so SQLAlchemy can resolve cross-model relationships
# (e.g. UserExchange.user → User) regardless of which module imports first.
from app.models.user import User  # noqa: F401
from app.models.exchange import UserExchange  # noqa: F401
from app.models.validation_task import ExchangeValidationTask  # noqa: F401
from app.models.strategy import Strategy  # noqa: F401
from app.models.trade import StrategyTrade  # noqa: F401
from app.models.wallet import Wallet, Transaction  # noqa: F401
from app.models.referral import Referral, CommissionPayment  # noqa: F401
from app.models.subscription import Subscription  # noqa: F401
from app.models.backtest import StrategyBacktestRun  # noqa: F401
from app.models.worker import StrategyWorker  # noqa: F401
