"""add user_exchange_id and selected_symbols to strategy_workers

Revision ID: 0008_worker_exchange_and_symbols
Revises: 7b98480c841f
Create Date: 2026-04-25 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_worker_exchange_and_symbols"
down_revision: Union[str, None] = "7b98480c841f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "strategy_workers",
        sa.Column("user_exchange_id", sa.Integer(), sa.ForeignKey("user_exchanges.id"), nullable=True),
    )
    op.add_column(
        "strategy_workers",
        sa.Column("selected_symbols", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("strategy_workers", "selected_symbols")
    op.drop_column("strategy_workers", "user_exchange_id")
