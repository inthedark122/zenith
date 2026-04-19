import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { BarChart2, Settings, ScrollText } from 'lucide-react'
import {
  useStrategies, useWorkers, useTrades,
  useLaunchWorker, useStopWorker,
} from '../hooks/useTrading'
import { useWallet } from '../hooks/useWallet'
import { tradingApi } from '../api/trading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// ---- Strategy Card (start worker) ----
function StrategyCard({ strategy, walletBalance }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const [signal, setSignal] = useState(null)
  const [signalLoading, setSignalLoading] = useState(false)
  const [signalError, setSignalError] = useState('')
  const launchWorker = useLaunchWorker()

  const fetchSignal = async () => {
    setSignalLoading(true)
    setSignalError('')
    try {
      const data = await tradingApi.getSignal(strategy.id)
      setSignal(data)
    } catch (err) {
      setSignalError(err.response?.data?.detail || 'Failed to fetch signal')
    } finally {
      setSignalLoading(false)
    }
  }

  const maxDailyMargin = strategy.settings?.max_daily_margin_usd ?? 0
  const maxDailyTrades = strategy.settings?.max_daily_trades ?? 2
  const maxMargin = maxDailyMargin > 0 ? Math.min(walletBalance, maxDailyMargin) : walletBalance

  const signalMetrics = signal
    ? [
        { label: 'MACD', value: signal.macd.toFixed(4) },
        { label: 'Signal line', value: signal.signal.toFixed(4) },
      ]
    : []

  const onSubmit = (data) => {
    const marginVal = parseFloat(data.margin)
    launchWorker.mutate(
      { strategy_id: strategy.id, margin: marginVal },
      { onSuccess: () => { reset(); setSignal(null) } },
    )
  }

  return (
    <Card className="mx-5 mb-4 p-5">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-foreground font-bold text-base">{strategy.name}</div>
          <div className="text-[#a78bfa] text-xs mt-0.5">{strategy.strategy}</div>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <div className="text-center">
            <div className="text-foreground font-semibold text-sm">{strategy.leverage}×</div>
            <div>Leverage</div>
          </div>
          <div className="text-center">
            <div className="text-foreground font-semibold text-sm">1:{strategy.rr_ratio}</div>
            <div>R:R</div>
          </div>
          <div className="text-center">
            <div className="text-foreground font-semibold text-sm">{maxDailyTrades}</div>
            <div>Max/day</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {(strategy.symbols || []).map((sym) => (
          <Badge key={sym} variant="default" className="font-semibold">{sym}</Badge>
        ))}
      </div>

      <div className="bg-[#1a1a2e] border border-[#6c47ff33] rounded-[10px] p-3.5 mb-4">
        <p className="text-[#a78bfa] text-xs leading-relaxed">
          <strong className="text-[#c4b5fd]">How it works:</strong><br />
          • Worker runs automatically in the background<br />
          • D1 MACD bullish crossover → opens a Long trade<br />
          • Risk/Reward 1:{strategy.rr_ratio} · Worker auto-closes at TP or SL<br />
          • Max {maxDailyTrades} entries per day per symbol
          {maxDailyMargin > 0 && (<><br />• Max daily margin: ${maxDailyMargin}</>)}
        </p>
      </div>

      {signal && (
        <Card className="p-3.5 mb-4 bg-input border-border">
          {signalMetrics.map(({ label, value }) => (
            <div key={label} className="flex justify-between mb-1.5">
              <span className="text-muted-foreground text-xs">{label}</span>
              <span className="text-foreground text-xs font-semibold">{value}</span>
            </div>
          ))}
          <div className="flex justify-between mb-1.5">
            <span className="text-muted-foreground text-xs">D1 Cross</span>
            {signal.is_bullish_crossover
              ? <span className="text-success text-xs font-bold">🟢 Bullish — LONG ready</span>
              : signal.is_bearish_crossover
                ? <span className="text-destructive text-xs font-bold">🔴 Bearish — avoid longs</span>
                : <span className="text-muted-foreground text-xs font-semibold">No crossover</span>}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground text-xs">Today</span>
            <span className={cn('text-xs font-semibold', signal.can_open_trade ? 'text-success' : 'text-destructive')}>
              {signal.can_open_trade ? `Entry #${signal.next_entry_number} available` : 'Daily limit reached'}
            </span>
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mb-3">
        <Label>
          Margin per trade (USDT) — available:{' '}
          <span className="text-foreground font-semibold">${walletBalance.toFixed(2)}</span>
        </Label>
        <Input
          type="number"
          placeholder={`1 – ${maxMargin.toFixed(2)}`}
          min="1"
          max={maxMargin}
          step="any"
          className="mt-1 mb-3"
          {...register('margin', {
            required: 'Enter a valid margin',
            min: { value: 1, message: 'Minimum margin is $1' },
            max: { value: maxMargin, message: `Exceeds available balance ($${maxMargin.toFixed(2)})` },
          })}
        />
        {errors.margin && <p className="text-destructive text-xs mb-2">{errors.margin.message}</p>}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchSignal}
            disabled={signalLoading}
            className="text-[#a78bfa] border-[#6c47ff]"
          >
            {signalLoading ? '…' : '📊 Signal'}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={launchWorker.isPending}
            className="flex-1"
          >
            {launchWorker.isPending ? 'Starting…' : '▶ Start Worker'}
          </Button>
        </div>
      </form>

      {signalError && <p className="text-destructive text-xs mt-1">{signalError}</p>}
      {launchWorker.error && (
        <p className="text-destructive text-xs mt-1">
          {launchWorker.error.response?.data?.detail || 'Failed to start worker'}
        </p>
      )}
      {launchWorker.isSuccess && (
        <p className="text-success text-xs mt-1">Worker started! It will open trades automatically when signals fire.</p>
      )}
    </Card>
  )
}

// ---- Worker Row ----
function WorkerRow({ worker }) {
  const stopWorker = useStopWorker()
  const isRunning = worker.status === 'running'

  const workerDetails = [
    { label: 'Exchange', value: worker.exchange_id.toUpperCase() },
    { label: 'Margin/trade', value: `$${parseFloat(worker.margin).toFixed(2)}` },
    { label: 'Started', value: worker.started_at ? new Date(worker.started_at).toLocaleDateString() : '—' },
    ...(worker.stopped_at ? [{ label: 'Stopped', value: new Date(worker.stopped_at).toLocaleDateString() }] : []),
  ]

  return (
    <Card className="mx-5 mb-2.5 p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-foreground font-bold text-sm">
          Worker #{worker.id}
          <span className="text-muted-foreground text-xs font-normal ml-2">Strategy #{worker.strategy_id}</span>
        </div>
        <Badge variant={isRunning ? 'success' : 'secondary'}>
          {worker.status.toUpperCase()}
        </Badge>
      </div>
      <div className="flex gap-4 mb-3 flex-wrap text-xs">
        {workerDetails.map(({ label, value }) => (
          <div key={label}>
            <div className="text-muted-foreground">{label}</div>
            <div className="text-foreground font-semibold">{value}</div>
          </div>
        ))}
      </div>
      {isRunning && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => stopWorker.mutate(worker.id)}
          disabled={stopWorker.isPending}
        >
          {stopWorker.isPending ? 'Stopping…' : '⏹ Stop Worker'}
        </Button>
      )}
    </Card>
  )
}

// ---- Trade Row ----
function TradeRow({ trade }) {
  const d = trade.details || {}
  const badgeVariant = { win: 'success', loss: 'destructive', open: 'warning' }[trade.status] || 'warning'

  return (
    <Card className="mx-5 mb-2.5 p-4">
      <div className="flex justify-between items-center mb-2.5">
        <div className="text-foreground font-bold text-base">
          {trade.symbol}
          <span className="text-muted-foreground text-xs font-normal ml-1.5">
            #{d.entry_number} · {(d.timeframe || '').toUpperCase()}
          </span>
        </div>
        <Badge variant={badgeVariant}>{trade.status.toUpperCase()}</Badge>
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
            <div className="text-muted-foreground">{l}</div>
            <div className="text-foreground font-semibold">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---- Main Page ----
export default function Trading() {
  const [tab, setTab] = useState('strategies')
  const { data: strategies = [], isLoading: strategiesLoading } = useStrategies()
  const { data: workers = [] } = useWorkers()
  const { data: trades = [] } = useTrades()
  const { data: wallet } = useWallet()

  const walletBalance = parseFloat(wallet?.balance) || 0
  const runningWorkers = workers.filter((w) => w.status === 'running')
  const openTrades = trades.filter((t) => t.status === 'open')

  const tabs = [
    { key: 'strategies', label: 'Strategies', icon: BarChart2 },
    { key: 'workers', label: `Workers (${runningWorkers.length})`, icon: Settings },
    { key: 'trades', label: `Trades (${openTrades.length} open)`, icon: ScrollText },
  ]

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-foreground text-[22px] font-bold">Trading</h1>
        <p className="text-muted-foreground text-sm mt-1">DCA_MACD_DAILY · Workers run automatically</p>
        <div className="flex items-center gap-2 mt-3">
          <Card className="flex-1 px-4 py-2.5 text-center">
            <div className="text-muted-foreground text-xs">Wallet Balance</div>
            <div className="text-foreground font-bold text-lg">${walletBalance.toFixed(2)} USDT</div>
          </Card>
          <Card className="px-4 py-2.5 text-center">
            <div className="text-muted-foreground text-xs">Running</div>
            <div className="text-success font-bold text-lg">{runningWorkers.length}</div>
          </Card>
        </div>
      </div>

      <div className="flex mx-5 mb-2 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2.5 font-semibold text-sm cursor-pointer bg-transparent border-none border-b-2 flex items-center gap-1.5',
              tab === key ? 'text-[#a78bfa] border-b-[#a78bfa]' : 'text-muted-foreground border-b-transparent',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'strategies' && (
        strategiesLoading
          ? <p className="text-center text-muted-foreground py-6 px-5 text-sm">Loading strategies…</p>
          : strategies.length === 0
            ? <p className="text-center text-muted-foreground py-6 px-5 text-sm">No strategies available yet.</p>
            : strategies.map((s) => (
              <StrategyCard key={s.id} strategy={s} walletBalance={walletBalance} />
            ))
      )}

      {tab === 'workers' && (
        <>
          <h2 className="text-foreground text-base font-semibold px-5 py-4">Your Workers</h2>
          {workers.length === 0
            ? <p className="text-center text-muted-foreground py-6 px-5 text-sm">No workers yet — start one from Strategies.</p>
            : workers.map((w) => <WorkerRow key={w.id} worker={w} />)
          }
        </>
      )}

      {tab === 'trades' && (
        <>
          <h2 className="text-foreground text-base font-semibold px-5 py-4">Trade History</h2>
          {trades.length === 0
            ? <p className="text-center text-muted-foreground py-6 px-5 text-sm">No trades yet — workers create them automatically.</p>
            : trades.map((t) => <TradeRow key={t.id} trade={t} />)
          }
        </>
      )}
    </div>
  )
}
