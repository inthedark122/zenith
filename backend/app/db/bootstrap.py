import logging

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.core.config import settings

log = logging.getLogger(__name__)

_INITIAL_REVISION = "0001_initial"
_EXPECTED_INITIAL_TABLES = {
    "commission_payments",
    "referrals",
    "strategies",
    "strategy_trades",
    "strategy_workers",
    "subscriptions",
    "transactions",
    "user_exchanges",
    "users",
    "wallets",
}


def run() -> None:
    config = Config("alembic.ini")
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as connection:
        existing_tables = set(inspect(connection).get_table_names())

    has_alembic_version = "alembic_version" in existing_tables
    existing_app_tables = _EXPECTED_INITIAL_TABLES & existing_tables

    if has_alembic_version:
        log.info("Alembic version table present; running migrations to head.")
        command.upgrade(config, "head")
        return

    if not existing_app_tables:
        log.info("No application tables found; applying migrations from scratch.")
        command.upgrade(config, "head")
        return

    if existing_app_tables == _EXPECTED_INITIAL_TABLES:
        log.info(
            "Existing schema matches the initial app tables without alembic_version; stamping %s.",
            _INITIAL_REVISION,
        )
        command.stamp(config, _INITIAL_REVISION)
        command.upgrade(config, "head")
        return

    missing_tables = sorted(_EXPECTED_INITIAL_TABLES - existing_app_tables)
    present_tables = sorted(existing_app_tables)
    raise RuntimeError(
        "Database contains a partial pre-Alembic schema. "
        f"Present expected tables: {present_tables}. Missing expected tables: {missing_tables}."
    )


if __name__ == "__main__":
    run()
