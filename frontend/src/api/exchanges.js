import client from './client'

export const exchangesApi = {
  getExchanges: () => client.get('/exchanges').then((r) => r.data),
  getSupported: () => client.get('/exchanges/supported').then((r) => r.data),
  addExchange: (payload) => client.post('/exchanges', payload).then((r) => r.data),
  removeExchange: (exchangeId) => client.delete(`/exchanges/${exchangeId}`).then((r) => r.data),
}
