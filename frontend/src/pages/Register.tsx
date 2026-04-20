import { Eye, EyeOff, Mail, Tag, User } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import BrandLogo from '../components/BrandLogo'
import { useRegister } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/ui/input'

interface RegisterFormValues {
  email: string
  username: string
  password: string
  referral_code?: string
}

export default function Register() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>()
  const registerMutation = useRegister()
  const [showPw, setShowPw] = useState(false)

  const onSubmit = (data: RegisterFormValues) => {
    registerMutation.mutate(data)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 pt-16 pb-10">
      {/* Heading row */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-bold text-foreground leading-tight">Create Account</h1>
        <BrandLogo compact className="w-24 h-24 object-contain" alt="Zenith" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 flex-1">
        {registerMutation.error && (
          <p className="text-destructive text-sm text-center -mt-2">
            {registerMutation.error.message ?? 'Registration failed'}
          </p>
        )}

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

        <div>
          <InputField
            type="text"
            placeholder="Username"
            icon={<User size={18} />}
            {...register('username', { required: 'Username is required' })}
          />
          {errors.username && (
            <p className="text-destructive text-xs mt-1 pl-1">{errors.username.message}</p>
          )}
        </div>

        <div>
          <InputField
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            icon={showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            onIconClick={() => setShowPw((p) => !p)}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 6, message: 'Min 6 characters' },
            })}
          />
          {errors.password && (
            <p className="text-destructive text-xs mt-1 pl-1">{errors.password.message}</p>
          )}
        </div>

        <div>
          <InputField
            type="text"
            placeholder="Referral Code (optional)"
            icon={<Tag size={18} />}
            {...register('referral_code')}
          />
        </div>

        <Button
          type="submit"
          size="pill"
          disabled={registerMutation.isPending}
          className="w-full mt-4"
        >
          {registerMutation.isPending ? 'Creating account…' : 'Register'}
        </Button>

        <p className="text-center text-muted-foreground text-sm mt-2">
          Already have an account?{' '}
          <Link to="/login" className="text-[#6c47ff] font-semibold hover:underline">
            Log In
          </Link>
        </p>
      </form>
    </div>
  )
}
