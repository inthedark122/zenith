import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { adminApi } from '../api/admin'
import { AdminStrategyPayload, StrategyBacktestPayload } from '../types'

export function useAdminStrategies() {
  return useQuery({
    queryKey: ['admin', 'strategies'],
    queryFn: adminApi.listStrategies,
  })
}

export function useStrategyBacktests(strategyId: number | null) {
  return useQuery({
    queryKey: ['admin', 'strategy-backtests', strategyId],
    queryFn: () => {
      if (strategyId === null) {
        throw new Error('Strategy ID is required to load backtests')
      }
      return adminApi.listBacktests(strategyId)
    },
    enabled: strategyId !== null,
  })
}

export function useCreateAdminStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AdminStrategyPayload) => adminApi.createStrategy(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] })
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
  })
}

export function useUpdateAdminStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ strategyId, payload }: { strategyId: number; payload: Partial<AdminStrategyPayload> }) =>
      adminApi.updateStrategy(strategyId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] })
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
  })
}

export function useDeleteAdminStrategy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (strategyId: number) => adminApi.deleteStrategy(strategyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] })
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
  })
}

export function useRunStrategyBacktest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      strategyId,
      payload,
    }: {
      strategyId: number
      payload: StrategyBacktestPayload
    }) => adminApi.runBacktest(strategyId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategies'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'strategy-backtests', variables.strategyId] })
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
  })
}
