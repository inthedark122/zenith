import { useEffect, useRef } from 'react'
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

const REFRESH_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Tracks user activity and refreshes the JWT every hour while the user is active.
 * If the user has been inactive for a full 24-hour token lifetime the token expires
 * and they are logged out naturally on the next request.
 */
export function useSessionRefresh() {
  const token = useAuthStore((s) => s.token)
  const updateToken = useAuthStore((s) => s.updateToken)
  const logout = useAuthStore((s) => s.logout)
  const lastActivityRef = useRef<number>(Date.now())
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!token) return

    const recordActivity = () => {
      if (!throttleRef.current) {
        lastActivityRef.current = Date.now()
        throttleRef.current = setTimeout(() => {
          throttleRef.current = null
        }, 60_000)
      }
    }

    window.addEventListener('click', recordActivity, { passive: true })
    window.addEventListener('keydown', recordActivity, { passive: true })
    window.addEventListener('mousemove', recordActivity, { passive: true })
    window.addEventListener('scroll', recordActivity, { passive: true })

    const interval = setInterval(async () => {
      const idleMs = Date.now() - lastActivityRef.current
      if (idleMs < REFRESH_INTERVAL_MS) {
        try {
          const data = await authApi.refresh()
          updateToken(data.access_token)
        } catch {
          logout()
        }
      }
    }, REFRESH_INTERVAL_MS)

    return () => {
      window.removeEventListener('click', recordActivity)
      window.removeEventListener('keydown', recordActivity)
      window.removeEventListener('mousemove', recordActivity)
      window.removeEventListener('scroll', recordActivity)
      clearInterval(interval)
      if (throttleRef.current) clearTimeout(throttleRef.current)
    }
  }, [token, updateToken, logout])
}
