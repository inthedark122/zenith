export interface User {
  id: number
  email: string
  username: string
  referral_code: string
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

export interface Strategy {
  id: number
  name: string
  strategy: string
  leverage: number
  rr_ratio: number
  symbols: string[]
  settings?: StrategySettings
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

export interface CommunityMember {
  id: number
}

export interface Community {
  members: CommunityMember[]
  total_commission: number
}
