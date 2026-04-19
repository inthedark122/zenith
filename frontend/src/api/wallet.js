import client from './client'

export const walletApi = {
  getWallet: () => client.get('/wallet').then((r) => r.data),
  getTransactions: () => client.get('/wallet/transactions').then((r) => r.data),
  getDepositAddress: () => client.get('/wallet/deposit-address').then((r) => r.data),
}
