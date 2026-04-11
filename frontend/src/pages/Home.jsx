import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

const s = {
  page: { minHeight: '100vh', background: '#0a0a0a', paddingBottom: '80px' },
  header: { padding: '24px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logo: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoIcon: { width: '40px', height: '40px', background: 'linear-gradient(135deg, #6c47ff 0%, #a78bfa 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' },
  logoText: { fontSize: '22px', fontWeight: '700', color: '#fff' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '16px 20px' },
  tile: { background: '#141414', borderRadius: '14px', padding: '18px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', border: '1px solid #222' },
  tileIcon: { fontSize: '26px' },
  tileLabel: { fontSize: '11px', color: '#aaa', textAlign: 'center', lineHeight: '1.3' },
  sectionTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', padding: '16px 20px 8px' },
  subscriptionCard: { margin: '0 20px', background: '#141414', borderRadius: '14px', padding: '20px', border: '1px solid #333' },
  planRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #222' },
  planName: { color: '#fff', fontWeight: '600' },
  planPrice: { color: '#a78bfa', fontWeight: '700' },
  planDetail: { color: '#888', fontSize: '12px' },
}

const menuItems = [
  { icon: '🔗', label: 'Bind API', path: '/trading' },
  { icon: '📖', label: 'API Tutorial', path: '#' },
  { icon: '📊', label: 'Overview', path: '/trading' },
  { icon: '🏆', label: 'Rankings', path: '#' },
  { icon: '⚙️', label: 'Setting', path: '#' },
  { icon: '👥', label: 'Referral', path: '/referral' },
  { icon: '💰', label: 'Wallets', path: '/wallets' },
  { icon: '•••', label: 'More', path: '#' },
]

export default function Home() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>
          <div style={s.logoIcon}>⚡</div>
          <div style={s.logoText}>ZenithCrypto</div>
        </div>
      </div>

      {user && (
        <div style={{ padding: '0 20px 12px', color: '#aaa', fontSize: '14px' }}>
          Welcome back, <span style={{ color: '#a78bfa', fontWeight: '600' }}>{user.username}</span>
        </div>
      )}

      <div style={s.grid}>
        {menuItems.map((item) => (
          <div key={item.label} style={s.tile} onClick={() => navigate(item.path)}>
            <div style={s.tileIcon}>{item.icon}</div>
            <div style={s.tileLabel}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={s.sectionTitle}>Subscription Plans</div>
      <div style={s.subscriptionCard}>
        {[
          { name: 'Starter', coins: '1 Coin', price: '$15/mo' },
          { name: 'Pro', coins: '2 Coins', price: '$20/mo' },
          { name: 'Elite', coins: '3 Coins', price: '$25/mo' },
        ].map((plan) => (
          <div key={plan.name} style={s.planRow}>
            <div>
              <div style={s.planName}>{plan.name}</div>
              <div style={s.planDetail}>{plan.coins} • DCA Strategy</div>
            </div>
            <div style={s.planPrice}>{plan.price}</div>
          </div>
        ))}
        <div style={{ color: '#888', fontSize: '12px', marginTop: '12px' }}>
          Capital is free — pay only for your subscription
        </div>
      </div>

      <div style={s.sectionTitle}>DCA Strategy</div>
      <div style={{ margin: '0 20px', background: '#141414', borderRadius: '14px', padding: '20px', border: '1px solid #333' }}>
        {[
          { label: 'Order Multiplier', value: '2×' },
          { label: 'Price Deviation', value: '4%' },
          { label: 'Safety Orders', value: '6 max' },
          { label: 'Market', value: 'SPOT only' },
        ].map((row) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
            <span style={{ color: '#888', fontSize: '14px' }}>{row.label}</span>
            <span style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
