import { Eye, EyeOff, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { useLogin } from '../hooks/useAuth'

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

      <div className="w-full max-w-sm px-6 py-10">
        {/* Header: title + logo */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white leading-tight">Welcome Back</h1>
          <img
            src="/zenith-logo.svg"
            alt="ZenithCrypto"
            className="h-16 w-auto flex-shrink-0"
          />
        </div>

        {loginMutation.error && (
          <p className="text-red-400 text-xs mb-4 text-center">
            {loginMutation.error.message ?? 'Login failed'}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Email field */}
          <div className="mb-4">
            <div className="relative">
              <input
                id="email"
                type="email"
                placeholder="Email"
                autoComplete="email"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3.5 text-white placeholder-gray-500 text-sm outline-none focus:border-[#6c47ff] focus:ring-1 focus:ring-[#6c47ff] transition-colors pr-11"
                {...register('email', { required: 'Email is required' })}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                <Mail size={16} />
              </span>
            </div>
            {errors.email && (
              <p className="text-red-400 text-xs mt-1 ml-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password field */}
          <div className="mb-3">
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3.5 text-white placeholder-gray-500 text-sm outline-none focus:border-[#6c47ff] focus:ring-1 focus:ring-[#6c47ff] transition-colors pr-11"
                {...register('password', { required: 'Password is required' })}
              />
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                onClick={() => setShowPw((p) => !p)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-400 text-xs mt-1 ml-1">{errors.password.message}</p>
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
            <label htmlFor="agree" className="text-gray-400 text-xs leading-relaxed cursor-pointer">
              By logging in, you confirm that you have read, understood, and fully agree to the
              terms under{' '}
              <a href="#" className="text-[#42a5f5] no-underline hover:underline">
                CoinTech2u&apos;s User Agreement and Authorization Consent
              </a>
            </label>
          </div>

          {/* Log In button */}
          <button
            type="submit"
            disabled={loginMutation.isPending || !agreed}
            className="w-full py-3.5 rounded-full bg-[#3a3a3a] text-gray-300 text-sm font-medium tracking-wide transition-all hover:bg-[#4a4a4a] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loginMutation.isPending ? 'Signing in…' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  )
}
