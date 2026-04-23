"""add last_error to user_exchanges

Revision ID: 7b98480c841f
Revises: 0006_exchange_sync_state
Create Date: 2026-04-23 22:38:36.734281

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b98480c841f'
down_revision: Union[str, None] = '0006_exchange_sync_state'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_exchanges', sa.Column('last_error', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('user_exchanges', 'last_error')
