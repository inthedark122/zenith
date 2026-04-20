import { Eye, EyeOff, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import AuthHeader from '../components/AuthHeader'
import AuthLayout from '../components/AuthLayout'
import { useLogin } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/ui/input'

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
    <AuthLayout>
      <AuthHeader title="Welcome Back" subtitle="Sign in to your account" />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 flex-1">
        {loginMutation.error && (
          <p className="text-destructive text-sm text-center -mt-2">
            {loginMutation.error.message ?? 'Login failed'}
          </p>
        )}

        {/* Email */}
        <div>
          <InputField
            type="email"
            placeholder="Email"
            icon={<Mail size={18} />}
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && (
            <p className="text-destructive text-xs mt-1 pl-1">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <InputField
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            icon={showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            onIconClick={() => setShowPw((p) => !p)}
            {...register('password', { required: 'Password is required' })}
          />
          {errors.password && (
            <p className="text-destructive text-xs mt-1 pl-1">{errors.password.message}</p>
          )}
        </div>

        {/* Forgot password */}
        <div className="flex justify-end -mt-1">
          <a href="#" className="text-muted-foreground text-sm hover:text-foreground transition-colors">
            Forgot Password
          </a>
        </div>

        {/* Terms */}
        <label className="flex items-start gap-3 cursor-pointer mt-1">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                agreed ? 'bg-[#6c47ff] border-[#6c47ff]' : 'border-border bg-input'
              }`}
            >
              {agreed && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-muted-foreground text-sm leading-snug">
            By logging in, you confirm that you have read, understood, and fully agree to the terms under{' '}
            <a href="#" className="text-[#6c47ff] font-semibold hover:underline">
              Zenith&apos;s User Agreement and Authorization Consent
            </a>
          </span>
        </label>

        {/* Submit */}
        <Button
          type="submit"
          size="pill"
          disabled={loginMutation.isPending || !agreed}
          className="w-full mt-4"
        >
          {loginMutation.isPending ? 'Signing in…' : 'Log In'}
        </Button>

        {/* Register link */}
        <p className="text-center text-muted-foreground text-sm mt-2">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-[#6c47ff] font-semibold hover:underline">
            Register
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
