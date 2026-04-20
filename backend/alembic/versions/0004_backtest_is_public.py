"""Add is_public to strategy_backtest_runs

Revision ID: 0004_backtest_is_public
Revises: 0003_role_and_backtest_runs
Create Date: 2026-04-20
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_backtest_is_public"
down_revision: Union[str, None] = "0003_role_and_backtest_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "strategy_backtest_runs",
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("strategy_backtest_runs", "is_public")
