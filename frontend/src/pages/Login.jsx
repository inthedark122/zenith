import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useLogin } from '../hooks/useAuth'

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [showPw, setShowPw] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const loginMutation = useLogin()

  const onSubmit = (data) => {
    if (!agreed) return
    loginMutation.mutate({ email: data.email, password: data.password })
  }

  const inputClass = 'w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-3.5 py-3 text-white text-sm outline-none mb-4'
  const labelClass = 'block text-[#aaa] text-xs mb-1.5'

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] bg-[#141414] rounded-2xl p-10 border border-[#222]">
        <div className="w-14 h-14 bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] rounded-full flex items-center justify-center text-2xl mx-auto mb-4">⚡</div>
        <div className="text-center text-2xl font-bold text-white mb-2">Welcome Back</div>
        <div className="text-center text-[#888] text-sm mb-8">Sign in to Zenith Trading Bot</div>

        {loginMutation.error && (
          <div className="text-[#f87171] text-xs mb-3 text-center">
            {loginMutation.error.response?.data?.detail || 'Login failed'}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <label className={labelClass}>Email</label>
          <input
            className={inputClass}
            type="email"
            placeholder="Enter your email"
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && <div className="text-[#f87171] text-xs -mt-3 mb-3">{errors.email.message}</div>}

          <label className={labelClass}>Password</label>
          <div className="relative mb-4">
            <input
              className="w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-3.5 py-3 text-white text-sm outline-none pr-11"
              type={showPw ? 'text' : 'password'}
              placeholder="Enter your password"
              {...register('password', { required: 'Password is required' })}
            />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888] bg-none border-none cursor-pointer text-base" onClick={() => setShowPw((p) => !p)}>
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>
          {errors.password && <div className="text-[#f87171] text-xs -mt-3 mb-3">{errors.password.message}</div>}

          <a href="#" className="block text-right text-[#6c47ff] text-xs mb-5 no-underline">Forgot Password?</a>

          <div className="flex items-center gap-2 mb-6">
            <input type="checkbox" id="agree" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <label htmlFor="agree" className="text-[#888] text-xs">
              I agree to the <a href="#" className="text-[#6c47ff] no-underline">Terms of Service</a> and <a href="#" className="text-[#6c47ff] no-underline">Privacy Policy</a>
            </label>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending || !agreed}
            className="w-full bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] border-none rounded-lg py-3.5 text-white text-base font-semibold cursor-pointer mb-5 disabled:opacity-50"
          >
            {loginMutation.isPending ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <div className="text-center text-[#888] text-sm">
          Don't have an account? <Link to="/register" className="text-[#6c47ff] no-underline">Register</Link>
        </div>
      </div>
    </div>
  )
}
