import { useNavigate } from 'react-router-dom'
import { Link2, BookOpen, BarChart2, Trophy, Settings, Users, Wallet, Gem, Zap } from 'lucide-react'
import useAuthStore from '../store/authStore'
import { usePlans } from '../hooks/useSubscriptions'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const menuItems = [
  { icon: Link2, label: 'Bind API', path: '/exchanges' },
  { icon: BookOpen, label: 'API Tutorial', path: '#' },
  { icon: BarChart2, label: 'Overview', path: '/trading' },
  { icon: Trophy, label: 'Rankings', path: '#' },
  { icon: Settings, label: 'Setting', path: '#' },
  { icon: Users, label: 'Referral', path: '/referral' },
  { icon: Wallet, label: 'Wallets', path: '/wallets' },
  { icon: Gem, label: 'Subscribe', path: '/subscriptions' },
]

const strategyRows = [
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
      <div className="px-5 pt-6 pb-4 flex items-center justify-center">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] rounded-full flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <div className="text-foreground text-[22px] font-bold">ZenithCrypto</div>
        </div>
      </div>

      {user && (
        <div className="px-5 pb-3 text-muted-foreground text-sm">
          Welcome back, <span className="text-[#a78bfa] font-semibold">{user.username}</span>
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
              <div className="text-[11px] text-muted-foreground text-center leading-tight">{item.label}</div>
            </Card>
          )
        })}
      </div>

      <div className="text-foreground text-base font-semibold px-5 pb-2 pt-2">Subscription Plans</div>
      <Card className="mx-5 p-5">
        {plans.map((plan, i) => (
          <div key={plan.plan}>
            <div className="flex justify-between items-center py-3">
              <div>
                <div className="text-foreground font-semibold">{plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1)}</div>
                <div className="text-muted-foreground text-xs">{plan.coins} Coin{plan.coins > 1 ? 's' : ''} • {plan.description}</div>
              </div>
              <div className="text-[#a78bfa] font-bold">${plan.price}/mo</div>
            </div>
            {i < plans.length - 1 && <Separator />}
          </div>
        ))}
        <p className="text-muted-foreground text-xs mt-3">Capital is free — pay only for your subscription</p>
      </Card>

      <div className="text-foreground text-base font-semibold px-5 pt-5 pb-2">DCA_MACD_DAILY Strategy</div>
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
