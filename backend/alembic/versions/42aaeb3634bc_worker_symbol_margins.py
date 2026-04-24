"""worker_symbol_margins

Revision ID: 42aaeb3634bc
Revises: 0008_worker_exchange_and_symbols
Create Date: 2026-04-24 16:10:42.249815

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42aaeb3634bc'
down_revision: Union[str, None] = '0008_worker_exchange_and_symbols'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('strategy_workers', sa.Column('symbol_margins', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('strategy_workers', 'symbol_margins')
