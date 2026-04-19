import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tradingApi } from '../api/trading'

export function useStrategies() {
  return useQuery({
    queryKey: ['strategies'],
    queryFn: tradingApi.getStrategies,
  })
}

export function useSignal(strategyId, options = {}) {
  return useQuery({
    queryKey: ['signal', strategyId],
    queryFn: () => tradingApi.getSignal(strategyId),
    enabled: false,
    ...options,
  })
}

export function useWorkers() {
  return useQuery({
    queryKey: ['workers'],
    queryFn: tradingApi.getWorkers,
  })
}

export function useTrades() {
  return useQuery({
    queryKey: ['trades'],
    queryFn: tradingApi.getTrades,
  })
}

export function useLaunchWorker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: tradingApi.launchWorker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
  })
}

export function useStopWorker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (workerId) => tradingApi.stopWorker(workerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
  })
}
