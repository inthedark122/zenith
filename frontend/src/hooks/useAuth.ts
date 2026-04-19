import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { authApi } from '../api/auth'
import useAuthStore from '../store/authStore'

interface LoginVariables {
  email: string
  password: string
}

interface RegisterVariables {
  email: string
  username: string
  password: string
  referral_code?: string
}

export function useLogin() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  return useMutation({
    mutationFn: ({ email, password }: LoginVariables) => authApi.login(email, password),
    onSuccess: (data) => {
      login(data.user, data.access_token)
      navigate('/home')
    },
  })
}

export function useRegister() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  return useMutation({
    mutationFn: (payload: RegisterVariables) => {
      const body: Record<string, string> = {
        email: payload.email,
        username: payload.username,
        password: payload.password,
      }
      if (payload.referral_code) {
        body['referral_code'] = payload.referral_code
      }
      return authApi.register(body)
    },
    onSuccess: (data) => {
      login(data.user, data.access_token)
      navigate('/home')
    },
  })
}
