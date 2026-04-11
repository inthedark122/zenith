import { useNavigate, useLocation } from 'react-router-dom'

const navItems = [
  { icon: '🏠', label: 'Home', path: '/home' },
  { icon: '🔍', label: 'Discover', path: '#' },
  { icon: '⚡', label: 'Zenith', path: '/trading', center: true },
  { icon: '💬', label: 'Live Chat', path: '#' },
  { icon: '👤', label: 'User', path: '/user' },
]

const s = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#111',
    borderTop: '1px solid #222',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
    zIndex: 100,
  },
  item: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', minWidth: '56px' },
  icon: (active, center) => ({
    fontSize: center ? '22px' : '20px',
    ...(center
      ? {
          background: 'linear-gradient(135deg, #6c47ff 0%, #a78bfa 100%)',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '-20px',
          boxShadow: '0 4px 20px rgba(108,71,255,0.5)',
        }
      : {}),
  }),
  label: (active) => ({ fontSize: '10px', color: active ? '#a78bfa' : '#555', fontWeight: active ? '600' : '400' }),
}

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav style={s.nav}>
      {navItems.map((item) => {
        const active = location.pathname === item.path
        return (
          <div
            key={item.label}
            style={s.item}
            onClick={() => item.path !== '#' && navigate(item.path)}
          >
            <div style={s.icon(active, item.center)}>{item.icon}</div>
            <div style={s.label(active)}>{item.label}</div>
          </div>
        )
      })}
    </nav>
  )
}
