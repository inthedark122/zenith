import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscriptionsApi } from '../api/subscriptions'

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
    mutationFn: subscriptionsApi.subscribe,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions', 'me'] }),
  })
}

export function useCancelSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: subscriptionsApi.cancel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions', 'me'] }),
  })
}
