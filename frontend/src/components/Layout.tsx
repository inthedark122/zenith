import { type ReactNode } from 'react'

import BottomNav from './BottomNav'
import SubscriptionBar from './SubscriptionBar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {children}
      <SubscriptionBar />
      <BottomNav />
    </div>
  )
}
