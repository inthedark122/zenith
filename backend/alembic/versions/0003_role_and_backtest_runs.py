"""Move auth to role field and persist backtest runs

Revision ID: 0003_role_and_backtest_runs
Revises: 0002_strategy_backtest_fields
Create Date: 2026-04-20 12:05:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_role_and_backtest_runs"
down_revision: Union[str, None] = "0002_strategy_backtest_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(), nullable=True, server_default="user"))
    op.execute("UPDATE users SET role = CASE WHEN COALESCE(is_admin, false) THEN 'admin' ELSE 'user' END")
    op.alter_column("users", "role", existing_type=sa.String(), nullable=False, server_default="user")

    op.create_table(
        "strategy_backtest_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("strategy_id", sa.Integer(), sa.ForeignKey("strategies.id"), nullable=False),
        sa.Column("timeframe", sa.String(), nullable=False),
        sa.Column("lookback_days", sa.Integer(), nullable=False),
        sa.Column("margin_per_trade", sa.Float(), nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("assumption_notes", sa.JSON(), nullable=False),
        sa.Column("total_trades", sa.Integer(), nullable=False),
        sa.Column("wins", sa.Integer(), nullable=False),
        sa.Column("losses", sa.Integer(), nullable=False),
        sa.Column("win_rate", sa.Float(), nullable=False),
        sa.Column("gross_profit_usd", sa.Float(), nullable=False),
        sa.Column("gross_loss_usd", sa.Float(), nullable=False),
        sa.Column("net_profit_usd", sa.Float(), nullable=False),
        sa.Column("avg_win_usd", sa.Float(), nullable=False),
        sa.Column("avg_loss_usd", sa.Float(), nullable=False),
        sa.Column("profit_factor", sa.Float(), nullable=True),
        sa.Column("max_drawdown_usd", sa.Float(), nullable=False),
        sa.Column("max_drawdown_pct", sa.Float(), nullable=False),
        sa.Column("best_trade_usd", sa.Float(), nullable=True),
        sa.Column("worst_trade_usd", sa.Float(), nullable=True),
        sa.Column("symbol_results", sa.JSON(), nullable=False),
        sa.Column("orders", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_strategy_backtest_runs_id", "strategy_backtest_runs", ["id"], unique=False)
    op.create_index("ix_strategy_backtest_runs_strategy_id", "strategy_backtest_runs", ["strategy_id"], unique=False)

    op.execute(
        """
        INSERT INTO strategy_backtest_runs (
            strategy_id,
            timeframe,
            lookback_days,
            margin_per_trade,
            generated_at,
            period_start,
            period_end,
            assumption_notes,
            total_trades,
            wins,
            losses,
            win_rate,
            gross_profit_usd,
            gross_loss_usd,
            net_profit_usd,
            avg_win_usd,
            avg_loss_usd,
            profit_factor,
            max_drawdown_usd,
            max_drawdown_pct,
            best_trade_usd,
            worst_trade_usd,
            symbol_results,
            orders
        )
        SELECT
            id,
            COALESCE(backtest_summary->>'timeframe', '1d'),
            COALESCE((backtest_summary->>'lookback_days')::integer, 0),
            COALESCE((backtest_summary->>'margin_per_trade')::double precision, 0),
            COALESCE((backtest_summary->>'generated_at')::timestamp, backtest_updated_at, NOW()),
            NULLIF(backtest_summary->>'period_start', '')::date,
            NULLIF(backtest_summary->>'period_end', '')::date,
            COALESCE(backtest_summary->'assumption_notes', '[]'::json),
            COALESCE((backtest_summary->>'total_trades')::integer, 0),
            COALESCE((backtest_summary->>'wins')::integer, 0),
            COALESCE((backtest_summary->>'losses')::integer, 0),
            COALESCE((backtest_summary->>'win_rate')::double precision, 0),
            0,
            0,
            COALESCE((backtest_summary->>'net_profit_usd')::double precision, 0),
            0,
            0,
            NULL,
            0,
            0,
            NULL,
            NULL,
            COALESCE(backtest_summary->'symbol_results', '[]'::json),
            '[]'::json
        FROM strategies
        WHERE backtest_summary IS NOT NULL
        """
    )

    op.drop_column("strategies", "backtest_updated_at")
    op.drop_column("strategies", "backtest_summary")
    op.drop_column("users", "is_admin")


def downgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=True))
    op.execute("UPDATE users SET is_admin = (role = 'admin')")
    op.drop_column("users", "role")

    op.add_column("strategies", sa.Column("backtest_summary", sa.JSON(), nullable=True))
    op.add_column("strategies", sa.Column("backtest_updated_at", sa.DateTime(), nullable=True))
    op.execute(
        """
        UPDATE strategies
        SET
            backtest_summary = json_build_object(
                'strategy', strategies.strategy,
                'timeframe', strategy_backtest_runs.timeframe,
                'lookback_days', strategy_backtest_runs.lookback_days,
                'margin_per_trade', strategy_backtest_runs.margin_per_trade,
                'generated_at', strategy_backtest_runs.generated_at,
                'period_start', strategy_backtest_runs.period_start,
                'period_end', strategy_backtest_runs.period_end,
                'assumption_notes', strategy_backtest_runs.assumption_notes,
                'total_trades', strategy_backtest_runs.total_trades,
                'wins', strategy_backtest_runs.wins,
                'losses', strategy_backtest_runs.losses,
                'win_rate', strategy_backtest_runs.win_rate,
                'net_profit_usd', strategy_backtest_runs.net_profit_usd,
                'symbol_results', strategy_backtest_runs.symbol_results
            ),
            backtest_updated_at = strategy_backtest_runs.generated_at
        FROM (
            SELECT DISTINCT ON (strategy_id) *
            FROM strategy_backtest_runs
            ORDER BY strategy_id, generated_at DESC, id DESC
        ) AS strategy_backtest_runs
        WHERE strategies.id = strategy_backtest_runs.strategy_id
        """
    )

    op.drop_index("ix_strategy_backtest_runs_strategy_id", table_name="strategy_backtest_runs")
    op.drop_index("ix_strategy_backtest_runs_id", table_name="strategy_backtest_runs")
    op.drop_table("strategy_backtest_runs")
