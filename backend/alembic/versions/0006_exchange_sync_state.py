"""Add exchange sync state: status + cached balance + validation tasks table

Revision ID: 0006_exchange_sync_state
Revises: 0005_symbols_with_market_type
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_exchange_sync_state"
down_revision: Union[str, None] = "0005_symbols_with_market_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add sync-state columns to user_exchanges
    op.add_column("user_exchanges", sa.Column("status", sa.String(), nullable=False, server_default="pending"))
    op.add_column("user_exchanges", sa.Column("balance_usdt_free", sa.Float(), nullable=True))
    op.add_column("user_exchanges", sa.Column("balance_usdt_total", sa.Float(), nullable=True))
    op.add_column("user_exchanges", sa.Column("balance_updated_at", sa.DateTime(), nullable=True))

    # Create exchange_validation_tasks table
    op.create_table(
        "exchange_validation_tasks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("exchange_id", sa.String(), nullable=False),
        sa.Column("api_key", sa.String(), nullable=False),
        sa.Column("api_secret", sa.String(), nullable=False),
        sa.Column("passphrase", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="processing"),
        sa.Column("result_ok", sa.Boolean(), nullable=True),
        sa.Column("result_balance", sa.Float(), nullable=True),
        sa.Column("result_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_exchange_validation_tasks_status_created",
        "exchange_validation_tasks",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_exchange_validation_tasks_status_created")
    op.drop_table("exchange_validation_tasks")
    op.drop_column("user_exchanges", "balance_updated_at")
    op.drop_column("user_exchanges", "balance_usdt_total")
    op.drop_column("user_exchanges", "balance_usdt_free")
    op.drop_column("user_exchanges", "status")
