"""PostgreSQL LISTEN/NOTIFY utilities using asyncpg.

These helpers allow different processes (backend API server and trading worker)
to communicate event-driven over the shared PostgreSQL connection without polling.
"""

import asyncio
import json
import logging
import re
from typing import Any, Optional

import asyncpg

from app.core.config import settings

log = logging.getLogger(__name__)


def _asyncpg_dsn() -> str:
    """Return a DSN compatible with asyncpg from settings.DATABASE_URL."""
    url = settings.DATABASE_URL
    # Remove SQLAlchemy driver specifier if present (e.g. postgresql+psycopg2:// → postgresql://)
    url = re.sub(r"\+[^/]+://", "://", url)
    return url


async def pg_notify(channel: str, payload: str) -> None:
    """Send a PostgreSQL NOTIFY on the given channel."""
    conn = await asyncpg.connect(dsn=_asyncpg_dsn())
    try:
        await conn.execute("SELECT pg_notify($1, $2)", channel, payload)
    finally:
        await conn.close()


async def pg_wait_for_notification(channel: str, timeout: float) -> Optional[str]:
    """
    Listen on *channel* and return the payload of the first notification
    received within *timeout* seconds. Returns None on timeout.
    """
    conn = await asyncpg.connect(dsn=_asyncpg_dsn())
    try:
        loop = asyncio.get_running_loop()
        future: asyncio.Future[str] = loop.create_future()

        async def _listener(connection: asyncpg.Connection, pid: int, channel_name: str, payload: str) -> None:
            if not future.done():
                future.set_result(payload)

        await conn.add_listener(channel, _listener)
        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            return None
        finally:
            await conn.remove_listener(channel, _listener)
    finally:
        await conn.close()
