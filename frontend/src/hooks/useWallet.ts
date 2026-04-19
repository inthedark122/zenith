import { useQuery } from '@tanstack/react-query'

import { walletApi } from '../api/wallet'

export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: walletApi.getWallet,
  })
}

export function useTransactions() {
  return useQuery({
    queryKey: ['wallet', 'transactions'],
    queryFn: walletApi.getTransactions,
  })
}

export function useDepositAddress() {
  return useQuery({
    queryKey: ['wallet', 'deposit-address'],
    queryFn: walletApi.getDepositAddress,
    staleTime: Infinity,
  })
}
