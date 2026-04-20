import { AdminStrategyPayload, Strategy, StrategyBacktestPayload } from '../types'
import client from './client'

export const adminApi = {
  listStrategies: (): Promise<Strategy[]> =>
    client.get<Strategy[]>('/admin/strategies').then((r) => r.data),
  createStrategy: (payload: AdminStrategyPayload): Promise<Strategy> =>
    client.post<Strategy>('/admin/strategies', payload).then((r) => r.data),
  updateStrategy: (strategyId: number, payload: Partial<AdminStrategyPayload>): Promise<Strategy> =>
    client.put<Strategy>(`/admin/strategies/${strategyId}`, payload).then((r) => r.data),
  deleteStrategy: (strategyId: number): Promise<void> =>
    client.delete(`/admin/strategies/${strategyId}`).then(() => undefined),
  runBacktest: (strategyId: number, payload: StrategyBacktestPayload): Promise<Strategy> =>
    client.post<Strategy>(`/admin/strategies/${strategyId}/backtest`, payload).then((r) => r.data),
}
