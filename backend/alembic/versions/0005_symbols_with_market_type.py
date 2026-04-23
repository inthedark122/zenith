"""Migrate strategy.symbols from List[str] to List[StrategySymbol]

Each symbol string is converted to an object with market_type and leverage:
  "BTC/USDT"       → {"symbol": "BTC/USDT",      "market_type": "spot", "leverage": 1}
  "BTC/USDT:USDT"  → {"symbol": "BTC/USDT:USDT", "market_type": "swap", "leverage": 20}

The market_type is inferred from the ccxt symbol format:
  - Contains ":" → swap (linear perpetual, e.g. BTC/USDT:USDT)
  - No ":"       → spot

Revision ID: 0005_symbols_with_market_type
Revises: 0004_backtest_is_public
Create Date: 2026-04-23
"""
from typing import Any, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_symbols_with_market_type"
down_revision: Union[str, None] = "0004_backtest_is_public"
branch_labels = None
depends_on = None


def _infer_market_type(symbol: str) -> str:
    return "swap" if ":" in symbol else "spot"


def _infer_leverage(market_type: str) -> int:
    return 1 if market_type == "spot" else 20


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, symbols FROM strategies")).fetchall()
    for row_id, symbols in rows:
        if not symbols:
            continue
        # Already migrated (list of dicts)?
        if symbols and isinstance(symbols[0], dict):
            continue
        migrated = []
        for sym in symbols:
            mt = _infer_market_type(sym)
            migrated.append({
                "symbol": sym,
                "market_type": mt,
                "leverage": _infer_leverage(mt),
            })
        conn.execute(
            sa.text("UPDATE strategies SET symbols = :s WHERE id = :id"),
            {"s": __import__("json").dumps(migrated), "id": row_id},
        )


def downgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, symbols FROM strategies")).fetchall()
    for row_id, symbols in rows:
        if not symbols:
            continue
        # Already plain strings?
        if symbols and isinstance(symbols[0], str):
            continue
        plain = [entry["symbol"] for entry in symbols if isinstance(entry, dict)]
        conn.execute(
            sa.text("UPDATE strategies SET symbols = :s WHERE id = :id"),
            {"s": __import__("json").dumps(plain), "id": row_id},
        )
