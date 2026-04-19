import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import useAuthStore from '../store/authStore'

export function useLogin() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  return useMutation({
    mutationFn: ({ email, password }) => authApi.login(email, password),
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
    mutationFn: (payload) => authApi.register(payload),
    onSuccess: (data) => {
      login(data.user, data.access_token)
      navigate('/home')
    },
  })
}
