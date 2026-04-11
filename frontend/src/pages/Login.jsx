import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import useAuthStore from '../store/authStore'

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: '#141414',
    borderRadius: '16px',
    padding: '40px 32px',
    border: '1px solid #222',
  },
  logo: {
    width: '56px',
    height: '56px',
    background: 'linear-gradient(135deg, #6c47ff 0%, #a78bfa 100%)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    margin: '0 auto 16px',
  },
  title: { textAlign: 'center', fontSize: '24px', fontWeight: '700', color: '#fff', marginBottom: '8px' },
  subtitle: { textAlign: 'center', color: '#888', fontSize: '14px', marginBottom: '32px' },
  label: { display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '6px' },
  input: {
    width: '100%',
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '12px 14px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    marginBottom: '16px',
  },
  inputWrap: { position: 'relative', marginBottom: '0' },
  eye: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
  },
  forgot: { display: 'block', textAlign: 'right', color: '#6c47ff', fontSize: '13px', marginBottom: '20px', textDecoration: 'none' },
  checkRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' },
  checkLabel: { fontSize: '13px', color: '#888' },
  btn: {
    width: '100%',
    background: 'linear-gradient(135deg, #6c47ff 0%, #a78bfa 100%)',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '20px',
  },
  footer: { textAlign: 'center', color: '#888', fontSize: '13px' },
  link: { color: '#6c47ff', textDecoration: 'none' },
  error: { color: '#f87171', fontSize: '13px', marginBottom: '12px', textAlign: 'center' },
}

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!agreed) { setError('Please agree to the terms'); return }
    setLoading(true)
    setError('')
    try {
      const form = new URLSearchParams()
      form.append('username', email)
      form.append('password', password)
      const { data } = await client.post('/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      login(data.user, data.access_token)
      navigate('/home')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>⚡</div>
        <div style={styles.title}>Welcome Back</div>
        <div style={styles.subtitle}>Sign in to Zenith Trading Bot</div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label style={styles.label}>Password</label>
          <div style={{ ...styles.inputWrap, marginBottom: '4px' }}>
            <input
              style={{ ...styles.input, marginBottom: '0', paddingRight: '44px' }}
              type={showPw ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" style={styles.eye} onClick={() => setShowPw((p) => !p)}>
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>

          <a href="#" style={styles.forgot}>Forgot Password?</a>

          <div style={styles.checkRow}>
            <input type="checkbox" id="agree" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <label htmlFor="agree" style={styles.checkLabel}>
              I agree to the <a href="#" style={styles.link}>Terms of Service</a> and <a href="#" style={styles.link}>Privacy Policy</a>
            </label>
          </div>

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <div style={styles.footer}>
          Don't have an account? <Link to="/register" style={styles.link}>Register</Link>
        </div>
      </div>
    </div>
  )
}
