from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/zenith"
    SECRET_KEY: str = "changeme-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # HD wallet seed (hex-encoded 64-byte entropy or BIP-39 mnemonic).
    # Used to derive a unique USDT deposit address per user so that the
    # blockchain listener can attribute incoming payments to the right account.
    HD_WALLET_SEED: str = ""

    # Ethereum / BSC JSON-RPC endpoint for the blockchain listener.
    ETH_RPC_URL: str = "https://cloudflare-eth.com"

    # USDT ERC-20 contract address (Ethereum mainnet default).
    USDT_CONTRACT_ADDRESS: str = "0xdAC17F958D2ee523a2206206994597C13D831ec7"

    # How often (seconds) the blockchain listener polls for new USDT transfers.
    BLOCKCHAIN_POLL_INTERVAL: int = 30

    # How often (seconds) the market listener refreshes MACD signals and dispatches workers.
    MARKET_POLL_INTERVAL: int = 60

    class Config:
        env_file = ".env"


settings = Settings()

