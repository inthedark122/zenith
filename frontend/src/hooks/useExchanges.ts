import { useMutation, useQueryClient , useQuery } from '@tanstack/react-query'

import { exchangesApi } from '../api/exchanges'
import { AddExchangePayload } from '../types'

export function useExchanges() {
  return useQuery({
    queryKey: ['exchanges'],
    queryFn: exchangesApi.getExchanges,
  })
}

export function useSupportedExchanges() {
  return useQuery({
    queryKey: ['exchanges', 'supported'],
    queryFn: exchangesApi.getSupported,
    staleTime: Infinity,
  })
}

export function useAddExchange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AddExchangePayload) => exchangesApi.addExchange(payload),
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
