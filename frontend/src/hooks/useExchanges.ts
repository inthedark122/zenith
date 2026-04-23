import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { exchangesApi } from '../api/exchanges'
import { AddExchangePayload } from '../types'

export function useExchanges() {
  return useQuery({
    queryKey: ['exchanges'],
    queryFn: exchangesApi.getExchanges,
    // Poll every 5s when any exchange is still being validated
    refetchInterval: (query) => {
      const data = query.state.data
      if (Array.isArray(data) && data.some((e) => e.status === 'pending')) {
        return 5000
      }
      return false
    },
  })
}

export function useSupportedExchanges() {
  return useQuery({
    queryKey: ['exchanges', 'supported'],
    queryFn: exchangesApi.getSupported,
    staleTime: Infinity,
  })
}

export function useExchangeBalance(exchangeId: string) {
  return useQuery({
    queryKey: ['exchanges', exchangeId, 'balance'],
    queryFn: () => exchangesApi.getBalance(exchangeId),
    staleTime: 60_000,
    retry: false,
  })
}

export function useAddExchange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AddExchangePayload) => exchangesApi.addExchange(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exchanges'] }),
  })
}

export function useRevalidateExchange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (exchangeId: string) => exchangesApi.revalidate(exchangeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exchanges'] }),
  })
}

export function useRemoveExchange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (exchangeId: string) => exchangesApi.removeExchange(exchangeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exchanges'] }),
  })
}
