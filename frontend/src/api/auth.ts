import { AuthResponse } from '../types'
import client from './client'

export const authApi = {
  login: (email: string, password: string): Promise<AuthResponse> => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return client
      .post<AuthResponse>('/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .then((r) => r.data)
  },

  register: (payload: Record<string, string>): Promise<AuthResponse> =>
    client.post<AuthResponse>('/auth/register', payload).then((r) => r.data),
}
