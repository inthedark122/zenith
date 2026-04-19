import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useRegister } from '../hooks/useAuth'

export default function Register() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const registerMutation = useRegister()

  const onSubmit = (data) => {
    const payload = { ...data }
    if (!payload.referral_code) delete payload.referral_code
    registerMutation.mutate(payload)
  }

  const inputClass = 'w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-3.5 py-3 text-white text-sm outline-none mb-4'
  const labelClass = 'block text-[#aaa] text-xs mb-1.5'

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] bg-[#141414] rounded-2xl p-10 border border-[#222]">
        <div className="w-14 h-14 bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] rounded-full flex items-center justify-center text-2xl mx-auto mb-4">⚡</div>
        <div className="text-center text-2xl font-bold text-white mb-2">Create Account</div>
        <div className="text-center text-[#888] text-sm mb-8">Join Zenith Trading Bot</div>

        {registerMutation.error && (
          <div className="text-[#f87171] text-xs mb-3 text-center">
            {registerMutation.error.response?.data?.detail || 'Registration failed'}
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

          <label className={labelClass}>Username</label>
          <input
            className={inputClass}
            type="text"
            placeholder="Choose a username"
            {...register('username', { required: 'Username is required' })}
          />
          {errors.username && <div className="text-[#f87171] text-xs -mt-3 mb-3">{errors.username.message}</div>}

          <label className={labelClass}>Password</label>
          <input
            className={inputClass}
            type="password"
            placeholder="Create a password"
            {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
          />
          {errors.password && <div className="text-[#f87171] text-xs -mt-3 mb-3">{errors.password.message}</div>}

          <label className={labelClass}>Referral Code (optional)</label>
          <input
            className={inputClass}
            type="text"
            placeholder="Enter referral code"
            {...register('referral_code')}
          />

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] border-none rounded-lg py-3.5 text-white text-base font-semibold cursor-pointer mb-5 disabled:opacity-50"
          >
            {registerMutation.isPending ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <div className="text-center text-[#888] text-sm">
          Already have an account? <Link to="/login" className="text-[#6c47ff] no-underline">Login</Link>
        </div>
      </div>
    </div>
  )
}
