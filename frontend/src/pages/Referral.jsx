import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import client from '../api/client'

const s = {
  page: { minHeight: '100vh', background: '#0a0a0a', paddingBottom: '80px' },
  header: { padding: '24px 20px 8px', display: 'flex', alignItems: 'center', gap: '12px' },
  back: { background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer' },
  title: { color: '#fff', fontSize: '20px', fontWeight: '700' },
  hero: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 20px 24px' },
  giftBox: { fontSize: '80px', marginBottom: '12px' },
  heroTitle: { color: '#fff', fontSize: '22px', fontWeight: '700', marginBottom: '6px' },
  heroSub: { color: '#888', fontSize: '14px', textAlign: 'center', lineHeight: '1.5' },
  codeCard: { margin: '0 20px 16px', background: '#141414', borderRadius: '14px', padding: '20px', border: '1px solid #333' },
  codeLabel: { color: '#888', fontSize: '12px', marginBottom: '8px' },
  codeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  codeValue: { color: '#a78bfa', fontSize: '24px', fontWeight: '800', letterSpacing: '3px' },
  copyBtn: { background: 'linear-gradient(135deg, #6c47ff 0%, #a78bfa 100%)', border: 'none', borderRadius: '8px', color: '#fff', padding: '10px 20px', cursor: 'pointer', fontWeight: '600' },
  qrCard: { margin: '0 20px 16px', background: '#141414', borderRadius: '14px', padding: '20px', border: '1px solid #222', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  qrBox: { width: '140px', height: '140px', background: '#1e1e1e', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#555', marginBottom: '10px' },
  shareBtn: { margin: '0 20px', width: 'calc(100% - 40px)', background: 'linear-gradient(135deg, #6c47ff 0%, #a78bfa 100%)', border: 'none', borderRadius: '12px', color: '#fff', padding: '16px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' },
  statsRow: { display: 'flex', gap: '12px', margin: '16px 20px' },
  statCard: { flex: 1, background: '#141414', borderRadius: '12px', padding: '16px', border: '1px solid #222', textAlign: 'center' },
  statValue: { color: '#a78bfa', fontSize: '22px', fontWeight: '800' },
  statLabel: { color: '#888', fontSize: '12px', marginTop: '4px' },
}

export default function Referral() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [community, setCommunity] = useState(null)

  useEffect(() => {
    client.get('/referral/community').then((r) => setCommunity(r.data)).catch(() => {})
  }, [])

  const referralLink = `${window.location.origin}/register?ref=${user?.referral_code}`
  const copyCode = () => navigator.clipboard.writeText(user?.referral_code || '').catch(() => {})
  const copyLink = () => navigator.clipboard.writeText(referralLink).catch(() => {})

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>←</button>
        <div style={s.title}>Invite & Earn</div>
      </div>

      <div style={s.hero}>
        <div style={s.giftBox}>🎁</div>
        <div style={s.heroTitle}>Earn with Every Referral</div>
        <div style={s.heroSub}>
          Level 1: 50% • Level 2: 30% • Level 3: 20%{'\n'}
          Earn from every subscription your network makes!
        </div>
      </div>

      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statValue}>{community?.members?.length ?? 0}</div>
          <div style={s.statLabel}>Total Referrals</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statValue}>${Number(community?.total_commission ?? 0).toFixed(2)}</div>
          <div style={s.statLabel}>Total Earned</div>
        </div>
      </div>

      <div style={s.codeCard}>
        <div style={s.codeLabel}>Your Referral Code</div>
        <div style={s.codeRow}>
          <div style={s.codeValue}>{user?.referral_code}</div>
          <button style={s.copyBtn} onClick={copyCode}>Copy</button>
        </div>
      </div>

      <div style={s.qrCard}>
        <div style={s.qrBox}>QR Code</div>
        <div style={{ color: '#888', fontSize: '12px' }}>Scan to join with your referral</div>
      </div>

      <button style={s.shareBtn} onClick={copyLink}>
        📋 Copy Referral Link
      </button>
    </div>
  )
}
