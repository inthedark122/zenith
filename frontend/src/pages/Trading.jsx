import { useState, useEffect } from 'react'
import client from '../api/client'

const s = {
  page: { minHeight: '100vh', background: '#0a0a0a', paddingBottom: '80px' },
  header: { padding: '24px 20px 16px' },
  title: { color: '#fff', fontSize: '22px', fontWeight: '700' },
  subtitle: { color: '#888', fontSize: '14px', marginTop: '4px' },
  card: { margin: '0 20px 16px', background: '#141414', borderRadius: '14px', padding: '20px', border: '1px solid #222' },
  cardTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', marginBottom: '16px' },
  label: { display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '6px' },
  input: { width: '100%', background: '#1e1e1e', border: '1px solid #333', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none', marginBottom: '12px' },
  row: { display: 'flex', gap: '10px' },
  btn: { background: 'linear-gradient(135deg, #6c47ff 0%, #a78bfa 100%)', border: 'none', borderRadius: '8px', color: '#fff', padding: '12px 20px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  btnOutline: { background: 'none', border: '1px solid #6c47ff', borderRadius: '8px', color: '#a78bfa', padding: '12px 20px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  botCard: { margin: '0 20px 10px', background: '#141414', borderRadius: '12px', padding: '16px', border: '1px solid #222' },
  botHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  botSymbol: { color: '#fff', fontWeight: '700', fontSize: '16px' },
  statusBadge: (active) => ({ background: active ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', color: active ? '#34d399' : '#f87171', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: '600' }),
  botDetail: { color: '#888', fontSize: '12px' },
  error: { color: '#f87171', fontSize: '13px', margin: '0 20px 8px' },
  success: { color: '#34d399', fontSize: '13px', margin: '0 20px 8px' },
  sectionTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', padding: '16px 20px 8px' },
  empty: { textAlign: 'center', color: '#555', padding: '24px 20px', fontSize: '14px' },
}

export default function Trading() {
  const [configs, setConfigs] = useState([])
  const [form, setForm] = useState({ symbol: 'BTC/USDT', base_amount: '100', safety_order_multiplier: '2', price_deviation: '0.04', max_safety_orders: '6' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const loadConfigs = () => client.get('/trading/dca-configs').then((r) => setConfigs(r.data)).catch(() => {})

  useEffect(() => { loadConfigs() }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await client.post('/trading/dca-configs', {
        symbol: form.symbol,
        base_amount: parseFloat(form.base_amount),
        safety_order_multiplier: parseFloat(form.safety_order_multiplier),
        price_deviation: parseFloat(form.price_deviation),
        max_safety_orders: parseInt(form.max_safety_orders, 10),
      })
      setSuccess('DCA bot configured successfully!')
      loadConfigs()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create config')
    } finally {
      setLoading(false)
    }
  }

  const handleStart = async (id) => {
    try {
      await client.post(`/trading/start/${id}`)
      loadConfigs()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start bot')
    }
  }

  const handleStop = async (id) => {
    try {
      await client.post(`/trading/stop/${id}`)
      loadConfigs()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to stop bot')
    }
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>DCA Trading Bots</div>
        <div style={s.subtitle}>Automate your crypto accumulation strategy</div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>⚙️ New DCA Bot</div>
        <form onSubmit={handleCreate}>
          <label style={s.label}>Symbol (e.g. BTC/USDT)</label>
          <input style={s.input} value={form.symbol} onChange={set('symbol')} placeholder="BTC/USDT" required />

          <label style={s.label}>Base Order Amount (USDT)</label>
          <input style={s.input} type="number" value={form.base_amount} onChange={set('base_amount')} min="1" step="any" required />

          <div style={s.row}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Multiplier</label>
              <input style={s.input} type="number" value={form.safety_order_multiplier} onChange={set('safety_order_multiplier')} step="0.1" min="1" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Price Dev %</label>
              <input style={s.input} type="number" value={form.price_deviation} onChange={set('price_deviation')} step="0.01" min="0.01" max="1" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Max Safety</label>
              <input style={s.input} type="number" value={form.max_safety_orders} onChange={set('max_safety_orders')} min="1" max="10" />
            </div>
          </div>

          <button type="submit" style={s.btn} disabled={loading}>
            {loading ? 'Creating…' : 'Create Bot'}
          </button>
        </form>
      </div>

      {error && <div style={s.error}>{error}</div>}
      {success && <div style={s.success}>{success}</div>}

      <div style={s.sectionTitle}>My Bots</div>
      {configs.length === 0 ? (
        <div style={s.empty}>No bots configured yet</div>
      ) : (
        configs.map((cfg) => (
          <div key={cfg.id} style={s.botCard}>
            <div style={s.botHeader}>
              <div style={s.botSymbol}>{cfg.symbol}</div>
              <span style={s.statusBadge(cfg.is_active)}>{cfg.is_active ? 'Running' : 'Idle'}</span>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {[
                { l: 'Base Amount', v: `$${cfg.base_amount}` },
                { l: 'Multiplier', v: `${cfg.safety_order_multiplier}×` },
                { l: 'Deviation', v: `${(cfg.price_deviation * 100).toFixed(0)}%` },
                { l: 'Max Orders', v: cfg.max_safety_orders },
              ].map(({ l, v }) => (
                <div key={l}>
                  <div style={{ color: '#555', fontSize: '11px' }}>{l}</div>
                  <div style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={s.row}>
              {cfg.is_active ? (
                <button style={s.btnOutline} onClick={() => handleStop(cfg.id)}>⏹ Stop</button>
              ) : (
                <button style={s.btn} onClick={() => handleStart(cfg.id)}>▶ Start</button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
