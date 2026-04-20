import { AdminStrategyPayload, Strategy, StrategyBacktestPayload, StrategyBacktestRun } from '../types'
import client from './client'

export const adminApi = {
  listStrategies: (): Promise<Strategy[]> =>
    client.get<Strategy[]>('/admin/strategies').then((r) => r.data),
  listBacktests: (strategyId: number): Promise<StrategyBacktestRun[]> =>
    client.get<StrategyBacktestRun[]>(`/admin/strategies/${strategyId}/backtests`).then((r) => r.data),
  createStrategy: (payload: AdminStrategyPayload): Promise<Strategy> =>
    client.post<Strategy>('/admin/strategies', payload).then((r) => r.data),
  updateStrategy: (strategyId: number, payload: Partial<AdminStrategyPayload>): Promise<Strategy> =>
    client.put<Strategy>(`/admin/strategies/${strategyId}`, payload).then((r) => r.data),
  deleteStrategy: (strategyId: number): Promise<void> =>
    client.delete(`/admin/strategies/${strategyId}`).then(() => undefined),
  runBacktest: (strategyId: number, payload: StrategyBacktestPayload): Promise<StrategyBacktestRun> =>
    client.post<StrategyBacktestRun>(`/admin/strategies/${strategyId}/backtest`, payload).then((r) => r.data),
  publishBacktest: (strategyId: number, backtestId: number, isPublic: boolean): Promise<StrategyBacktestRun> =>
    client.patch<StrategyBacktestRun>(`/admin/strategies/${strategyId}/backtests/${backtestId}`, { is_public: isPublic }).then((r) => r.data),
  getSymbols: (exchange = 'okx', marketType = 'spot'): Promise<string[]> =>
    client.get<string[]>('/admin/symbols', { params: { exchange, market_type: marketType } }).then((r) => r.data),
}
