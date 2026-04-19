import { useQuery } from '@tanstack/react-query'

import { referralApi } from '../api/referral'

export function useCommunity() {
  return useQuery({
    queryKey: ['referral', 'community'],
    queryFn: referralApi.getCommunity,
  })
}
