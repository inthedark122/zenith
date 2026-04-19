import { AddExchangePayload, Exchange, SupportedExchangesResponse } from '../types'
import client from './client'

export const exchangesApi = {
  getExchanges: (): Promise<Exchange[]> =>
    client.get<Exchange[]>('/exchanges').then((r) => r.data),
  getSupported: (): Promise<SupportedExchangesResponse> =>
    client.get<SupportedExchangesResponse>('/exchanges/supported').then((r) => r.data),
  addExchange: (payload: AddExchangePayload): Promise<Exchange> =>
    client.post<Exchange>('/exchanges', payload).then((r) => r.data),
  removeExchange: (exchangeId: string): Promise<void> =>
    client.delete(`/exchanges/${exchangeId}`).then((r) => r.data),
}
