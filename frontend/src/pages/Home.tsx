import { BarChart2, BookOpen, Gem, Link2, Settings, Trophy, Users, Wallet } from 'lucide-react'
import { type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import BrandLogo from '../components/BrandLogo'
import { usePlans } from '../hooks/useSubscriptions'
import useAuthStore from '../store/authStore'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface MenuItem {
  icon: LucideIcon
  label: string
  path: string
}

interface StrategyRow {
  label: string
  value: string
}

const menuItems: MenuItem[] = [
  { icon: Link2, label: 'Bind API', path: '/exchanges' },
  { icon: BookOpen, label: 'API Tutorial', path: '#' },
  { icon: BarChart2, label: 'Overview', path: '/trading' },
  { icon: Trophy, label: 'Rankings', path: '#' },
  { icon: Settings, label: 'Setting', path: '#' },
  { icon: Users, label: 'Referral', path: '/referral' },
  { icon: Wallet, label: 'Wallets', path: '/wallets' },
  { icon: Gem, label: 'Subscribe', path: '/subscriptions' },
]

const strategyRows: StrategyRow[] = [
  { label: 'Timeframe', value: 'Daily (D1)' },
  { label: 'Signal', value: 'MACD Bullish Crossover' },
  { label: 'Direction', value: 'Long only' },
  { label: 'Risk:Reward', value: '1:2' },
]

export default function Home() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: plans = [] } = usePlans()

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-5 pt-6 pb-4">
        <Card className="p-4 flex items-center gap-3 bg-card/90">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6c47ff22] to-[#f3b33d22] border border-border flex items-center justify-center shrink-0">
            <BrandLogo compact className="w-10 h-10 object-contain" alt="Zenith icon" />
          </div>
          <div className="min-w-0">
            <div className="text-foreground text-lg font-bold leading-tight">Zenith</div>
            <div className="text-muted-foreground text-xs mt-1">Crypto Trading Bot</div>
          </div>
        </Card>
      </div>

      {user && (
        <div className="px-5 pb-3 text-muted-foreground text-sm">
          Welcome back,{' '}
          <span className="text-[#a78bfa] font-semibold">{user.username}</span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 px-5 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Card
              key={item.label}
              className="p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-[#333] transition-colors"
              onClick={() => navigate(item.path)}
            >
              <Icon size={22} className="text-[#a78bfa]" />
              <div className="text-[11px] text-muted-foreground text-center leading-tight">
                {item.label}
              </div>
            </Card>
          )
        })}
      </div>

      <div className="text-foreground text-base font-semibold px-5 pb-2 pt-2">
        Subscription Plans
      </div>
      <Card className="mx-5 p-5">
        {plans.map((plan, i) => (
          <div key={plan.plan}>
            <div className="flex justify-between items-center py-3">
              <div>
                <div className="text-foreground font-semibold">
                  {plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1)}
                </div>
                <div className="text-muted-foreground text-xs">
                  {plan.coins} Coin{plan.coins > 1 ? 's' : ''} • {plan.description}
                </div>
              </div>
              <div className="text-[#a78bfa] font-bold">${plan.price}/mo</div>
            </div>
            {i < plans.length - 1 && <Separator />}
          </div>
        ))}
        <p className="text-muted-foreground text-xs mt-3">
          Capital is free — pay only for your subscription
        </p>
      </Card>

      <div className="text-foreground text-base font-semibold px-5 pt-5 pb-2">
        DCA_MACD_DAILY Strategy
      </div>
      <Card className="mx-5 p-5">
        {strategyRows.map((row, i) => (
          <div key={row.label}>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground text-sm">{row.label}</span>
              <span className="text-foreground font-semibold text-sm">{row.value}</span>
            </div>
            {i < strategyRows.length - 1 && <Separator />}
          </div>
        ))}
      </Card>
    </div>
  )
}
