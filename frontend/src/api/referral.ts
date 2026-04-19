import { Community } from '../types'
import client from './client'

export const referralApi = {
  getCommunity: (): Promise<Community> =>
    client.get<Community>('/referral/community').then((r) => r.data),
}
