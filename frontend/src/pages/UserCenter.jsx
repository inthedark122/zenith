import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { useMySubs } from '../hooks/useSubscriptions'

const menuItems = [
  { icon: '💼', label: 'My Wallets', path: '/wallets' },
  { icon: '🔗', label: 'Exchanges', path: '/exchanges' },
  { icon: '💎', label: 'Subscriptions', path: '/subscriptions' },
  { icon: '👥', label: 'My Community', path: '/referral' },
  { icon: '🎁', label: 'Referral', path: '/referral' },
  { icon: '📢', label: 'Announcements', path: '#' },
  { icon: '❓', label: 'Help and Support', path: '#' },
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
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <div className="flex flex-col items-center px-5 pt-10 pb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] rounded-full flex items-center justify-center text-4xl mb-3">👤</div>
        <div className="text-white text-xl font-bold mb-1">{user?.username || 'User'}</div>
        <div className="text-[#888] text-sm">{user?.email}</div>
        {activeSub && (
          <div className="mt-2.5 bg-[rgba(108,71,255,0.15)] border border-[#6c47ff] rounded-full px-3.5 py-1 text-[#a78bfa] text-xs font-semibold">
            {activeSub.plan.charAt(0).toUpperCase() + activeSub.plan.slice(1)} Plan Active
          </div>
        )}
      </div>

      <div className="mx-5 mb-5 bg-[#141414] rounded-[14px] p-4 border border-[#222]">
        <div className="flex justify-between items-center py-2.5 border-b border-[#1a1a1a]">
          <div className="text-[#888] text-sm">UID</div>
          <div className="text-white text-sm flex items-center gap-2">
            {user?.id}
            <button className="bg-[#222] border border-[#333] rounded-md text-[#a78bfa] text-[11px] px-2 py-0.5 cursor-pointer" onClick={() => copy(String(user?.id))}>Copy</button>
          </div>
        </div>
        <div className="flex justify-between items-center py-2.5">
          <div className="text-[#888] text-sm">Referral Code</div>
          <div className="text-white text-sm flex items-center gap-2">
            {user?.referral_code}
            <button className="bg-[#222] border border-[#333] rounded-md text-[#a78bfa] text-[11px] px-2 py-0.5 cursor-pointer" onClick={() => copy(user?.referral_code)}>Copy</button>
          </div>
        </div>
      </div>

      <div className="mx-5">
        {menuItems.map((item) => (
          <div
            key={item.label}
            className="flex justify-between items-center bg-[#141414] rounded-xl p-4 mb-2 cursor-pointer border border-[#222]"
            onClick={() => navigate(item.path)}
          >
            <div className="flex items-center gap-3">
              <div className="text-xl">{item.icon}</div>
              <div className="text-white text-base">{item.label}</div>
            </div>
            <div className="text-[#555] text-lg">›</div>
          </div>
        ))}
      </div>

      <button
        className="mx-5 mt-4 w-[calc(100%-40px)] bg-transparent border border-[#f87171] rounded-xl text-[#f87171] py-3.5 text-base cursor-pointer"
        onClick={handleLogout}
      >
        Log Out
      </button>
    </div>
  )
}
