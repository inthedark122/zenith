import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  login: (user: User, token: string) => void
  logout: () => void
  setUser: (user: User) => void
  updateToken: (token: string) => void
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (user: User, token: string) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      setUser: (user: User) => set({ user }),
      updateToken: (token: string) => set({ token }),
    }),
    { name: 'zenith-auth' },
  ),
)

export default useAuthStore
