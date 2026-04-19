import client from './client'

export const referralApi = {
  getCommunity: () => client.get('/referral/community').then((r) => r.data),
}
