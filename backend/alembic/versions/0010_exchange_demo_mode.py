"""Add is_demo flag to user_exchanges and exchange_validation_tasks

Revision ID: 0010_exchange_demo_mode
Revises: 0009_drop_worker_margin
Create Date: 2026-04-24

Allows a user to connect both a live and a demo (paper trading) OKX account
by relaxing the unique constraint from (user_id, exchange_id) to
(user_id, exchange_id, is_demo).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_exchange_demo_mode"
down_revision: Union[str, None] = "0009_drop_worker_margin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── user_exchanges ────────────────────────────────────────────────────
    op.add_column(
        "user_exchanges",
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Replace old (user_id, exchange_id) unique constraint with
    # (user_id, exchange_id, is_demo) so both demo + live can coexist.
    op.drop_constraint("uq_user_exchange", "user_exchanges", type_="unique")
    op.create_unique_constraint(
        "uq_user_exchange_demo",
        "user_exchanges",
        ["user_id", "exchange_id", "is_demo"],
    )

    # ── exchange_validation_tasks ─────────────────────────────────────────
    op.add_column(
        "exchange_validation_tasks",
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("exchange_validation_tasks", "is_demo")

    op.drop_constraint("uq_user_exchange_demo", "user_exchanges", type_="unique")
    op.create_unique_constraint(
        "uq_user_exchange",
        "user_exchanges",
        ["user_id", "exchange_id"],
    )

    op.drop_column("user_exchanges", "is_demo")
