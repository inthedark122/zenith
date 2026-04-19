import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { tradingApi } from '../api/trading'
import { LaunchWorkerPayload } from '../types'

export function useStrategies() {
  return useQuery({
    queryKey: ['strategies'],
    queryFn: tradingApi.getStrategies,
  })
}

export function useSignal(strategyId: number, options: { enabled?: boolean } = {}) {
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
    mutationFn: (payload: LaunchWorkerPayload) => tradingApi.launchWorker(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
  })
}

export function useStopWorker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (workerId: number) => tradingApi.stopWorker(workerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
  })
}
