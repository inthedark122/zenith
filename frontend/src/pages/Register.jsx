import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import useAuthStore from '../store/authStore'

const styles = {
  page: { minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  card: { width: '100%', maxWidth: '400px', background: '#141414', borderRadius: '16px', padding: '40px 32px', border: '1px solid #222' },
  logo: { width: '56px', height: '56px', background: 'linear-gradient(135deg, #6c47ff 0%, #a78bfa 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 16px' },
  title: { textAlign: 'center', fontSize: '24px', fontWeight: '700', color: '#fff', marginBottom: '8px' },
  subtitle: { textAlign: 'center', color: '#888', fontSize: '14px', marginBottom: '32px' },
  label: { display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '6px' },
  input: { width: '100%', background: '#1e1e1e', border: '1px solid #333', borderRadius: '8px', padding: '12px 14px', color: '#fff', fontSize: '15px', outline: 'none', marginBottom: '16px' },
  btn: { width: '100%', background: 'linear-gradient(135deg, #6c47ff 0%, #a78bfa 100%)', border: 'none', borderRadius: '8px', padding: '14px', color: '#fff', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginBottom: '20px' },
  footer: { textAlign: 'center', color: '#888', fontSize: '13px' },
  link: { color: '#6c47ff', textDecoration: 'none' },
  error: { color: '#f87171', fontSize: '13px', marginBottom: '12px', textAlign: 'center' },
}

export default function Register() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [form, setForm] = useState({ email: '', username: '', password: '', referral_code: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = { ...form }
      if (!payload.referral_code) delete payload.referral_code
      const { data } = await client.post('/auth/register', payload)
      login(data.user, data.access_token)
      navigate('/home')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>⚡</div>
        <div style={styles.title}>Create Account</div>
        <div style={styles.subtitle}>Join Zenith Trading Bot</div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Email</label>
          <input style={styles.input} type="email" placeholder="Enter your email" value={form.email} onChange={set('email')} required />

          <label style={styles.label}>Username</label>
          <input style={styles.input} type="text" placeholder="Choose a username" value={form.username} onChange={set('username')} required />

          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" placeholder="Create a password" value={form.password} onChange={set('password')} required />

          <label style={styles.label}>Referral Code (optional)</label>
          <input style={styles.input} type="text" placeholder="Enter referral code" value={form.referral_code} onChange={set('referral_code')} />

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <div style={styles.footer}>
          Already have an account? <Link to="/login" style={styles.link}>Login</Link>
        </div>
      </div>
    </div>
  )
}
