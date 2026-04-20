"""Add strategy backtest fields

Revision ID: 0002_strategy_backtest_fields
Revises: 0001_initial
Create Date: 2026-04-20 11:25:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_strategy_backtest_fields"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("strategies", sa.Column("backtest_summary", sa.JSON(), nullable=True))
    op.add_column("strategies", sa.Column("backtest_updated_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("strategies", "backtest_updated_at")
    op.drop_column("strategies", "backtest_summary")
