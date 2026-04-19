import { Plan, SubscribePayload, Subscription } from '../types'
import client from './client'

export const subscriptionsApi = {
  getPlans: (): Promise<Plan[]> =>
    client.get<Plan[]>('/subscriptions/plans').then((r) => r.data),
  getMySubs: (): Promise<Subscription[]> =>
    client.get<Subscription[]>('/subscriptions/me').then((r) => r.data),
  subscribe: (payload: SubscribePayload): Promise<Subscription> =>
    client.post<Subscription>('/subscriptions', payload).then((r) => r.data),
  cancel: (subId: number): Promise<void> =>
    client.delete(`/subscriptions/${subId}`).then((r) => r.data),
}
