import { Eye, EyeOff, Zap } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { useLogin } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-[400px] p-10">
        <CardHeader className="items-center p-0 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] rounded-full flex items-center justify-center mb-4">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to Zenith Trading Bot</p>
        </CardHeader>

        <CardContent className="p-0">
          {loginMutation.error && (
            <p className="text-destructive text-xs mb-3 text-center">
              {loginMutation.error.message ?? 'Login failed'}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-4">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && (
                <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="mb-4">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="pr-11"
                  {...register('password', { required: 'Password is required' })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPw((p) => !p)}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <a
              href="#"
              className="block text-right text-[#6c47ff] text-xs mb-5 no-underline hover:underline"
            >
              Forgot Password?
            </a>

            <div className="flex items-center gap-2 mb-6">
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="accent-[#6c47ff]"
              />
              <label htmlFor="agree" className="text-muted-foreground text-xs">
                I agree to the{' '}
                <a href="#" className="text-[#6c47ff] no-underline hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-[#6c47ff] no-underline hover:underline">
                  Privacy Policy
                </a>
              </label>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={loginMutation.isPending || !agreed}
              className="w-full mb-5"
            >
              {loginMutation.isPending ? 'Signing in…' : 'Login'}
            </Button>
          </form>

          <p className="text-center text-muted-foreground text-sm">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-[#6c47ff] no-underline hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
