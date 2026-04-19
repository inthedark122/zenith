import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Zap } from 'lucide-react'
import { useRegister } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function Register() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const registerMutation = useRegister()

  const onSubmit = (data) => {
    const payload = { ...data }
    if (!payload.referral_code) delete payload.referral_code
    registerMutation.mutate(payload)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-[400px] p-10">
        <CardHeader className="items-center p-0 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] rounded-full flex items-center justify-center mb-4">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
          <p className="text-muted-foreground text-sm mt-1">Join Zenith Trading Bot</p>
        </CardHeader>

        <CardContent className="p-0">
          {registerMutation.error && (
            <p className="text-destructive text-xs mb-3 text-center">
              {registerMutation.error.response?.data?.detail || 'Registration failed'}
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
              {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div className="mb-4">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Choose a username"
                {...register('username', { required: 'Username is required' })}
              />
              {errors.username && <p className="text-destructive text-xs mt-1">{errors.username.message}</p>}
            </div>

            <div className="mb-4">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
              />
              {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="mb-6">
              <Label htmlFor="referral_code">Referral Code (optional)</Label>
              <Input
                id="referral_code"
                type="text"
                placeholder="Enter referral code"
                {...register('referral_code')}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={registerMutation.isPending}
              className="w-full mb-5"
            >
              {registerMutation.isPending ? 'Creating account…' : 'Register'}
            </Button>
          </form>

          <p className="text-center text-muted-foreground text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-[#6c47ff] no-underline hover:underline">Login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
