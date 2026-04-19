import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { subscriptionsApi } from '../api/subscriptions'
import { SubscribePayload } from '../types'

export function usePlans() {
  return useQuery({
    queryKey: ['subscriptions', 'plans'],
    queryFn: subscriptionsApi.getPlans,
    staleTime: Infinity,
  })
}

export function useMySubs() {
  return useQuery({
    queryKey: ['subscriptions', 'me'],
    queryFn: subscriptionsApi.getMySubs,
  })
}

export function useSubscribe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SubscribePayload) => subscriptionsApi.subscribe(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions', 'me'] }),
  })
}

export function useCancelSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subId: number) => subscriptionsApi.cancel(subId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions', 'me'] }),
  })
}
