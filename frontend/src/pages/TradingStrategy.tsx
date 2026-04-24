import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'

import { tradingApi } from '../api/trading'
import { useExchanges } from '../hooks/useExchanges'
import { useMySubs } from '../hooks/useSubscriptions'
import { useLaunchWorker, useStopWorker, useStrategies, useTrades, useWorkers } from '../hooks/useTrading'
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

// ---------------------------------------------------------------------------
// Start-worker form
// ---------------------------------------------------------------------------

function StartWorkerForm({
  strategy,
  subscription,
  exchanges,
  runningCount,
  onLaunched,
}: {
  strategy: Strategy
  subscription: Subscription | null
  exchanges: Exchange[]
  runningCount: number
  onLaunched?: () => void
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
  const isDCA = strategy.strategy === 'DCA'

  const verifiedExchanges = exchanges.filter((e) => e.status === 'verified')
  const selectedExchangeId = watch('user_exchange_id')
  const selectedExchange = verifiedExchanges.find((e) => String(e.id) === selectedExchangeId)
  const availableBalance = selectedExchange?.balance_usdt_free ?? null
  const maxMargin = availableBalance ?? 0

  const selectableSymbols = (strategy.symbols ?? []).map((s) => s.symbol)

  const toggleSymbol = (sym: string) =>
    setSelectedSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym],
    )

  const fetchSignal = async () => {
    setSignalLoading(true)
    setSignalError('')
    try {
      setSignal(await tradingApi.getSignal(strategy.id))
    } catch (err) {
      setSignalError(err instanceof Error ? err.message : 'Failed to fetch signal')
    } finally {
      setSignalLoading(false)
    }
  }

  const canStart =
    !!subscription && !slotsExhausted && verifiedExchanges.length > 0 && selectedSymbols.length > 0

  const onSubmit = (data: MarginFormValues) => {
    launchWorker.mutate(
      {
        strategy_id: strategy.id,
        margin: parseFloat(data.margin),
        user_exchange_id: data.user_exchange_id ? parseInt(data.user_exchange_id) : undefined,
        selected_symbols: selectedSymbols,
      },
      {
        onSuccess: () => {
          reset()
          setSignal(null)
          setSelectedSymbols([])
          onLaunched?.()
        },
      },
    )
  }

  return (
    <div className="space-y-3">
      {/* Signal card */}
      {signal && (
        <Card className="p-3.5 bg-input border-border">
          <div className="flex justify-between mb-1.5">
            <span className="text-muted-foreground text-xs">MACD</span>
            <span className="text-foreground text-xs font-semibold">{signal.macd.toFixed(4)}</span>
          </div>
          <div className="flex justify-between mb-1.5">
            <span className="text-muted-foreground text-xs">Signal line</span>
            <span className="text-foreground text-xs font-semibold">{signal.signal.toFixed(4)}</span>
          </div>
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
            <span className={cn('text-xs font-semibold', signal.can_open_trade ? 'text-success' : 'text-destructive')}>
              {signal.can_open_trade ? `Entry #${signal.next_entry_number} available` : 'Daily limit reached'}
            </span>
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Exchange */}
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

        {/* Symbols */}
        <div>
          <Label className="mb-1 block">Tokens to trade</Label>
          {selectableSymbols.length === 0 ? (
            <p className="text-destructive text-xs">No tokens available.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectableSymbols.map((symbol) => {
                const sym = strategy.symbols?.find((s) => s.symbol === symbol)
                const isSelected = selectedSymbols.includes(symbol)
                return (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => toggleSymbol(symbol)}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-[#6c47ff] border-[#6c47ff] text-white'
                        : 'bg-input border-border text-foreground hover:border-[#6c47ff]',
                    )}
                  >
                    {sym && (
                      <span className={sym.market_type === 'swap' ? 'text-amber-400' : 'text-emerald-400'}>
                        {sym.market_type === 'swap' ? 'P' : 'S'}
                      </span>
                    )}
                    {symbol}
                    {sym?.market_type === 'swap' && <span className="opacity-70">{sym.leverage}×</span>}
                  </button>
                )
              })}
            </div>
          )}
          {selectableSymbols.length > 0 && selectedSymbols.length === 0 && (
            <p className="text-muted-foreground text-xs mt-1">Select at least one token</p>
          )}
        </div>

        {/* Budget */}
        <div>
          <Label className="mb-1 block">
            {isDCA ? 'Total DCA budget (USDT)' : 'Margin (USDT)'}{' '}
            {availableBalance != null ? (
              <span className="text-foreground font-semibold">— available: ${availableBalance.toFixed(2)}</span>
            ) : selectedExchange ? (
              <span className="text-muted-foreground font-normal">— balance syncing…</span>
            ) : null}
          </Label>
          <Input
            type="number"
            placeholder={availableBalance != null ? `0.1 – ${availableBalance.toFixed(2)}` : 'e.g. 100'}
            min="0.1"
            max={maxMargin > 0 ? maxMargin : undefined}
            step="any"
            {...register('margin', {
              required: 'Enter a valid amount',
              min: { value: 0.1, message: 'Minimum is $0.10' },
              ...(maxMargin > 0 && {
                max: { value: maxMargin, message: `Exceeds available balance ($${maxMargin.toFixed(2)})` },
              }),
            })}
          />
          {errors.margin && <p className="text-destructive text-xs mt-1">{errors.margin.message}</p>}
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
          <Button type="submit" size="sm" disabled={launchWorker.isPending || !canStart} className="flex-1">
            {launchWorker.isPending
              ? 'Starting…'
              : slotsExhausted
              ? 'All slots in use'
              : !subscription
              ? 'Subscription required'
              : verifiedExchanges.length === 0
              ? 'Connect API key first'
              : selectedSymbols.length === 0
              ? 'Select at least one token'
              : '▶ Start Worker'}
          </Button>
        </div>
      </form>

      {signalError && <p className="text-destructive text-xs mt-1">{signalError}</p>}
      {launchWorker.error && (
        <p className="text-destructive text-xs mt-1">{launchWorker.error.message ?? 'Failed to start worker'}</p>
      )}
      {launchWorker.isSuccess && (
        <p className="text-success text-xs mt-1">
          Worker started! It will open trades automatically{isDCA ? '.' : ' when signals fire.'}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Worker card
// ---------------------------------------------------------------------------

function WorkerCard({ worker, trades }: { worker: Worker; trades: Trade[] }) {
  const stopWorker = useStopWorker()
  const isRunning = worker.status === 'running'

  const openPositions = trades.filter((t) => t.worker_id === worker.id && t.status === 'open')

  const activeTokens =
    worker.selected_symbols && worker.selected_symbols.length > 0
      ? worker.selected_symbols
      : worker.strategy_symbols ?? []

  return (
    <Card className="p-4 bg-input border-border">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-bold text-sm">Worker #{worker.id}</span>
          <Badge variant={isRunning ? 'success' : 'secondary'}>{worker.status.toUpperCase()}</Badge>
        </div>
        <span className="text-muted-foreground text-xs">
          {worker.started_at ? new Date(worker.started_at).toLocaleDateString() : ''}
        </span>
      </div>

      {activeTokens.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {activeTokens.map((sym) => (
            <Badge key={sym} variant="default" className="text-xs">{sym}</Badge>
          ))}
        </div>
      )}

      <div className="flex gap-4 text-xs mb-3 flex-wrap">
        <div>
          <div className="text-muted-foreground">Exchange</div>
          <div className="text-foreground font-semibold">{worker.exchange_id.toUpperCase()}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Budget</div>
          <div className="text-foreground font-semibold">${parseFloat(worker.margin).toFixed(2)}</div>
        </div>
        {worker.stopped_at && (
          <div>
            <div className="text-muted-foreground">Stopped</div>
            <div className="text-foreground font-semibold">{new Date(worker.stopped_at).toLocaleDateString()}</div>
          </div>
        )}
      </div>

      {openPositions.length > 0 && (
        <div className="mb-3">
          <div className="text-muted-foreground text-xs mb-1.5 font-medium">
            Open positions ({openPositions.length})
          </div>
          <div className="flex flex-col gap-1.5">
            {openPositions.map((pos) => {
              const d = pos.details ?? {}
              return (
                <div key={pos.id} className="bg-muted/40 rounded-lg px-3 py-2 flex justify-between items-center">
                  <div>
                    <span className="text-foreground font-semibold text-xs">{pos.symbol}</span>
                    {d.market_type && (
                      <span className="text-muted-foreground text-xs ml-1.5">
                        {String(d.market_type).toUpperCase()}
                        {d.leverage && d.leverage > 1 ? ` ${d.leverage}×` : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-xs">
                    {d.entry_price && (
                      <span className="text-foreground font-semibold">
                        @ ${parseFloat(String(d.entry_price)).toFixed(4)}
                      </span>
                    )}
                    {d.take_profit_price && (
                      <span className="text-success ml-2">
                        TP ${parseFloat(String(d.take_profit_price)).toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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

// ---------------------------------------------------------------------------
// Trade row
// ---------------------------------------------------------------------------

function TradeItem({ trade }: { trade: Trade }) {
  const d = trade.details ?? {}
  const badgeVariantMap: Record<string, 'success' | 'destructive' | 'warning'> = {
    win: 'success',
    loss: 'destructive',
    open: 'warning',
  }
  return (
    <Card className="p-4 bg-input border-border">
      <div className="flex justify-between items-center mb-2">
        <div className="text-foreground font-bold text-sm">
          {trade.symbol}
          {d.dca_order_number != null && (
            <span className="text-muted-foreground text-xs font-normal ml-1.5">DCA #{d.dca_order_number}</span>
          )}
          {d.entry_number != null && (
            <span className="text-muted-foreground text-xs font-normal ml-1.5">#{d.entry_number}</span>
          )}
        </div>
        <Badge variant={badgeVariantMap[trade.status] ?? 'warning'}>{trade.status.toUpperCase()}</Badge>
      </div>
      <div className="flex gap-4 flex-wrap text-xs">
        {[
          { l: 'Entry', v: d.entry_price ? `$${parseFloat(String(d.entry_price)).toFixed(4)}` : '—' },
          { l: 'TP', v: d.take_profit_price ? `$${parseFloat(String(d.take_profit_price)).toFixed(4)}` : '—' },
          { l: 'SL', v: d.stop_loss_price ? `$${parseFloat(String(d.stop_loss_price)).toFixed(4)}` : '—' },
          { l: 'Amount', v: d.margin ? `$${parseFloat(String(d.margin)).toFixed(2)}` : '—' },
          { l: 'Leverage', v: d.leverage ? `${d.leverage}×` : '—' },
        ]
          .filter(({ v }) => v !== '—')
          .map(({ l, v }) => (
            <div key={l}>
              <div className="text-muted-foreground">{l}</div>
              <div className="text-foreground font-semibold">{v}</div>
            </div>
          ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TradingStrategy() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: strategies = [], isLoading } = useStrategies()
  const { data: workers = [] } = useWorkers()
  const { data: trades = [] } = useTrades()
  const { data: exchanges = [] } = useExchanges()
  const { data: subscriptions = [] } = useMySubs()

  const strategyId = id ? parseInt(id) : null
  const strategy: Strategy | undefined = strategies.find((s) => s.id === strategyId)

  const activeSub: Subscription | null = subscriptions.find((s) => s.status === 'active') ?? null
  const strategyWorkers = workers.filter((w) => w.strategy_id === strategyId)
  const runningWorkers = strategyWorkers.filter((w) => w.status === 'running')
  const strategyTradeIds = new Set(strategyWorkers.map((w) => w.id))
  const strategyTrades = trades.filter((t) => strategyTradeIds.has(t.worker_id))

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  if (!strategy) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-5">
        <p className="text-muted-foreground text-sm">Strategy not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/trading')}>
          ← Back to strategies
        </Button>
      </div>
    )
  }

  const isDCA = strategy.strategy === 'DCA'

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Back header */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <button
          onClick={() => navigate('/trading')}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-foreground text-lg font-bold leading-tight">{strategy.name}</h1>
          <p className="text-[#a78bfa] text-xs">{strategy.strategy}</p>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Settings chips */}
        <div className="flex flex-wrap gap-2 text-xs">
          {isDCA ? (
            <>
              <span className="bg-input border border-border rounded-full px-2.5 py-1 text-foreground">
                Max orders: {strategy.settings?.max_orders ?? 5}
              </span>
              <span className="bg-input border border-border rounded-full px-2.5 py-1 text-foreground">
                Step: {strategy.settings?.step_percent ?? 0.5}%
              </span>
              <span className="bg-input border border-border rounded-full px-2.5 py-1 text-foreground">
                Multiplier: {strategy.settings?.amount_multiplier ?? 2}×
              </span>
              <span className="bg-input border border-border rounded-full px-2.5 py-1 text-foreground">
                TP: +{strategy.settings?.take_profit_percent ?? 1.0}%
              </span>
            </>
          ) : (
            <>
              <span className="bg-input border border-border rounded-full px-2.5 py-1 text-foreground">
                {(() => {
                  const swapSyms = strategy.symbols.filter(s => s.market_type === 'swap')
                  if (swapSyms.length === 0) return 'Spot'
                  const leverages = [...new Set(swapSyms.map(s => `${s.leverage}×`))].join('/')
                  return leverages + ' Futures'
                })()}
              </span>
              <span className="bg-input border border-border rounded-full px-2.5 py-1 text-foreground">
                R:R 1:{strategy.rr_ratio}
              </span>
            </>
          )}
        </div>

        {/* How it works */}
        <div className="bg-[#1a1a2e] border border-[#6c47ff33] rounded-[10px] p-3.5">
          <p className="text-[#a78bfa] text-xs leading-relaxed">
            <strong className="text-[#c4b5fd]">How it works:</strong>
            <br />
            {isDCA ? (
              <>
                • Opens an initial order immediately at market price
                <br />
                • Each {strategy.settings?.step_percent ?? 0.5}% drop triggers a safety order ({strategy.settings?.amount_multiplier ?? 2}× larger)
                <br />
                • Max {strategy.settings?.max_orders ?? 5} orders per cycle · TP at avg entry +{strategy.settings?.take_profit_percent ?? 1.0}%
                <br />
                • Total budget is split proportionally — all orders combined stay within the set amount
              </>
            ) : (
              <>
                • Worker runs automatically in the background
                <br />
                • D1 MACD bullish crossover → opens a Long trade
                <br />
                • Risk/Reward 1:{strategy.rr_ratio} · Auto-closes at TP or SL
              </>
            )}
          </p>
        </div>

        {/* Latest backtest */}
        {strategy.latest_backtest && (
          <Card className="p-3.5 bg-input border-border">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-foreground font-semibold text-sm">Latest Published Backtest</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {strategy.latest_backtest.period_start} → {strategy.latest_backtest.period_end}
                </div>
              </div>
              <Badge variant={strategy.latest_backtest.net_profit_usd >= 0 ? 'success' : 'destructive'}>
                {strategy.latest_backtest.net_profit_usd >= 0 ? '+' : ''}
                {strategy.latest_backtest.net_profit_usd.toFixed(2)} USDT
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { l: 'Trades', v: strategy.latest_backtest.total_trades },
                { l: 'Win rate', v: `${strategy.latest_backtest.win_rate.toFixed(1)}%` },
                { l: 'Max DD', v: `-${strategy.latest_backtest.max_drawdown_usd.toFixed(2)} USDT` },
                { l: 'Profit factor', v: strategy.latest_backtest.profit_factor?.toFixed(2) ?? '—' },
              ].map(({ l, v }) => (
                <div key={l}>
                  <div className="text-muted-foreground">{l}</div>
                  <div className="text-foreground font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Start worker */}
        <div>
          <h2 className="text-foreground font-semibold text-sm mb-3">Start Worker</h2>
          <StartWorkerForm
            strategy={strategy}
            subscription={activeSub}
            exchanges={exchanges}
            runningCount={runningWorkers.length}
          />
        </div>

        {/* Workers */}
        {strategyWorkers.length > 0 && (
          <div>
            <h2 className="text-foreground font-semibold text-sm mb-3">
              Workers
              {runningWorkers.length > 0 && (
                <Badge variant="success" className="ml-2 text-xs">{runningWorkers.length} running</Badge>
              )}
            </h2>
            <div className="flex flex-col gap-2.5">
              {strategyWorkers.map((w) => (
                <WorkerCard key={w.id} worker={w} trades={strategyTrades} />
              ))}
            </div>
          </div>
        )}

        {/* Trade history */}
        {strategyTrades.length > 0 && (
          <div>
            <h2 className="text-foreground font-semibold text-sm mb-3">
              Trades
              <span className="text-muted-foreground font-normal ml-1.5 text-xs">
                ({strategyTrades.filter((t) => t.status === 'open').length} open)
              </span>
            </h2>
            <div className="flex flex-col gap-2.5">
              {strategyTrades.map((t) => (
                <TradeItem key={t.id} trade={t} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
