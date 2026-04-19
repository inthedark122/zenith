import client from './client'

export const tradingApi = {
  getStrategies: () => client.get('/trading/strategies').then((r) => r.data),
  getSignal: (strategyId) => client.get(`/trading/signal/${strategyId}`).then((r) => r.data),
  getWorkers: () => client.get('/trading/workers').then((r) => r.data),
  getTrades: () => client.get('/trading/trades').then((r) => r.data),
  launchWorker: (payload) => client.post('/trading/launch', payload).then((r) => r.data),
  stopWorker: (workerId) => client.post(`/trading/stop/${workerId}`).then((r) => r.data),
}
