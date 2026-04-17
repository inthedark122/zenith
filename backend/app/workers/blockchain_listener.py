"""
Blockchain Listener Worker
==========================

Continuously polls the Ethereum network for incoming USDT (ERC-20) transfers
to any deposit address managed by Zenith, then credits the corresponding
user's internal wallet balance.

Why this approach instead of trusting the HTTP endpoint
-------------------------------------------------------
The /wallet/transactions endpoint only creates a *pending* record when a user
submits a tx hash.  This worker independently queries the chain, so a user
cannot fake a deposit by submitting a fraudulent hash.

Architecture
------------
- Runs as an asyncio background task started in app startup (main.py).
- Polls the USDT ERC-20 contract Transfer events every
  ``settings.BLOCKCHAIN_POLL_INTERVAL`` seconds (default 30 s).
- Uses a small event filter window to avoid re-processing old blocks.
- Each confirmed transfer calls ``wallet_service.confirm_deposit`` which is
  idempotent (safe to call multiple times for the same tx_hash).

Configuration (via .env / environment variables)
-------------------------------------------------
ETH_RPC_URL               — JSON-RPC endpoint (e.g. Infura, Alchemy, Cloudflare)
USDT_CONTRACT_ADDRESS     — ERC-20 USDT contract (mainnet default pre-filled)
BLOCKCHAIN_POLL_INTERVAL  — seconds between polls (default 30)
"""

import asyncio
import json
import logging
from decimal import Decimal

from web3 import Web3
from web3.exceptions import BlockNotFound

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.wallet import Wallet
from app.services import wallet as wallet_service

log = logging.getLogger(__name__)

# Minimal ABI — only the Transfer event is needed
_USDT_ABI = json.loads(
    '[{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},'
    '{"indexed":true,"name":"to","type":"address"},'
    '{"indexed":false,"name":"value","type":"uint256"}],'
    '"name":"Transfer","type":"event"},'
    '{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],'
    '"payable":false,"stateMutability":"view","type":"function"}]'
)

_LAST_PROCESSED_BLOCK: int = 0   # module-level state; updated each poll cycle


def _get_managed_addresses(db) -> set:
    """Return the set of deposit addresses currently assigned to any wallet."""
    rows = db.query(Wallet.deposit_address).filter(Wallet.deposit_address.isnot(None)).all()
    return {row[0].lower() for row in rows}


async def blockchain_listener_loop() -> None:
    """
    Main entry-point for the blockchain listener.
    Runs forever; exceptions are logged and the loop retries after a backoff.
    """
    global _LAST_PROCESSED_BLOCK

    if not settings.ETH_RPC_URL:
        log.warning("ETH_RPC_URL is not configured — blockchain listener is disabled.")
        return
    if not settings.USDT_CONTRACT_ADDRESS:
        log.warning("USDT_CONTRACT_ADDRESS is not configured — blockchain listener is disabled.")
        return

    w3 = Web3(Web3.HTTPProvider(settings.ETH_RPC_URL))
    usdt = w3.eth.contract(
        address=Web3.to_checksum_address(settings.USDT_CONTRACT_ADDRESS),
        abi=_USDT_ABI,
    )

    # Fetch USDT decimal precision once
    try:
        decimals = usdt.functions.decimals().call()
    except Exception:
        decimals = 6  # USDT standard

    divisor = Decimal(10 ** decimals)

    # Start from the current chain tip on first run
    try:
        _LAST_PROCESSED_BLOCK = w3.eth.block_number - 1
    except Exception as exc:
        log.error("Cannot connect to Ethereum node: %s", exc)
        return

    log.info("Blockchain listener started. Watching USDT at %s from block %d",
             settings.USDT_CONTRACT_ADDRESS, _LAST_PROCESSED_BLOCK)

    while True:
        await asyncio.sleep(settings.BLOCKCHAIN_POLL_INTERVAL)
        try:
            await _poll_transfers(w3, usdt, divisor)
        except Exception as exc:
            log.exception("Blockchain listener error: %s", exc)


async def _poll_transfers(w3: Web3, usdt, divisor: Decimal) -> None:
    """
    Fetch all USDT Transfer events in the new blocks since the last poll,
    check if the recipient is a managed deposit address, and credit the wallet.
    """
    global _LAST_PROCESSED_BLOCK

    try:
        latest = w3.eth.block_number
    except Exception as exc:
        log.warning("Could not fetch latest block: %s", exc)
        return

    if latest <= _LAST_PROCESSED_BLOCK:
        return  # No new blocks

    from_block = _LAST_PROCESSED_BLOCK + 1
    to_block = latest

    db = SessionLocal()
    try:
        managed = _get_managed_addresses(db)
        if not managed:
            _LAST_PROCESSED_BLOCK = to_block
            return

        # Fetch Transfer events for the block range
        try:
            events = usdt.events.Transfer.get_logs(
                fromBlock=from_block,
                toBlock=to_block,
            )
        except BlockNotFound:
            log.warning("Block not found during event fetch — skipping range %d-%d",
                        from_block, to_block)
            return

        for event in events:
            recipient = event["args"]["to"].lower()
            if recipient not in managed:
                continue

            tx_hash = event["transactionHash"].hex()
            raw_value = event["args"]["value"]
            amount = Decimal(str(raw_value)) / divisor

            log.info(
                "Detected USDT transfer: %s USDT → %s (tx: %s)",
                amount, recipient, tx_hash,
            )

            confirmed = wallet_service.confirm_deposit(
                tx_hash=tx_hash,
                amount=amount,
                deposit_address=Web3.to_checksum_address(event["args"]["to"]),
                db=db,
            )
            if confirmed:
                log.info("Credited %s USDT to wallet (tx: %s)", amount, tx_hash)

        _LAST_PROCESSED_BLOCK = to_block

    finally:
        db.close()
