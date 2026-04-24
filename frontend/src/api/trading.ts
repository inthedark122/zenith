import { LaunchWorkerPayload, Signal, Strategy, TokenStartPayload, TokenStopPayload, TokenStopResponse, Trade, Worker } from '../types'
import client from './client'

export const tradingApi = {
  getStrategies: (): Promise<Strategy[]> =>
    client.get<Strategy[]>('/trading/strategies').then((r) => r.data),
  getSignal: (strategyId: number): Promise<Signal> =>
    client.get<Signal>(`/trading/signal/${strategyId}`).then((r) => r.data),
  getWorkers: (): Promise<Worker[]> =>
    client.get<Worker[]>('/trading/workers').then((r) => r.data),
  getTrades: (): Promise<Trade[]> =>
    client.get<Trade[]>('/trading/trades').then((r) => r.data),
  launchWorker: (payload: LaunchWorkerPayload): Promise<Worker> =>
    client.post<Worker>('/trading/launch', payload).then((r) => r.data),
  stopWorker: (workerId: number): Promise<Worker> =>
    client.post<Worker>(`/trading/stop/${workerId}`).then((r) => r.data),
  startTokens: (payload: TokenStartPayload): Promise<Worker> =>
    client.post<Worker>('/trading/tokens/start', payload).then((r) => r.data),
  stopTokens: (payload: TokenStopPayload): Promise<TokenStopResponse> =>
    client.post<TokenStopResponse>('/trading/tokens/stop', payload).then((r) => r.data),
}
