import { useState, useEffect } from 'react'
import client from '../api/client'

// ---- Strategy Card (start worker) ----
function StrategyCard({ strategy, walletBalance, onLaunched }) {
  const [margin, setMargin] = useState('')
  const [signal, setSignal] = useState(null)
  const [signalLoading, setSignalLoading] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchSignal = async () => {
    setSignalLoading(true)
    setError('')
    try {
      const { data } = await client.get(`/trading/signal/${strategy.id}`)
      setSignal(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch signal')
    } finally {
      setSignalLoading(false)
    }
  }

  const handleLaunch = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const marginVal = parseFloat(margin)
    if (!marginVal || marginVal <= 0) { setError('Enter a valid margin'); return }
    if (marginVal > walletBalance) {
      setError(`Insufficient balance (available: $${walletBalance.toFixed(2)})`)
      return
    }
    setLaunching(true)
    try {
      await client.post('/trading/launch', {
        strategy_id: strategy.id,
        margin: marginVal,
      })
      setSuccess('Worker started! It will open trades automatically when signals fire.')
      setMargin('')
      setSignal(null)
      onLaunched()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start worker')
    } finally {
      setLaunching(false)
    }
  }

  const maxMargin = strategy.max_daily_margin_usd > 0
    ? Math.min(walletBalance, strategy.max_daily_margin_usd)
    : walletBalance

  return (
    <div className="mx-5 mb-4 bg-[#141414] rounded-[14px] p-5 border border-[#222]">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-white font-bold text-base">{strategy.name}</div>
          <div className="text-[#a78bfa] text-xs mt-0.5">{strategy.strategy}</div>
        </div>
        <div className="flex gap-3 text-xs text-[#888]">
          <div className="text-center">
            <div className="text-white font-semibold text-sm">{strategy.leverage}×</div>
            <div>Leverage</div>
          </div>
          <div className="text-center">
            <div className="text-white font-semibold text-sm">1:{strategy.rr_ratio}</div>
            <div>R:R</div>
          </div>
          <div className="text-center">
            <div className="text-white font-semibold text-sm">{strategy.max_daily_trades}</div>
            <div>Max/day</div>
          </div>
        </div>
      </div>

      {/* Symbols */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(strategy.symbols || []).map((sym) => (
          <span key={sym} className="bg-[#1a1a2e] border border-[#6c47ff33] text-[#a78bfa] rounded-md px-2 py-0.5 text-xs font-semibold">
            {sym}
          </span>
        ))}
      </div>

      {/* Strategy rules */}
      <div className="bg-[#1a1a2e] border border-[#6c47ff33] rounded-[10px] p-3.5 mb-4">
        <div className="text-[#a78bfa] text-xs leading-relaxed">
          <strong className="text-[#c4b5fd]">How it works:</strong><br />
          • Worker runs automatically in the background<br />
          • D1 MACD bullish crossover → opens a Long trade<br />
          • Risk/Reward 1:{strategy.rr_ratio} · Worker auto-closes at TP or SL<br />
          • Max {strategy.max_daily_trades} entries per day per symbol
          {strategy.max_daily_margin_usd > 0 && (
            <><br />• Max daily margin: ${strategy.max_daily_margin_usd}</>
          )}
        </div>
      </div>

      {/* Signal panel */}
      {signal && (
        <div className="bg-[#1e1e1e] rounded-[10px] p-3.5 mb-4">
          <div className="flex justify-between mb-1.5">
            <span className="text-[#888] text-xs">MACD</span>
            <span className="text-white text-xs font-semibold">{signal.macd.toFixed(4)}</span>
          </div>
          <div className="flex justify-between mb-1.5">
            <span className="text-[#888] text-xs">Signal line</span>
            <span className="text-white text-xs font-semibold">{signal.signal.toFixed(4)}</span>
          </div>
          <div className="flex justify-between mb-1.5">
            <span className="text-[#888] text-xs">D1 Cross</span>
            {signal.is_bullish_crossover
              ? <span className="text-[#34d399] text-xs font-bold">🟢 Bullish — LONG ready</span>
              : signal.is_bearish_crossover
                ? <span className="text-[#f87171] text-xs font-bold">🔴 Bearish — avoid longs</span>
                : <span className="text-[#888] text-xs font-semibold">No crossover</span>}
          </div>
          <div className="flex justify-between">
            <span className="text-[#888] text-xs">Today</span>
            <span className={`text-xs font-semibold ${signal.can_open_trade ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
              {signal.can_open_trade ? `Entry #${signal.next_entry_number} available` : 'Daily limit reached'}
            </span>
          </div>
        </div>
      )}

      {/* Launch form — margin only */}
      <form onSubmit={handleLaunch} className="mb-3">
        <label className="block text-[#aaa] text-xs mb-1.5">
          Margin per trade (USDT) — available: <span className="text-white font-semibold">${walletBalance.toFixed(2)}</span>
        </label>
        <input
          className="w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm outline-none mb-3"
          type="number"
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
          placeholder={`1 – ${maxMargin.toFixed(2)}`}
          min="1"
          max={maxMargin}
          step="any"
          required
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchSignal}
            disabled={signalLoading}
            className="bg-none border border-[#6c47ff] rounded-lg text-[#a78bfa] px-4 py-2.5 font-semibold text-sm cursor-pointer disabled:opacity-50"
          >
            {signalLoading ? '…' : '📊 Signal'}
          </button>
          <button
            type="submit"
            disabled={launching}
            className="flex-1 bg-gradient-to-r from-[#6c47ff] to-[#a78bfa] border-none rounded-lg text-white px-4 py-2.5 font-semibold text-sm cursor-pointer disabled:opacity-50"
          >
            {launching ? 'Starting…' : '▶ Start Worker'}
          </button>
        </div>
      </form>

      {error && <div className="text-[#f87171] text-xs mt-1">{error}</div>}
      {success && <div className="text-[#34d399] text-xs mt-1">{success}</div>}
    </div>
  )
}

// ---- Worker Row ----
function WorkerRow({ worker, onStop }) {
  const [stopping, setStopping] = useState(false)
  const isRunning = worker.status === 'running'

  const handleStop = async () => {
    setStopping(true)
    try { await onStop(worker.id) } finally { setStopping(false) }
  }

  return (
    <div className="mx-5 mb-2.5 bg-[#141414] rounded-xl p-4 border border-[#222]">
      <div className="flex justify-between items-center mb-2">
        <div className="text-white font-bold text-sm">
          Worker #{worker.id}
          <span className="text-[#888] text-xs font-normal ml-2">Strategy #{worker.strategy_id}</span>
        </div>
        <span className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${isRunning ? 'bg-[rgba(52,211,153,0.15)] text-[#34d399]' : 'bg-[rgba(136,136,136,0.12)] text-[#888]'}`}>
          {worker.status.toUpperCase()}
        </span>
      </div>
      <div className="flex gap-4 mb-3 flex-wrap text-xs">
        <div><div className="text-[#555]">Exchange</div><div className="text-white font-semibold">{worker.exchange_id.toUpperCase()}</div></div>
        <div><div className="text-[#555]">Margin/trade</div><div className="text-white font-semibold">${parseFloat(worker.margin).toFixed(2)}</div></div>
        <div><div className="text-[#555]">Started</div><div className="text-white font-semibold">{worker.started_at ? new Date(worker.started_at).toLocaleDateString() : '—'}</div></div>
        {worker.stopped_at && <div><div className="text-[#555]">Stopped</div><div className="text-white font-semibold">{new Date(worker.stopped_at).toLocaleDateString()}</div></div>}
      </div>
      {isRunning && (
        <button
          onClick={handleStop}
          disabled={stopping}
          className="bg-[rgba(248,113,113,0.12)] border border-[#f87171] rounded-lg text-[#f87171] px-4 py-2 font-semibold text-sm cursor-pointer disabled:opacity-50"
        >
          {stopping ? 'Stopping…' : '⏹ Stop Worker'}
        </button>
      )}
    </div>
  )
}

// ---- Trade Row ----
function TradeRow({ trade }) {
  const d = trade.details || {}
  const resultColors = {
    win: 'bg-[rgba(52,211,153,0.15)] text-[#34d399]',
    loss: 'bg-[rgba(248,113,113,0.15)] text-[#f87171]',
    open: 'bg-[rgba(251,191,36,0.15)] text-[#fbbf24]',
  }
  const badge = resultColors[trade.status] || resultColors.open

  return (
    <div className="mx-5 mb-2.5 bg-[#141414] rounded-xl p-4 border border-[#222]">
      <div className="flex justify-between items-center mb-2.5">
        <div className="text-white font-bold text-base">
          {trade.symbol}
          <span className="text-[#888] text-xs font-normal ml-1.5">
            #{d.entry_number} · {(d.timeframe || '').toUpperCase()}
          </span>
        </div>
        <span className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
          {trade.status.toUpperCase()}
        </span>
      </div>
      <div className="flex gap-4 flex-wrap text-xs">
        {[
          { l: 'Exchange', v: (trade.exchange || '').toUpperCase() },
          { l: 'Entry', v: d.entry_price ? `$${parseFloat(d.entry_price).toFixed(2)}` : '—' },
          { l: 'Take Profit', v: d.take_profit_price ? `$${parseFloat(d.take_profit_price).toFixed(2)}` : '—' },
          { l: 'Stop Loss', v: d.stop_loss_price ? `$${parseFloat(d.stop_loss_price).toFixed(2)}` : '—' },
          { l: 'Margin', v: `$${d.margin || '—'}` },
          { l: 'Leverage', v: d.leverage ? `${d.leverage}×` : '—' },
        ].map(({ l, v }) => (
          <div key={l}>
            <div className="text-[#555]">{l}</div>
            <div className="text-white font-semibold">{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function Trading() {
  const [strategies, setStrategies] = useState([])
  const [workers, setWorkers] = useState([])
  const [trades, setTrades] = useState([])
  const [walletBalance, setWalletBalance] = useState(0)
  const [tab, setTab] = useState('strategies')
  const [error, setError] = useState('')

  const loadData = () => {
    client.get('/trading/strategies').then((r) => setStrategies(r.data)).catch(() => {})
    client.get('/trading/workers').then((r) => setWorkers(r.data)).catch(() => {})
    client.get('/trading/trades').then((r) => setTrades(r.data)).catch(() => {})
    client.get('/wallet').then((r) => setWalletBalance(parseFloat(r.data.balance) || 0)).catch(() => {})
  }

  useEffect(() => { loadData() }, [])

  const handleStopWorker = async (workerId) => {
    try {
      await client.post(`/trading/stop/${workerId}`)
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to stop worker')
    }
  }

  const runningWorkers = workers.filter((w) => w.status === 'running')
  const openTrades = trades.filter((t) => t.status === 'open')

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="text-white text-[22px] font-bold">Trading</div>
        <div className="text-[#888] text-sm mt-1">DCA_MACD_DAILY · Workers run automatically</div>
        <div className="flex items-center gap-2 mt-3">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-xl px-4 py-2.5 flex-1 text-center">
            <div className="text-[#888] text-xs">Wallet Balance</div>
            <div className="text-white font-bold text-lg">${walletBalance.toFixed(2)} USDT</div>
          </div>
          <div className="bg-[#1e1e1e] border border-[#333] rounded-xl px-4 py-2.5 text-center">
            <div className="text-[#888] text-xs">Running</div>
            <div className="text-[#34d399] font-bold text-lg">{runningWorkers.length}</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex mx-5 mb-2 border-b border-[#222]">
        {[
          { key: 'strategies', label: '📋 Strategies' },
          { key: 'workers', label: `⚙️ Workers (${runningWorkers.length})` },
          { key: 'trades', label: `📜 Trades (${openTrades.length} open)` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 font-semibold text-sm cursor-pointer bg-transparent border-none border-b-2 ${tab === key ? 'text-[#a78bfa] border-b-[#a78bfa]' : 'text-[#555] border-b-transparent'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="text-[#f87171] text-xs mx-5 mb-2">{error}</div>}

      {/* Strategies */}
      {tab === 'strategies' && (
        strategies.length === 0
          ? <div className="text-center text-[#555] py-6 px-5 text-sm">No strategies available yet.</div>
          : strategies.map((s) => (
            <StrategyCard key={s.id} strategy={s} walletBalance={walletBalance} onLaunched={loadData} />
          ))
      )}

      {/* Workers */}
      {tab === 'workers' && (
        <>
          <div className="text-white text-base font-semibold px-5 py-4">Your Workers</div>
          {workers.length === 0
            ? <div className="text-center text-[#555] py-6 px-5 text-sm">No workers yet — start one from Strategies.</div>
            : workers.map((w) => <WorkerRow key={w.id} worker={w} onStop={handleStopWorker} />)
          }
        </>
      )}

      {/* Trades */}
      {tab === 'trades' && (
        <>
          <div className="text-white text-base font-semibold px-5 py-4">Trade History</div>
          {trades.length === 0
            ? <div className="text-center text-[#555] py-6 px-5 text-sm">No trades yet — workers create them automatically.</div>
            : trades.map((t) => <TradeRow key={t.id} trade={t} />)
          }
        </>
      )}
    </div>
  )
}
