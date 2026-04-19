"""Initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-19 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------ users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("referral_code", sa.String(length=6), nullable=False),
        sa.Column("referred_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("is_admin", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_referral_code", "users", ["referral_code"], unique=True)

    # --------------------------------------------------------------- wallets
    op.create_table(
        "wallets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("currency", sa.String(), nullable=True),
        sa.Column("balance", sa.Numeric(20, 8), nullable=True),
        sa.Column("deposit_address", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_wallets_id", "wallets", ["id"], unique=False)
    op.create_index("ix_wallets_deposit_address", "wallets", ["deposit_address"], unique=True)

    # ----------------------------------------------------------- transactions
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("wallet_id", sa.Integer(), sa.ForeignKey("wallets.id"), nullable=False),
        sa.Column("tx_hash", sa.String(), nullable=True),
        sa.Column("amount", sa.Numeric(20, 8), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transactions_id", "transactions", ["id"], unique=False)
    op.create_index("ix_transactions_tx_hash", "transactions", ["tx_hash"], unique=False)

    # --------------------------------------------------------- subscriptions
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan", sa.String(), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("coins", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("plan IN ('starter', 'trader', 'pro')", name="ck_subscription_plan"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subscriptions_id", "subscriptions", ["id"], unique=False)

    # --------------------------------------------------------------- referrals
    op.create_table(
        "referrals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("referrer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("referred_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("commission_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("commission_earned", sa.Numeric(20, 8), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("referred_id"),
    )
    op.create_index("ix_referrals_id", "referrals", ["id"], unique=False)

    # -------------------------------------------------- commission_payments
    op.create_table(
        "commission_payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("referral_id", sa.Integer(), sa.ForeignKey("referrals.id"), nullable=False),
        sa.Column("subscription_id", sa.Integer(), sa.ForeignKey("subscriptions.id"), nullable=False),
        sa.Column("amount", sa.Numeric(20, 8), nullable=False),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_commission_payments_id", "commission_payments", ["id"], unique=False)

    # -------------------------------------------------------- user_exchanges
    op.create_table(
        "user_exchanges",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("exchange_id", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("api_key", sa.String(), nullable=False),
        sa.Column("api_secret", sa.String(), nullable=False),
        sa.Column("passphrase", sa.String(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "exchange_id", name="uq_user_exchange"),
    )
    op.create_index("ix_user_exchanges_id", "user_exchanges", ["id"], unique=False)

    # ----------------------------------------------------------- strategies
    op.create_table(
        "strategies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("strategy", sa.String(), nullable=False),
        sa.Column("symbols", sa.JSON(), nullable=False),
        sa.Column("leverage", sa.Float(), nullable=False),
        sa.Column("rr_ratio", sa.Float(), nullable=False),
        sa.Column("settings", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_strategies_id", "strategies", ["id"], unique=False)

    # ------------------------------------------------------ strategy_workers
    op.create_table(
        "strategy_workers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("strategy_id", sa.Integer(), sa.ForeignKey("strategies.id"), nullable=False),
        sa.Column("margin", sa.Numeric(18, 8), nullable=False),
        sa.Column("exchange_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("stopped_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_strategy_workers_id", "strategy_workers", ["id"], unique=False)

    # ------------------------------------------------------- strategy_trades
    op.create_table(
        "strategy_trades",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("worker_id", sa.Integer(), sa.ForeignKey("strategy_workers.id"), nullable=True),
        sa.Column("strategy_id", sa.Integer(), sa.ForeignKey("strategies.id"), nullable=True),
        sa.Column("symbol", sa.String(), nullable=False),
        sa.Column("exchange", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("trade_date", sa.Date(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_strategy_trades_id", "strategy_trades", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_strategy_trades_id", table_name="strategy_trades")
    op.drop_table("strategy_trades")

    op.drop_index("ix_strategy_workers_id", table_name="strategy_workers")
    op.drop_table("strategy_workers")

    op.drop_index("ix_strategies_id", table_name="strategies")
    op.drop_table("strategies")

    op.drop_index("ix_user_exchanges_id", table_name="user_exchanges")
    op.drop_table("user_exchanges")

    op.drop_index("ix_commission_payments_id", table_name="commission_payments")
    op.drop_table("commission_payments")

    op.drop_index("ix_referrals_id", table_name="referrals")
    op.drop_table("referrals")

    op.drop_index("ix_subscriptions_id", table_name="subscriptions")
    op.drop_table("subscriptions")

    op.drop_index("ix_transactions_tx_hash", table_name="transactions")
    op.drop_index("ix_transactions_id", table_name="transactions")
    op.drop_table("transactions")

    op.drop_index("ix_wallets_deposit_address", table_name="wallets")
    op.drop_index("ix_wallets_id", table_name="wallets")
    op.drop_table("wallets")

    op.drop_index("ix_users_referral_code", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
