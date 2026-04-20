import { Eye, EyeOff, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { useLogin } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface LoginFormValues {
  email: string
  password: string
}

export default function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>()
  const [showPw, setShowPw] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const loginMutation = useLogin()

  const onSubmit = (data: LoginFormValues) => {
    if (!agreed) return
    loginMutation.mutate({ email: data.email, password: data.password })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center relative overflow-hidden">
      {/* Orange accent stripe on the right */}
      <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#f9a825] via-[#ff6f00] to-[#f9a825]" />

      <div className="w-full max-w-[340px] px-4 py-8">
        {/* Header: title + logo */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-[28px] font-bold text-white leading-tight">Welcome Back</h1>
          <img src="/zenith-logo.svg" alt="ZenithCrypto" className="h-20 w-auto flex-shrink-0" />
        </div>

        {loginMutation.error && (
          <p className="text-destructive text-xs mb-4 text-center">
            {loginMutation.error.message ?? 'Login failed'}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Email field */}
          <div className="mb-3">
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="Email"
                autoComplete="email"
                className="h-14 text-base pr-12 border-0 bg-[#1c1c1e] placeholder:text-gray-500"
                {...register('email', { required: 'Email is required' })}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                <Mail size={18} />
              </span>
            </div>
            {errors.email && (
              <p className="text-destructive text-xs mt-1 ml-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password field */}
          <div className="mb-2">
            <div className="relative">
              <Input
                id="password"
                type={showPw ? 'text' : 'password'}
                placeholder="Password"
                autoComplete="current-password"
                className="h-14 text-base pr-12 border-0 bg-[#1c1c1e] placeholder:text-gray-500"
                {...register('password', { required: 'Password is required' })}
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                onClick={() => setShowPw((p) => !p)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-destructive text-xs mt-1 ml-1">{errors.password.message}</p>
            )}
          </div>

          {/* Forgot password */}
          <div className="flex justify-end mb-5">
            <a
              href="#"
              className="text-gray-400 text-xs hover:text-white transition-colors no-underline"
            >
              Forgot Password
            </a>
          </div>

          {/* Terms checkbox */}
          <div className="flex items-start gap-3 mb-6">
            <label className="relative flex-shrink-0 mt-0.5 cursor-pointer">
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                  agreed ? 'bg-[#6c47ff]' : 'bg-[#2a2a2a] border border-[#444]'
                }`}
              >
                {agreed && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 12 12"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </label>
            <label htmlFor="agree" className="text-gray-300 text-xs leading-relaxed cursor-pointer">
              By logging in, you confirm that you have read, understood, and fully agree to the
              terms under{' '}
              <a href="#" className="text-[#42a5f5] no-underline hover:underline font-medium">
                CoinTech2u&apos;s User Agreement and Authorization Consent
              </a>
            </label>
          </div>

          {/* Log In button */}
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            disabled={loginMutation.isPending || !agreed}
            className="w-full rounded-full text-gray-300"
          >
            {loginMutation.isPending ? 'Signing in…' : 'Log In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
