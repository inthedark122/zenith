import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Search, Zap, MessageCircle, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { icon: Home, label: 'Home', path: '/home' },
  { icon: Search, label: 'Discover', path: '#' },
  { icon: Zap, label: 'Zenith', path: '/trading', center: true },
  { icon: MessageCircle, label: 'Live Chat', path: '#' },
  { icon: User, label: 'User', path: '/user' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around items-center px-0 py-2 pb-[calc(8px+env(safe-area-inset-bottom))] z-[100]">
      {navItems.map((item) => {
        const active = location.pathname === item.path
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="flex flex-col items-center gap-[3px] cursor-pointer min-w-[56px]"
            onClick={() => item.path !== '#' && navigate(item.path)}
          >
            {item.center ? (
              <div className="bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] w-[52px] h-[52px] rounded-full flex items-center justify-center -mt-5 shadow-[0_4px_20px_rgba(108,71,255,0.5)]">
                <Icon size={22} className="text-white" />
              </div>
            ) : (
              <Icon size={20} className={active ? 'text-[#a78bfa]' : 'text-muted-foreground'} />
            )}
            <span className={cn('text-[10px]', active ? 'font-semibold text-[#a78bfa]' : 'font-normal text-muted-foreground')}>
              {item.label}
            </span>
          </div>
        )
      })}
    </nav>
  )
}

