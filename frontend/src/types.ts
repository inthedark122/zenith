export interface User {
  id: number
  email: string
  username: string
  referral_code: string
  is_admin: boolean
}

export interface AuthResponse {
  user: User
  access_token: string
}

export interface Wallet {
  balance: string
}

export interface Transaction {
  id: number
  type: 'deposit' | 'withdrawal' | 'commission'
  amount: string
  created_at: string
}

export interface DepositAddressResponse {
  address: string
}

export interface Exchange {
  exchange_id: string
  label?: string
  api_key?: string
  is_default: boolean
}

export interface SupportedExchangesResponse {
  exchanges: string[]
}

export interface AddExchangePayload {
  exchange_id: string
  label?: string
  api_key: string
  api_secret: string
  passphrase?: string
}

export interface StrategySettings {
  max_daily_margin_usd?: number
  max_daily_trades?: number
}

export interface StrategyBacktestSymbolSummary {
  symbol: string
  total_trades: number
  wins: number
  losses: number
  win_rate: number
  net_profit_usd: number
}

export interface StrategyBacktestSummary {
  strategy: string
  timeframe: string
  lookback_days: number
  margin_per_trade: number
  generated_at: string
  period_start?: string
  period_end?: string
  assumption_notes: string[]
  total_trades: number
  wins: number
  losses: number
  win_rate: number
  net_profit_usd: number
  symbol_results: StrategyBacktestSymbolSummary[]
}

export interface Strategy {
  id: number
  name: string
  strategy: string
  leverage: number
  rr_ratio: number
  symbols: string[]
  settings?: StrategySettings
  backtest_summary?: StrategyBacktestSummary | null
  backtest_updated_at?: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface Signal {
  macd: number
  signal: number
  is_bullish_crossover: boolean
  is_bearish_crossover: boolean
  can_open_trade: boolean
  next_entry_number: number
}

export interface Worker {
  id: number
  status: 'running' | 'stopped'
  strategy_id: number
  exchange_id: string
  margin: string
  started_at?: string
  stopped_at?: string
}

export interface TradeDetails {
  entry_number?: number
  timeframe?: string
  entry_price?: string
  take_profit_price?: string
  stop_loss_price?: string
  margin?: string
  leverage?: number
}

export interface Trade {
  id: number
  symbol: string
  status: 'open' | 'win' | 'loss'
  exchange?: string
  details?: TradeDetails
}

export interface LaunchWorkerPayload {
  strategy_id: number
  margin: number
}

export interface Plan {
  plan: string
  coins: number
  price: number
  description: string
}

export interface Subscription {
  id: number
  plan: string
  status: 'active' | 'cancelled' | 'expired'
  coins?: string[]
  expires_at?: string
  started_at?: string
}

export interface SubscribePayload {
  plan: string
  coins: string[]
}

export interface AdminStrategyPayload {
  name: string
  strategy: string
  symbols: string[]
  leverage: number
  rr_ratio: number
  settings: StrategySettings
  is_active: boolean
}

export interface StrategyBacktestPayload {
  lookback_days: number
  margin_per_trade: number
}

export interface CommunityMember {
  id: number
}

export interface Community {
  members: CommunityMember[]
  total_commission: number
}
