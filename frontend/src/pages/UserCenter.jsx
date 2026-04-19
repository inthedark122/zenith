import { useNavigate } from 'react-router-dom'
import { Wallet, Link2, Gem, Users, Gift, Megaphone, HelpCircle, ChevronRight, Copy, User, LogOut } from 'lucide-react'
import useAuthStore from '../store/authStore'
import { useMySubs } from '../hooks/useSubscriptions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const menuItems = [
  { icon: Wallet, label: 'My Wallets', path: '/wallets' },
  { icon: Link2, label: 'Exchanges', path: '/exchanges' },
  { icon: Gem, label: 'Subscriptions', path: '/subscriptions' },
  { icon: Users, label: 'My Community', path: '/referral' },
  { icon: Gift, label: 'Referral', path: '/referral' },
  { icon: Megaphone, label: 'Announcements', path: '#' },
  { icon: HelpCircle, label: 'Help and Support', path: '#' },
]

export default function UserCenter() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { data: mySubs = [] } = useMySubs()
  const activeSub = mySubs.find((s) => s.status === 'active') || null

  const copy = (text) => navigator.clipboard.writeText(text).catch(() => {})

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="flex flex-col items-center px-5 pt-10 pb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] rounded-full flex items-center justify-center mb-3">
          <User size={40} className="text-white" />
        </div>
        <h1 className="text-foreground text-xl font-bold mb-1">{user?.username || 'User'}</h1>
        <p className="text-muted-foreground text-sm">{user?.email}</p>
        {activeSub && (
          <Badge variant="default" className="mt-2.5 rounded-full">
            {activeSub.plan.charAt(0).toUpperCase() + activeSub.plan.slice(1)} Plan Active
          </Badge>
        )}
      </div>

      <Card className="mx-5 mb-5 p-4">
        <div className="flex justify-between items-center py-2.5">
          <span className="text-muted-foreground text-sm">UID</span>
          <div className="text-foreground text-sm flex items-center gap-2">
            {user?.id}
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px] text-[#a78bfa]"
              onClick={() => copy(String(user?.id))}
            >
              <Copy size={10} className="mr-1" />Copy
            </Button>
          </div>
        </div>
        <Separator />
        <div className="flex justify-between items-center py-2.5">
          <span className="text-muted-foreground text-sm">Referral Code</span>
          <div className="text-foreground text-sm flex items-center gap-2">
            {user?.referral_code}
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px] text-[#a78bfa]"
              onClick={() => copy(user?.referral_code)}
            >
              <Copy size={10} className="mr-1" />Copy
            </Button>
          </div>
        </div>
      </Card>

      <div className="mx-5">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Card
              key={item.label}
              className="flex justify-between items-center p-4 mb-2 cursor-pointer hover:border-[#333] transition-colors"
              onClick={() => navigate(item.path)}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} className="text-[#a78bfa]" />
                <span className="text-foreground text-base">{item.label}</span>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Card>
          )
        })}
      </div>

      <Button
        variant="danger"
        size="lg"
        className="mx-5 mt-4 w-[calc(100%-40px)]"
        onClick={handleLogout}
      >
        <LogOut size={16} />
        Log Out
      </Button>
    </div>
  )
}
