import { DepositAddressResponse, Transaction, Wallet } from '../types'
import client from './client'

export const walletApi = {
  getWallet: (): Promise<Wallet> =>
    client.get<Wallet>('/wallet').then((r) => r.data),
  getTransactions: (): Promise<Transaction[]> =>
    client.get<Transaction[]>('/wallet/transactions').then((r) => r.data),
  getDepositAddress: (): Promise<DepositAddressResponse> =>
    client.get<DepositAddressResponse>('/wallet/deposit-address').then((r) => r.data),
}
