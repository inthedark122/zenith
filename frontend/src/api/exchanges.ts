import { AddExchangePayload, Exchange, ExchangeBalance, SupportedExchangesResponse } from '../types'
import client from './client'

export const exchangesApi = {
  getExchanges: (): Promise<Exchange[]> =>
    client.get<Exchange[]>('/exchanges').then((r) => r.data),
  getSupported: (): Promise<SupportedExchangesResponse> =>
    client.get<SupportedExchangesResponse>('/exchanges/supported').then((r) => r.data),
  addExchange: (payload: AddExchangePayload): Promise<Exchange> =>
    client.post<Exchange>('/exchanges', payload).then((r) => r.data),
  removeExchange: (id: number): Promise<void> =>
    client.delete(`/exchanges/${id}`).then((r) => r.data),
  getBalance: (exchangeId: string): Promise<ExchangeBalance> =>
    client.get<ExchangeBalance>(`/exchanges/${exchangeId}/balance`).then((r) => r.data),
  revalidate: (id: number): Promise<Exchange> =>
    client.post<Exchange>(`/exchanges/${id}/revalidate`).then((r) => r.data),
}
