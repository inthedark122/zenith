import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { exchangesApi } from '../api/exchanges'

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
    mutationFn: exchangesApi.addExchange,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exchanges'] }),
  })
}

export function useRemoveExchange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: exchangesApi.removeExchange,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exchanges'] }),
  })
}
