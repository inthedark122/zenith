"""drop worker margin column

Revision ID: 0009_drop_worker_margin
Revises: 42aaeb3634bc
Create Date: 2026-04-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0009_drop_worker_margin'
down_revision: Union[str, None] = '42aaeb3634bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('strategy_workers', 'margin')


def downgrade() -> None:
    op.add_column(
        'strategy_workers',
        sa.Column('margin', sa.Numeric(18, 8), nullable=True),
    )
