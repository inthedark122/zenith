import { useState, useEffect } from 'react'
import client from '../api/client'

const MACD_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'HYPE/USDT']

const s = {
  page: { minHeight: '100vh', background: '#0a0a0a', paddingBottom: '80px' },
  header: { padding: '24px 20px 16px' },
  title: { color: '#fff', fontSize: '22px', fontWeight: '700' },
  subtitle: { color: '#888', fontSize: '14px', marginTop: '4px' },
  card: { margin: '0 20px 16px', background: '#141414', borderRadius: '14px', padding: '20px', border: '1px solid #222' },
  cardTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', marginBottom: '16px' },
  label: { display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '6px' },
  input: { width: '100%', background: '#1e1e1e', border: '1px solid #333', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none', marginBottom: '12px' },
  select: { width: '100%', background: '#1e1e1e', border: '1px solid #333', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '14px', outline: 'none', marginBottom: '12px' },
  row: { display: 'flex', gap: '10px' },
  btn: { background: 'linear-gradient(135deg, #6c47ff 0%, #a78bfa 100%)', border: 'none', borderRadius: '8px', color: '#fff', padding: '12px 20px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  btnGreen: { background: 'linear-gradient(135deg, #059669 0%, #34d399 100%)', border: 'none', borderRadius: '8px', color: '#fff', padding: '12px 20px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  btnRed: { background: 'rgba(248,113,113,0.15)', border: '1px solid #f87171', borderRadius: '8px', color: '#f87171', padding: '12px 20px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  btnOutline: { background: 'none', border: '1px solid #6c47ff', borderRadius: '8px', color: '#a78bfa', padding: '12px 20px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  botCard: { margin: '0 20px 10px', background: '#141414', borderRadius: '12px', padding: '16px', border: '1px solid #222' },
  botHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  botSymbol: { color: '#fff', fontWeight: '700', fontSize: '16px' },
  statusBadge: (active) => ({ background: active ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', color: active ? '#34d399' : '#f87171', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: '600' }),
  resultBadge: (result) => ({
    background: result === 'win' ? 'rgba(52,211,153,0.15)' : result === 'loss' ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)',
    color: result === 'win' ? '#34d399' : result === 'loss' ? '#f87171' : '#fbbf24',
    borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: '600',
  }),
  botDetail: { color: '#888', fontSize: '12px' },
  error: { color: '#f87171', fontSize: '13px', margin: '0 20px 8px' },
  success: { color: '#34d399', fontSize: '13px', margin: '0 20px 8px' },
  sectionTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', padding: '16px 20px 8px' },
  empty: { textAlign: 'center', color: '#555', padding: '24px 20px', fontSize: '14px' },
  tabBar: { display: 'flex', margin: '0 20px 8px', borderBottom: '1px solid #222' },
  tab: (active) => ({ padding: '10px 20px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: active ? '#a78bfa' : '#555', borderBottom: active ? '2px solid #a78bfa' : '2px solid transparent', background: 'none', border: 'none' }),
  signalBox: { background: '#1e1e1e', borderRadius: '10px', padding: '14px', marginBottom: '14px' },
  signalRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  signalKey: { color: '#888', fontSize: '13px' },
  signalVal: { color: '#fff', fontSize: '13px', fontWeight: '600' },
  crossBull: { color: '#34d399', fontWeight: '700', fontSize: '13px' },
  crossBear: { color: '#f87171', fontWeight: '700', fontSize: '13px' },
  crossNone: { color: '#888', fontWeight: '600', fontSize: '13px' },
  divider: { borderTop: '1px solid #222', margin: '16px 0' },
  infoBox: { background: '#1a1a2e', border: '1px solid #6c47ff33', borderRadius: '10px', padding: '14px', marginBottom: '14px' },
  infoText: { color: '#a78bfa', fontSize: '12px', lineHeight: '1.6' },
}

// ---- DCA Panel ----
function DCAPanel() {
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
    setLoading(true); setError(''); setSuccess('')
    try {
      await client.post('/trading/dca-configs', {
        symbol: form.symbol,
        base_amount: parseFloat(form.base_amount),
        safety_order_multiplier: parseFloat(form.safety_order_multiplier),
        price_deviation: parseFloat(form.price_deviation),
        max_safety_orders: parseInt(form.max_safety_orders, 10),
      })
      setSuccess('DCA bot configured!')
      loadConfigs()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create config')
    } finally { setLoading(false) }
  }

  const handleStart = async (id) => { try { await client.post(`/trading/start/${id}`); loadConfigs() } catch (err) { setError(err.response?.data?.detail || 'Failed') } }
  const handleStop = async (id) => { try { await client.post(`/trading/stop/${id}`); loadConfigs() } catch (err) { setError(err.response?.data?.detail || 'Failed') } }

  return (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>⚙️ New DCA Bot</div>
        <div style={s.infoBox}>
          <div style={s.infoText}>
            Strategy: 2× safety order size per step · 4% price deviation · up to 6 safety orders
          </div>
        </div>
        <form onSubmit={handleCreate}>
          <label style={s.label}>Symbol (e.g. BTC/USDT)</label>
          <input style={s.input} value={form.symbol} onChange={set('symbol')} placeholder="BTC/USDT" required />
          <label style={s.label}>Base Order Amount (USDT)</label>
          <input style={s.input} type="number" value={form.base_amount} onChange={set('base_amount')} min="1" step="any" required />
          <div style={s.row}>
            <div style={{ flex: 1 }}><label style={s.label}>Multiplier</label><input style={s.input} type="number" value={form.safety_order_multiplier} onChange={set('safety_order_multiplier')} step="0.1" min="1" /></div>
            <div style={{ flex: 1 }}><label style={s.label}>Price Dev %</label><input style={s.input} type="number" value={form.price_deviation} onChange={set('price_deviation')} step="0.01" min="0.01" max="1" /></div>
            <div style={{ flex: 1 }}><label style={s.label}>Max Safety</label><input style={s.input} type="number" value={form.max_safety_orders} onChange={set('max_safety_orders')} min="1" max="10" /></div>
          </div>
          <button type="submit" style={s.btn} disabled={loading}>{loading ? 'Creating…' : 'Create Bot'}</button>
        </form>
      </div>
      {error && <div style={s.error}>{error}</div>}
      {success && <div style={s.success}>{success}</div>}
      <div style={s.sectionTitle}>My DCA Bots</div>
      {configs.length === 0 ? <div style={s.empty}>No DCA bots configured yet</div> : configs.map((cfg) => (
        <div key={cfg.id} style={s.botCard}>
          <div style={s.botHeader}>
            <div style={s.botSymbol}>{cfg.symbol}</div>
            <span style={s.statusBadge(cfg.is_active)}>{cfg.is_active ? 'Running' : 'Idle'}</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {[{ l: 'Base Amount', v: `$${cfg.base_amount}` }, { l: 'Multiplier', v: `${cfg.safety_order_multiplier}×` }, { l: 'Deviation', v: `${(cfg.price_deviation * 100).toFixed(0)}%` }, { l: 'Max Orders', v: cfg.max_safety_orders }].map(({ l, v }) => (
              <div key={l}><div style={{ color: '#555', fontSize: '11px' }}>{l}</div><div style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>{v}</div></div>
            ))}
          </div>
          <div style={s.row}>{cfg.is_active ? <button style={s.btnOutline} onClick={() => handleStop(cfg.id)}>⏹ Stop</button> : <button style={s.btn} onClick={() => handleStart(cfg.id)}>▶ Start</button>}</div>
        </div>
      ))}
    </>
  )
}

// ---- MACD D1 Panel ----
function MACDPanel() {
  const [configs, setConfigs] = useState([])
  const [trades, setTrades] = useState([])
  const [form, setForm] = useState({ symbol: 'BTC/USDT', margin_per_trade: '10', leverage: '20', rr_ratio: '2' })
  const [signal, setSignal] = useState(null)
  const [signalConfigId, setSignalConfigId] = useState(null)
  const [openForm, setOpenForm] = useState({ configId: null, entry_price: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const loadAll = () => {
    client.get('/trading/macd-configs').then((r) => setConfigs(r.data)).catch(() => {})
    client.get('/trading/macd-trades').then((r) => setTrades(r.data)).catch(() => {})
  }
  useEffect(() => { loadAll() }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    try {
      await client.post('/trading/macd-configs', {
        symbol: form.symbol,
        margin_per_trade: parseFloat(form.margin_per_trade),
        leverage: parseFloat(form.leverage),
        rr_ratio: parseFloat(form.rr_ratio),
      })
      setSuccess('MACD bot created!')
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create MACD config')
    } finally { setLoading(false) }
  }

  const handleCheckSignal = async (configId) => {
    setSignalConfigId(configId); setSignal(null)
    try {
      const { data } = await client.get(`/trading/macd-signal/${configId}`)
      setSignal(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch signal')
    }
  }

  const handleOpenTrade = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    try {
      await client.post(`/trading/macd-open/${openForm.configId}`, { entry_price: parseFloat(openForm.entry_price) })
      setSuccess('Trade opened!')
      setOpenForm({ configId: null, entry_price: '' })
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to open trade')
    }
  }

  const handleCloseTrade = async (tradeId, result) => {
    try {
      await client.post(`/trading/macd-close/${tradeId}`, { result })
      setSuccess(`Trade closed as ${result}`)
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to close trade')
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayTrades = trades.filter((t) => t.trade_date === todayStr)

  return (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>📈 New MACD D1 Bot</div>
        <div style={s.infoBox}>
          <div style={s.infoText}>
            <strong style={{ color: '#c4b5fd' }}>Strategy rules:</strong><br />
            • Assets: BTC/USDT, ETH/USDT, HYPE/USDT only<br />
            • Signal: Daily MACD bullish crossover → Long<br />
            • Risk/Reward: 1:2 (risk 100% margin, target 2×)<br />
            • Max 2 entries per day · Entry #2 from 15m correction<br />
            • Max daily margin: 2× margin per trade
          </div>
        </div>
        <form onSubmit={handleCreate}>
          <label style={s.label}>Symbol</label>
          <select style={s.select} value={form.symbol} onChange={set('symbol')}>
            {MACD_SYMBOLS.map((sym) => <option key={sym} value={sym}>{sym}</option>)}
          </select>
          <div style={s.row}>
            <div style={{ flex: 1 }}><label style={s.label}>Margin / Trade (USDT)</label><input style={s.input} type="number" value={form.margin_per_trade} onChange={set('margin_per_trade')} min="1" step="any" required /></div>
            <div style={{ flex: 1 }}><label style={s.label}>Leverage</label><input style={s.input} type="number" value={form.leverage} onChange={set('leverage')} min="1" max="125" step="1" required /></div>
            <div style={{ flex: 1 }}><label style={s.label}>R:R Ratio</label><input style={s.input} type="number" value={form.rr_ratio} onChange={set('rr_ratio')} min="1" step="0.1" /></div>
          </div>
          <button type="submit" style={s.btn} disabled={loading}>{loading ? 'Creating…' : 'Create Bot'}</button>
        </form>
      </div>

      {error && <div style={s.error}>{error}</div>}
      {success && <div style={s.success}>{success}</div>}

      <div style={s.sectionTitle}>My MACD Bots</div>
      {configs.length === 0 ? <div style={s.empty}>No MACD bots configured yet</div> : configs.map((cfg) => (
        <div key={cfg.id} style={s.botCard}>
          <div style={s.botHeader}>
            <div style={s.botSymbol}>{cfg.symbol}</div>
            <span style={{ color: '#a78bfa', fontSize: '12px' }}>MACD D1</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {[{ l: 'Margin', v: `$${cfg.margin_per_trade}` }, { l: 'Leverage', v: `${cfg.leverage}×` }, { l: 'Max Daily', v: `$${(cfg.margin_per_trade * 2).toFixed(2)}` }, { l: 'R:R', v: `1:${cfg.rr_ratio}` }].map(({ l, v }) => (
              <div key={l}><div style={{ color: '#555', fontSize: '11px' }}>{l}</div><div style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>{v}</div></div>
            ))}
          </div>

          {/* Signal block */}
          {signalConfigId === cfg.id && signal && (
            <div style={s.signalBox}>
              <div style={s.signalRow}><span style={s.signalKey}>MACD</span><span style={s.signalVal}>{signal.macd.toFixed(4)}</span></div>
              <div style={s.signalRow}><span style={s.signalKey}>Signal</span><span style={s.signalVal}>{signal.signal.toFixed(4)}</span></div>
              <div style={s.signalRow}><span style={s.signalKey}>Histogram</span><span style={s.signalVal}>{signal.histogram.toFixed(4)}</span></div>
              <div style={s.signalRow}>
                <span style={s.signalKey}>D1 Cross</span>
                {signal.is_bullish_crossover ? <span style={s.crossBull}>🟢 Bullish Crossover — LONG signal</span>
                  : signal.is_bearish_crossover ? <span style={s.crossBear}>🔴 Bearish Crossover</span>
                  : <span style={s.crossNone}>No crossover</span>}
              </div>
              <div style={s.signalRow}>
                <span style={s.signalKey}>Today's entries</span>
                <span style={signal.can_open_trade ? s.crossBull : s.crossBear}>
                  {signal.can_open_trade ? `Entry #${signal.next_entry_number} available` : 'Daily limit reached'}
                </span>
              </div>
              <div style={{ color: '#555', fontSize: '11px', marginTop: '4px' }}>{signal.daily_status_reason}</div>
            </div>
          )}

          {/* Open trade form */}
          {openForm.configId === cfg.id && (
            <form onSubmit={handleOpenTrade} style={{ marginBottom: '10px' }}>
              <label style={s.label}>Entry Price (USDT)</label>
              <input style={s.input} type="number" step="any" value={openForm.entry_price} onChange={(e) => setOpenForm((f) => ({ ...f, entry_price: e.target.value }))} placeholder="e.g. 65000" required />
              <div style={s.row}>
                <button type="submit" style={s.btnGreen}>Open Long</button>
                <button type="button" style={s.btnOutline} onClick={() => setOpenForm({ configId: null, entry_price: '' })}>Cancel</button>
              </div>
            </form>
          )}

          <div style={s.row}>
            <button style={s.btn} onClick={() => handleCheckSignal(cfg.id)}>📊 Check Signal</button>
            {signal?.can_open_trade && signalConfigId === cfg.id && openForm.configId !== cfg.id && (
              <button style={s.btnGreen} onClick={() => setOpenForm({ configId: cfg.id, entry_price: '' })}>+ Open Trade</button>
            )}
          </div>
        </div>
      ))}

      <div style={s.sectionTitle}>Today's MACD Trades</div>
      {todayTrades.length === 0 ? <div style={s.empty}>No trades today</div> : todayTrades.map((t) => (
        <div key={t.id} style={s.botCard}>
          <div style={s.botHeader}>
            <div style={s.botSymbol}>{t.symbol} <span style={{ color: '#888', fontSize: '13px', fontWeight: 400 }}>Entry #{t.entry_number} · {t.timeframe.toUpperCase()}</span></div>
            <span style={s.resultBadge(t.result)}>{t.result.toUpperCase()}</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {[
              { l: 'Entry', v: t.entry_price ? `$${parseFloat(t.entry_price).toFixed(2)}` : '—' },
              { l: 'Take Profit', v: t.take_profit_price ? `$${parseFloat(t.take_profit_price).toFixed(2)}` : '—' },
              { l: 'Stop Loss', v: t.stop_loss_price ? `$${parseFloat(t.stop_loss_price).toFixed(2)}` : '—' },
              { l: 'Margin', v: `$${t.margin}` },
              { l: 'Leverage', v: `${t.leverage}×` },
            ].map(({ l, v }) => (
              <div key={l}><div style={{ color: '#555', fontSize: '11px' }}>{l}</div><div style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>{v}</div></div>
            ))}
          </div>
          {t.result === 'open' && (
            <div style={s.row}>
              <button style={s.btnGreen} onClick={() => handleCloseTrade(t.id, 'win')}>✅ Close Win</button>
              <button style={s.btnRed} onClick={() => handleCloseTrade(t.id, 'loss')}>❌ Close Loss</button>
            </div>
          )}
        </div>
      ))}
    </>
  )
}

// ---- Main page ----
export default function Trading() {
  const [tab, setTab] = useState('dca')

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>Trading Bots</div>
        <div style={s.subtitle}>DCA accumulation · MACD D1 directional</div>
      </div>
      <div style={s.tabBar}>
        <button style={s.tab(tab === 'dca')} onClick={() => setTab('dca')}>DCA Bot</button>
        <button style={s.tab(tab === 'macd')} onClick={() => setTab('macd')}>MACD D1</button>
      </div>
      {tab === 'dca' ? <DCAPanel /> : <MACDPanel />}
    </div>
  )
}
