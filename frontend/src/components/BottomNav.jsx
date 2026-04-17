import { useNavigate, useLocation } from 'react-router-dom'

const navItems = [
  { icon: '🏠', label: 'Home', path: '/home' },
  { icon: '🔍', label: 'Discover', path: '#' },
  { icon: '⚡', label: 'Zenith', path: '/trading', center: true },
  { icon: '💬', label: 'Live Chat', path: '#' },
  { icon: '👤', label: 'User', path: '/user' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] flex justify-around items-center px-0 py-2 pb-[calc(8px+env(safe-area-inset-bottom))] z-[100]">
      {navItems.map((item) => {
        const active = location.pathname === item.path
        return (
          <div
            key={item.label}
            className="flex flex-col items-center gap-[3px] cursor-pointer min-w-[56px]"
            onClick={() => item.path !== '#' && navigate(item.path)}
          >
            {item.center ? (
              <div className="text-[22px] bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] w-[52px] h-[52px] rounded-full flex items-center justify-center -mt-5 shadow-[0_4px_20px_rgba(108,71,255,0.5)]">
                {item.icon}
              </div>
            ) : (
              <div className="text-[20px]">{item.icon}</div>
            )}
            <span className={active ? 'text-[10px] font-semibold text-[#a78bfa]' : 'text-[10px] font-normal text-[#555]'}>
              {item.label}
            </span>
          </div>
        )
      })}
    </nav>
  )
}

