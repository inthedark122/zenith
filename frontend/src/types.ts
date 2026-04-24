export interface User {
  id: number
  email: string
  username: string
  referral_code: string
  role: string
  is_admin?: boolean
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
  id: number
  exchange_id: string
  label?: string
  api_key?: string
  is_default: boolean
  status: 'pending' | 'verified' | 'invalid'
  last_error?: string | null
  balance_usdt_free?: number | null
  balance_usdt_total?: number | null
  balance_updated_at?: string | null
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

export interface ExchangeAccountBalance {
  label: string
  usdt_free: number
  usdt_total: number
}

export interface ExchangeBalance {
  accounts: ExchangeAccountBalance[]
  last_updated?: string | null
  error?: string | null
}

export interface StrategySettings {
  // MACD daily settings
  max_daily_margin_usd?: number
  max_daily_trades?: number
  // DCA settings
  amount_multiplier?: number
  step_percent?: number
  max_orders?: number
  take_profit_percent?: number
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
  id: number
  strategy_id: number
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
  gross_profit_usd: number
  gross_loss_usd: number
  net_profit_usd: number
  avg_win_usd: number
  avg_loss_usd: number
  profit_factor?: number | null
  max_drawdown_usd: number
  max_drawdown_pct: number
  best_trade_usd?: number | null
  worst_trade_usd?: number | null
  symbol_results: StrategyBacktestSymbolSummary[]
  is_public: boolean
}

export interface StrategyBacktestOrder {
  symbol: string
  side: string
  status: 'win' | 'loss'
  opened_at: string
  closed_at: string
  entry_price: number
  exit_price: number
  take_profit_price: number
  stop_loss_price: number
  margin_per_trade: number
  leverage: number
  pnl_usd: number
  pnl_pct: number
  close_reason: string
  bars_held: number
}

export interface StrategyBacktestRun extends StrategyBacktestSummary {
  orders: StrategyBacktestOrder[]
}

export interface StrategySymbol {
  symbol: string
  market_type: 'spot' | 'swap'
  leverage: number
}

export interface Strategy {
  id: number
  name: string
  strategy: string
  rr_ratio: number
  symbols: StrategySymbol[]
  settings?: StrategySettings
  latest_backtest?: StrategyBacktestSummary | null
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
  user_exchange_id?: number | null
  selected_symbols?: string[] | null
  strategy_symbols?: string[]
  margin: string
  started_at?: string
  stopped_at?: string
}

export interface TradeDetails {
  entry_number?: number
  dca_order_number?: number
  timeframe?: string
  entry_price?: string
  avg_entry_price?: string
  take_profit_price?: string
  stop_loss_price?: string
  margin?: string
  leverage?: number
  market_type?: 'spot' | 'swap'
}

export interface Trade {
  id: number
  worker_id: number
  symbol: string
  status: 'open' | 'win' | 'loss'
  exchange?: string
  details?: TradeDetails
}

export interface LaunchWorkerPayload {
  strategy_id: number
  margin: number
  user_exchange_id?: number
  selected_symbols: string[]
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
  coins?: string[]
}

export interface AdminStrategyPayload {
  name: string
  strategy: string
  symbols: StrategySymbol[]
  rr_ratio: number
  settings: StrategySettings
  is_active: boolean
}

export interface StrategyBacktestPayload {
  lookback_days: number
  margin_per_trade: number
}

export interface OhlcvCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface CommunityMember {
  id: number
}

export interface Community {
  members: CommunityMember[]
  total_commission: number
}
