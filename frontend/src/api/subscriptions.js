import client from './client'

export const subscriptionsApi = {
  getPlans: () => client.get('/subscriptions/plans').then((r) => r.data),
  getMySubs: () => client.get('/subscriptions/me').then((r) => r.data),
  subscribe: (payload) => client.post('/subscriptions', payload).then((r) => r.data),
  cancel: (subId) => client.delete(`/subscriptions/${subId}`).then((r) => r.data),
}
