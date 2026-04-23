import { BarChart2, ScrollText, Settings } from 'lucide-react'
import { type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { tradingApi } from '../api/trading'
import { useLaunchWorker, useStopWorker, useStrategies, useTrades, useWorkers } from '../hooks/useTrading'
import { useExchanges } from '../hooks/useExchanges'
import { useMySubs } from '../hooks/useSubscriptions'
import { Exchange, Signal, Strategy, Subscription, Trade, Worker } from '../types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface MarginFormValues {
  margin: string
  user_exchange_id: string
}

// ---- Subscription slot banner ----
function SubscriptionBanner({
  subscription,
  runningCount,
}: {
  subscription: Subscription | null
  runningCount: number
}) {
  const planMax: Record<string, number> = { starter: 1, trader: 2, pro: 3 }

  if (!subscription) {
    return (
      <Card className="mx-5 mb-3 p-3 border-destructive/50 bg-destructive/10">
        <p className="text-destructive text-xs font-semibold">
          ⚠ No active subscription — subscribe to start trading
        </p>
      </Card>
    )
  }

  const maxSlots = planMax[subscription.plan] ?? 1
  const coins = subscription.coins ?? []

  return (
    <Card className="mx-5 mb-3 p-3 bg-input border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-foreground font-semibold text-xs uppercase tracking-wide">
          {subscription.plan} plan
        </span>
        <span className={cn(
          'text-xs font-bold',
          runningCount >= maxSlots ? 'text-destructive' : 'text-success',
        )}>
          {runningCount} / {maxSlots} slots used
        </span>
      </div>
      {coins.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {coins.map((c) => (
            <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
          ))}
        </div>
      )}
    </Card>
  )
}

// ---- Strategy Card (start worker) ----
function StrategyCard({
  strategy,
  subscription,
  exchanges,
  runningCount,
}: {
  strategy: Strategy
  subscription: Subscription | null
  exchanges: Exchange[]
  runningCount: number
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<MarginFormValues>()
  const [signal, setSignal] = useState<Signal | null>(null)
  const [signalLoading, setSignalLoading] = useState(false)
  const [signalError, setSignalError] = useState('')
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const launchWorker = useLaunchWorker()

  const planMax: Record<string, number> = { starter: 1, trader: 2, pro: 3 }
  const maxSlots = planMax[subscription?.plan ?? ''] ?? 1
  const slotsExhausted = runningCount >= maxSlots

  const verifiedExchanges = exchanges.filter((e) => e.status === 'verified')

  const selectedExchangeId = watch('user_exchange_id')
  const selectedExchange = verifiedExchanges.find((e) => String(e.id) === selectedExchangeId)
  const availableBalance = selectedExchange?.balance_usdt_free ?? null

  const fetchSignal = async () => {
    setSignalLoading(true)
    setSignalError('')
    try {
      const data = await tradingApi.getSignal(strategy.id)
      setSignal(data)
    } catch (err) {
      setSignalError(
        err instanceof Error ? err.message : 'Failed to fetch signal',
      )
    } finally {
      setSignalLoading(false)
    }
  }

  const isDCA = strategy.strategy === 'DCA'

  const maxMargin = availableBalance != null ? availableBalance : 0

  // Symbols available to select: intersection of strategy symbols and subscription coins
  const subCoins = subscription?.coins ?? []
  const strategySymbols = (strategy.symbols ?? []).map((s) => s.symbol)
  const selectableSymbols = strategySymbols.map((sym) => ({
    symbol: sym,
    allowed: subCoins.length === 0 || subCoins.includes(sym),
  }))

  const toggleSymbol = (sym: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym],
    )
  }

  const signalMetrics = signal
    ? [
        { label: 'MACD', value: signal.macd.toFixed(4) },
        { label: 'Signal line', value: signal.signal.toFixed(4) },
      ]
    : []

  const canStart =
    !!subscription &&
    !slotsExhausted &&
    verifiedExchanges.length > 0 &&
    selectedSymbols.length > 0

  const onSubmit = (data: MarginFormValues) => {
    const marginVal = parseFloat(data.margin)
    launchWorker.mutate(
      {
        strategy_id: strategy.id,
        margin: marginVal,
        user_exchange_id: data.user_exchange_id ? parseInt(data.user_exchange_id) : undefined,
        selected_symbols: selectedSymbols,
      },
      {
        onSuccess: () => {
          reset()
          setSignal(null)
          setSelectedSymbols([])
        },
      },
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
          {isDCA ? (
            <>
              <div className="text-center">
                <div className="text-foreground font-semibold text-sm">{strategy.settings?.max_orders ?? 5}</div>
                <div>Max orders</div>
              </div>
              <div className="text-center">
                <div className="text-foreground font-semibold text-sm">{strategy.settings?.step_percent ?? 0.5}%</div>
                <div>Step</div>
              </div>
              <div className="text-center">
                <div className="text-foreground font-semibold text-sm">{strategy.settings?.take_profit_percent ?? 1.0}%</div>
                <div>TP</div>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="text-foreground font-semibold text-sm">{strategy.leverage}×</div>
                <div>Leverage</div>
              </div>
              <div className="text-center">
                <div className="text-foreground font-semibold text-sm">1:{strategy.rr_ratio}</div>
                <div>R:R</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-[#1a1a2e] border border-[#6c47ff33] rounded-[10px] p-3.5 mb-4">
        <p className="text-[#a78bfa] text-xs leading-relaxed">
          <strong className="text-[#c4b5fd]">How it works:</strong>
          <br />
          {isDCA ? (
            <>
              • Worker opens an initial order immediately at market price
              <br />
              • Each {strategy.settings?.step_percent ?? 0.5}% price drop triggers a safety order ({strategy.settings?.amount_multiplier ?? 2}× larger)
              <br />
              • Max {strategy.settings?.max_orders ?? 5} orders per cycle · TP at avg entry +{strategy.settings?.take_profit_percent ?? 1.0}%
            </>
          ) : (
            <>
              • Worker runs automatically in the background
              <br />
              • D1 MACD bullish crossover → opens a Long trade
              <br />
              • Risk/Reward 1:{strategy.rr_ratio} · Worker auto-closes at TP or SL
            </>
          )}
        </p>
      </div>

      {strategy.latest_backtest && (
        <Card className="p-3.5 mb-4 bg-input border-border">
          <div className="flex justify-between items-start gap-3 mb-2">
            <div>
              <div className="text-foreground font-semibold text-sm">Latest Published Backtest</div>
              <div className="text-muted-foreground text-xs mt-1">
                {strategy.latest_backtest.period_start} → {strategy.latest_backtest.period_end}
              </div>
            </div>
            <Badge
              variant={strategy.latest_backtest.net_profit_usd >= 0 ? 'success' : 'destructive'}
            >
              {strategy.latest_backtest.net_profit_usd >= 0 ? '+' : ''}
              {strategy.latest_backtest.net_profit_usd.toFixed(2)} USDT
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
            <div>
              <div className="text-muted-foreground">Trades</div>
              <div className="text-foreground font-semibold">
                {strategy.latest_backtest.total_trades}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Win rate</div>
              <div className="text-foreground font-semibold">
                {strategy.latest_backtest.win_rate.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Max DD</div>
              <div className="text-foreground font-semibold">
                -{strategy.latest_backtest.max_drawdown_usd.toFixed(2)} USDT
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Profit factor</div>
              <div className="text-foreground font-semibold">
                {strategy.latest_backtest.profit_factor?.toFixed(2) ?? '—'}
              </div>
            </div>
          </div>
        </Card>
      )}

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
            {signal.is_bullish_crossover ? (
              <span className="text-success text-xs font-bold">🟢 Bullish — LONG ready</span>
            ) : signal.is_bearish_crossover ? (
              <span className="text-destructive text-xs font-bold">🔴 Bearish — avoid longs</span>
            ) : (
              <span className="text-muted-foreground text-xs font-semibold">No crossover</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground text-xs">Today</span>
            <span
              className={cn(
                'text-xs font-semibold',
                signal.can_open_trade ? 'text-success' : 'text-destructive',
              )}
            >
              {signal.can_open_trade
                ? `Entry #${signal.next_entry_number} available`
                : 'Daily limit reached'}
            </span>
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mb-3">
        {/* Exchange picker */}
        <div>
          <Label className="mb-1 block">Exchange API Key</Label>
          {verifiedExchanges.length === 0 ? (
            <p className="text-destructive text-xs">No verified exchange connected. Add one in Exchanges.</p>
          ) : (
            <select
              {...register('user_exchange_id', { required: 'Select an exchange' })}
              className="w-full rounded-md border border-input bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select exchange…</option>
              {verifiedExchanges.map((exc) => (
                <option key={exc.id} value={exc.id}>
                  {exc.exchange_id.toUpperCase()}{exc.label ? ` — ${exc.label}` : ''}{' '}
                  {exc.balance_usdt_free != null ? `($${exc.balance_usdt_free.toFixed(2)} free)` : ''}
                </option>
              ))}
            </select>
          )}
          {errors.user_exchange_id && (
            <p className="text-destructive text-xs mt-1">{errors.user_exchange_id.message}</p>
          )}
        </div>

        {/* Token selector */}
        <div>
          <Label className="mb-1 block">
            Tokens to trade{' '}
            <span className="text-muted-foreground font-normal">
              (select from strategy presets)
            </span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {selectableSymbols.map(({ symbol, allowed }) => {
              const sym = strategy.symbols?.find((s) => s.symbol === symbol)
              const isSelected = selectedSymbols.includes(symbol)
              return (
                <button
                  key={symbol}
                  type="button"
                  disabled={!allowed}
                  onClick={() => allowed && toggleSymbol(symbol)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-[#6c47ff] border-[#6c47ff] text-white'
                      : allowed
                      ? 'bg-input border-border text-foreground hover:border-[#6c47ff]'
                      : 'bg-muted border-muted text-muted-foreground opacity-50 cursor-not-allowed',
                  )}
                  title={!allowed ? `${symbol} not in your subscription` : undefined}
                >
                  {sym && (
                    <span className={sym.market_type === 'swap' ? 'text-amber-400' : 'text-emerald-400'}>
                      {sym.market_type === 'swap' ? 'P' : 'S'}
                    </span>
                  )}
                  {symbol}
                  {sym?.market_type === 'swap' && <span className="opacity-70">{sym.leverage}×</span>}
                  {!allowed && <span className="ml-0.5 opacity-60">🔒</span>}
                </button>
              )
            })}
          </div>
          {selectedSymbols.length === 0 && (
            <p className="text-muted-foreground text-xs mt-1">Select at least one token</p>
          )}
        </div>

        {/* Margin */}
        <div>
          <Label className="mb-1 block">
            Margin per trade (USDT){' '}
            {availableBalance != null ? (
              <span className="text-foreground font-semibold">
                — available: ${availableBalance.toFixed(2)}
              </span>
            ) : selectedExchange ? (
              <span className="text-muted-foreground font-normal">— balance syncing…</span>
            ) : null}
          </Label>
          <Input
            type="number"
            placeholder={availableBalance != null ? `1 – ${availableBalance.toFixed(2)}` : 'e.g. 100'}
            min="1"
            max={maxMargin > 0 ? maxMargin : undefined}
            step="any"
            {...register('margin', {
              required: 'Enter a valid margin',
              min: { value: 1, message: 'Minimum margin is $1' },
              ...(maxMargin > 0 && {
                max: {
                  value: maxMargin,
                  message: `Exceeds available balance ($${maxMargin.toFixed(2)})`,
                },
              }),
            })}
          />
          {errors.margin && (
            <p className="text-destructive text-xs mt-1">{errors.margin.message}</p>
          )}
        </div>

        <div className="flex gap-2">
          {!isDCA && (
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
          )}
          <Button
            type="submit"
            size="sm"
            disabled={launchWorker.isPending || !canStart}
            className="flex-1"
          >
            {launchWorker.isPending
              ? 'Starting…'
              : slotsExhausted
              ? 'All slots in use'
              : !subscription
              ? 'Subscription required'
              : '▶ Start Worker'}
          </Button>
        </div>
      </form>

      {signalError && <p className="text-destructive text-xs mt-1">{signalError}</p>}
      {launchWorker.error && (
        <p className="text-destructive text-xs mt-1">
          {launchWorker.error.message ?? 'Failed to start worker'}
        </p>
      )}
      {launchWorker.isSuccess && (
        <p className="text-success text-xs mt-1">
          Worker started! It will open trades automatically{isDCA ? '.' : ' when signals fire.'}
        </p>
      )}
    </Card>
  )
}

// ---- Worker Row ----
function WorkerRow({ worker }: { worker: Worker }) {
  const stopWorker = useStopWorker()
  const isRunning = worker.status === 'running'

  const workerDetails = [
    { label: 'Exchange', value: worker.exchange_id.toUpperCase() },
    { label: 'Margin/trade', value: `$${parseFloat(worker.margin).toFixed(2)}` },
    {
      label: 'Started',
      value: worker.started_at ? new Date(worker.started_at).toLocaleDateString() : '—',
    },
    ...(worker.stopped_at
      ? [{ label: 'Stopped', value: new Date(worker.stopped_at).toLocaleDateString() }]
      : []),
  ]

  return (
    <Card className="mx-5 mb-2.5 p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-foreground font-bold text-sm">
          Worker #{worker.id}
          <span className="text-muted-foreground text-xs font-normal ml-2">
            Strategy #{worker.strategy_id}
          </span>
        </div>
        <Badge variant={isRunning ? 'success' : 'secondary'}>{worker.status.toUpperCase()}</Badge>
      </div>
      {worker.selected_symbols && worker.selected_symbols.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {worker.selected_symbols.map((sym) => (
            <Badge key={sym} variant="default" className="text-xs">{sym}</Badge>
          ))}
        </div>
      )}
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
function TradeRow({ trade }: { trade: Trade }) {
  const d = trade.details ?? {}
  const badgeVariantMap: Record<string, 'success' | 'destructive' | 'warning'> = {
    win: 'success',
    loss: 'destructive',
    open: 'warning',
  }
  const badgeVariant = badgeVariantMap[trade.status] ?? 'warning'

  return (
    <Card className="mx-5 mb-2.5 p-4">
      <div className="flex justify-between items-center mb-2.5">
        <div className="text-foreground font-bold text-base">
          {trade.symbol}
          <span className="text-muted-foreground text-xs font-normal ml-1.5">
            #{d.entry_number} · {(d.timeframe ?? '').toUpperCase()}
          </span>
        </div>
        <Badge variant={badgeVariant}>{trade.status.toUpperCase()}</Badge>
      </div>
      <div className="flex gap-4 flex-wrap text-xs">
        {[
          { l: 'Exchange', v: (trade.exchange ?? '').toUpperCase() },
          { l: 'Entry', v: d.entry_price ? `$${parseFloat(d.entry_price).toFixed(2)}` : '—' },
          {
            l: 'Take Profit',
            v: d.take_profit_price ? `$${parseFloat(d.take_profit_price).toFixed(2)}` : '—',
          },
          {
            l: 'Stop Loss',
            v: d.stop_loss_price ? `$${parseFloat(d.stop_loss_price).toFixed(2)}` : '—',
          },
          { l: 'Margin', v: `$${d.margin ?? '—'}` },
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

interface TabItem {
  key: string
  label: string
  icon: LucideIcon
}

// ---- Main Page ----
export default function Trading() {
  const [tab, setTab] = useState('strategies')
  const { data: strategies = [], isLoading: strategiesLoading } = useStrategies()
  const { data: workers = [] } = useWorkers()
  const { data: trades = [] } = useTrades()
  const { data: exchanges = [] } = useExchanges()
  const { data: subscriptions = [] } = useMySubs()

  const activeSub: Subscription | null =
    subscriptions.find((s) => s.status === 'active') ?? null

  const runningWorkers = workers.filter((w) => w.status === 'running')
  const openTrades = trades.filter((t) => t.status === 'open')

  const tabs: TabItem[] = [
    { key: 'strategies', label: 'Strategies', icon: BarChart2 },
    { key: 'workers', label: `Workers (${runningWorkers.length})`, icon: Settings },
    { key: 'trades', label: `Trades (${openTrades.length} open)`, icon: ScrollText },
  ]

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-foreground text-[22px] font-bold">Trading</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {strategies.length > 0
            ? `${strategies.length} strateg${strategies.length === 1 ? 'y' : 'ies'} available`
            : 'No strategies available yet'}
        </p>
      </div>

      <SubscriptionBanner subscription={activeSub} runningCount={runningWorkers.length} />

      <div className="flex mx-5 mb-2 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2.5 font-semibold text-sm cursor-pointer bg-transparent border-none border-b-2 flex items-center gap-1.5',
              tab === key
                ? 'text-[#a78bfa] border-b-[#a78bfa]'
                : 'text-muted-foreground border-b-transparent',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'strategies' &&
        (strategiesLoading ? (
          <p className="text-center text-muted-foreground py-6 px-5 text-sm">
            Loading strategies…
          </p>
        ) : strategies.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 px-5 text-sm">
            No strategies available yet.
          </p>
        ) : (
          strategies.map((s) => (
            <StrategyCard
              key={s.id}
              strategy={s}
              subscription={activeSub}
              exchanges={exchanges}
              runningCount={runningWorkers.length}
            />
          ))
        ))}

      {tab === 'workers' && (
        <>
          <h2 className="text-foreground text-base font-semibold px-5 py-4">Your Workers</h2>
          {workers.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 px-5 text-sm">
              No workers yet — start one from Strategies.
            </p>
          ) : (
            workers.map((w) => <WorkerRow key={w.id} worker={w} />)
          )}
        </>
      )}

      {tab === 'trades' && (
        <>
          <h2 className="text-foreground text-base font-semibold px-5 py-4">Trade History</h2>
          {trades.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 px-5 text-sm">
              No trades yet — workers create them automatically.
            </p>
          ) : (
            trades.map((t) => <TradeRow key={t.id} trade={t} />)
          )}
        </>
      )}
    </div>
  )
}

