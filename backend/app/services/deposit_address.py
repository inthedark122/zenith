"""
Deterministic deposit address derivation.

Each user gets a unique Ethereum address derived from the server's HD wallet
seed.  Payments to this address are monitored by the blockchain listener worker
(see workers/blockchain_listener.py) so we can reliably identify which user
sent a particular transaction without relying on the user's self-report.

Derivation path: m/44'/60'/0'/0/<user_id>
"""
from eth_account import Account
from eth_account.hdaccount import generate_mnemonic

from app.core.config import settings

Account.enable_unaudited_hdwallet_features()
# NOTE: The HD wallet features in eth_account are marked as "unaudited" by the
# library maintainers.  In production, ensure you are running a recent,
# audited version of eth_account and protect HD_WALLET_SEED with a secure
# secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager).
# Never store the seed in plaintext or version control.


def derive_deposit_address(user_id: int) -> str:
    """
    Derive a deterministic Ethereum address for the given user_id.

    Uses the HD_WALLET_SEED from settings as the mnemonic phrase.
    Returns a checksummed Ethereum address string.

    Raises RuntimeError if HD_WALLET_SEED is not configured.
    """
    seed = settings.HD_WALLET_SEED.strip()
    if not seed:
        raise RuntimeError(
            "HD_WALLET_SEED is not configured. "
            "Set it in your .env file to enable unique deposit addresses."
        )

    # Derive account using BIP-44 path m/44'/60'/0'/0/<user_id>
    account = Account.from_mnemonic(
        seed,
        account_path=f"m/44'/60'/0'/0/{user_id}",
    )
    return account.address
