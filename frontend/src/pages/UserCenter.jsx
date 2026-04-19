import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import client from '../api/client'

const s = {
  page: { minHeight: '100vh', background: '#0a0a0a', paddingBottom: '80px' },
  avatarSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 24px' },
  avatar: { width: '80px', height: '80px', background: 'linear-gradient(135deg, #6c47ff 0%, #a78bfa 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', marginBottom: '12px' },
  username: { color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '4px' },
  email: { color: '#888', fontSize: '13px' },
  infoCard: { margin: '0 20px 20px', background: '#141414', borderRadius: '14px', padding: '16px', border: '1px solid #222' },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1a1a1a' },
  infoLabel: { color: '#888', fontSize: '13px' },
  infoValue: { color: '#fff', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' },
  copyBtn: { background: '#222', border: '1px solid #333', borderRadius: '6px', color: '#a78bfa', fontSize: '11px', padding: '3px 8px', cursor: 'pointer' },
  menu: { margin: '0 20px' },
  menuItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#141414', borderRadius: '12px', padding: '16px', marginBottom: '8px', cursor: 'pointer', border: '1px solid #222' },
  menuLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  menuIcon: { fontSize: '20px' },
  menuLabel: { color: '#fff', fontSize: '15px' },
  menuChevron: { color: '#555', fontSize: '18px' },
  logoutBtn: { margin: '16px 20px', width: 'calc(100% - 40px)', background: 'none', border: '1px solid #f87171', borderRadius: '12px', color: '#f87171', padding: '14px', fontSize: '15px', cursor: 'pointer' },
}

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
  const [activeSub, setActiveSub] = useState(null)

  useEffect(() => {
    client.get('/subscriptions/me')
      .then((r) => setActiveSub(r.data.find((s) => s.status === 'active') || null))
      .catch(() => {})
  }, [])

  const copy = (text) => navigator.clipboard.writeText(text).catch(() => {})

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={s.page}>
      <div style={s.avatarSection}>
        <div style={s.avatar}>👤</div>
        <div style={s.username}>{user?.username || 'User'}</div>
        <div style={s.email}>{user?.email}</div>
        {activeSub && (
          <div style={{ marginTop: '10px', background: 'rgba(108,71,255,0.15)', border: '1px solid #6c47ff', borderRadius: '20px', padding: '4px 14px', color: '#a78bfa', fontSize: '12px', fontWeight: '600' }}>
            {activeSub.plan.charAt(0).toUpperCase() + activeSub.plan.slice(1)} Plan Active
          </div>
        )}
      </div>

      <div style={s.infoCard}>
        <div style={s.infoRow}>
          <div style={s.infoLabel}>UID</div>
          <div style={s.infoValue}>
            {user?.id}
            <button style={s.copyBtn} onClick={() => copy(String(user?.id))}>Copy</button>
          </div>
        </div>
        <div style={{ ...s.infoRow, borderBottom: 'none' }}>
          <div style={s.infoLabel}>Referral Code</div>
          <div style={s.infoValue}>
            {user?.referral_code}
            <button style={s.copyBtn} onClick={() => copy(user?.referral_code)}>Copy</button>
          </div>
        </div>
      </div>

      <div style={s.menu}>
        {menuItems.map((item) => (
          <div key={item.label} style={s.menuItem} onClick={() => navigate(item.path)}>
            <div style={s.menuLeft}>
              <div style={s.menuIcon}>{item.icon}</div>
              <div style={s.menuLabel}>{item.label}</div>
            </div>
            <div style={s.menuChevron}>›</div>
          </div>
        ))}
      </div>

      <button style={s.logoutBtn} onClick={handleLogout}>Log Out</button>
    </div>
  )
}
