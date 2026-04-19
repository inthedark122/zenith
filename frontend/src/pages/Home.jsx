import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { usePlans } from '../hooks/useSubscriptions'

const menuItems = [
  { icon: '🔗', label: 'Bind API', path: '/exchanges' },
  { icon: '📖', label: 'API Tutorial', path: '#' },
  { icon: '📊', label: 'Overview', path: '/trading' },
  { icon: '🏆', label: 'Rankings', path: '#' },
  { icon: '⚙️', label: 'Setting', path: '#' },
  { icon: '👥', label: 'Referral', path: '/referral' },
  { icon: '💰', label: 'Wallets', path: '/wallets' },
  { icon: '💎', label: 'Subscribe', path: '/subscriptions' },
]

export default function Home() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: plans = [] } = usePlans()

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <div className="px-5 pt-6 pb-4 flex items-center justify-center">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] rounded-full flex items-center justify-center text-xl">⚡</div>
          <div className="text-white text-[22px] font-bold">ZenithCrypto</div>
        </div>
      </div>

      {user && (
        <div className="px-5 pb-3 text-[#aaa] text-sm">
          Welcome back, <span className="text-[#a78bfa] font-semibold">{user.username}</span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 px-5 py-4">
        {menuItems.map((item) => (
          <div
            key={item.label}
            className="bg-[#141414] rounded-[14px] p-4 flex flex-col items-center gap-2 cursor-pointer border border-[#222]"
            onClick={() => navigate(item.path)}
          >
            <div className="text-2xl">{item.icon}</div>
            <div className="text-[11px] text-[#aaa] text-center leading-tight">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="text-white text-base font-semibold px-5 pb-2 pt-2">Subscription Plans</div>
      <div className="mx-5 bg-[#141414] rounded-[14px] p-5 border border-[#333]">
        {plans.map((plan) => (
          <div key={plan.plan} className="flex justify-between items-center py-3 border-b border-[#222] last:border-b-0">
            <div>
              <div className="text-white font-semibold">{plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1)}</div>
              <div className="text-[#888] text-xs">{plan.coins} Coin{plan.coins > 1 ? 's' : ''} • {plan.description}</div>
            </div>
            <div className="text-[#a78bfa] font-bold">${plan.price}/mo</div>
          </div>
        ))}
        <div className="text-[#888] text-xs mt-3">Capital is free — pay only for your subscription</div>
      </div>

      <div className="text-white text-base font-semibold px-5 pt-5 pb-2">DCA_MACD_DAILY Strategy</div>
      <div className="mx-5 bg-[#141414] rounded-[14px] p-5 border border-[#333]">
        {[
          { label: 'Timeframe', value: 'Daily (D1)' },
          { label: 'Signal', value: 'MACD Bullish Crossover' },
          { label: 'Direction', value: 'Long only' },
          { label: 'Risk:Reward', value: '1:2' },
        ].map((row) => (
          <div key={row.label} className="flex justify-between py-2 border-b border-[#1a1a1a] last:border-b-0">
            <span className="text-[#888] text-sm">{row.label}</span>
            <span className="text-white font-semibold text-sm">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
