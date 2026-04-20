import { type ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <div className="flex flex-col px-8 pt-12 pb-12 w-full max-w-sm">
        {children}
      </div>
    </div>
  )
}
