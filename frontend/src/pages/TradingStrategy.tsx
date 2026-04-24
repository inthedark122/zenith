import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useExchanges } from '../hooks/useExchanges'
import { useMySubs } from '../hooks/useSubscriptions'
import { useStartTokens, useStopTokens, useStrategies, useTrades, useWorkers } from '../hooks/useTrading'
import { Exchange, Strategy, Subscription, Trade, Worker } from '../types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Tokens panel — replaces StartWorkerForm + WorkerCard
// ---------------------------------------------------------------------------

function TokensPanel({
  strategy,
  exchanges,
  subscription,
  workers,
}: {
  strategy: Strategy
  exchanges: Exchange[]
  subscription: Subscription | null
  workers: Worker[]
}) {
  const verifiedExchanges = exchanges.filter((e) => e.status === 'verified')

  // Auto-select exchange: prefer one that has a running worker for this strategy
  const runningWorker = workers.find((w) => w.strategy_id === strategy.id && w.status === 'running')
  const defaultExchangeId = runningWorker?.user_exchange_id
    ? String(runningWorker.user_exchange_id)
    : verifiedExchanges[0]
    ? String(verifiedExchanges[0].id)
    : ''

  const [selectedExchangeId, setSelectedExchangeId] = useState(defaultExchangeId)
  const [budget, setBudget] = useState('')
  const [selectedForStart, setSelectedForStart] = useState<string[]>([])
  const [selectedForStop, setSelectedForStop] = useState<string[]>([])

  const startTokens = useStartTokens()
  const stopTokens = useStopTokens()

  const userExchangeId = selectedExchangeId ? parseInt(selectedExchangeId) : undefined
  const activeWorker = workers.find(
    (w) =>
      w.strategy_id === strategy.id &&
      w.status === 'running' &&
      (w.user_exchange_id === userExchangeId || (!userExchangeId && w.status === 'running')),
  )
  const activeSymbols: string[] = activeWorker?.selected_symbols ?? []
  const currentMargin = activeWorker ? parseFloat(String(activeWorker.margin)) : null

  const allSymbols = (strategy.symbols ?? []).map((s) => s.symbol)
  const inactiveSymbols = allSymbols.filter((s) => !activeSymbols.includes(s))

  const toggleStartSelect = (sym: string) =>
    setSelectedForStart((prev) => (prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]))
  const toggleStopSelect = (sym: string) =>
    setSelectedForStop((prev) => (prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]))

  const effectiveBudget = currentMargin !== null ? currentMargin : parseFloat(budget)
  const budgetValid = currentMargin !== null || (budget !== '' && parseFloat(budget) > 0)

  const planMax: Record<string, number> = { starter: 1, trader: 2, pro: 3 }
  const maxSlots = planMax[subscription?.plan ?? ''] ?? 1
  const runningCount = workers.filter((w) => w.status === 'running').length
  const canStartNew = !activeWorker && runningCount < maxSlots && !!subscription

  const handleStartAll = () => {
    if (!budgetValid || (!activeWorker && !canStartNew)) return
    startTokens.mutate(
      { strategy_id: strategy.id, symbols: inactiveSymbols, margin: effectiveBudget, user_exchange_id: userExchangeId },
      { onSuccess: () => setSelectedForStart([]) },
    )
  }

  const handleStartSelected = () => {
    if (!budgetValid || (!activeWorker && !canStartNew) || selectedForStart.length === 0) return
    startTokens.mutate(
      { strategy_id: strategy.id, symbols: selectedForStart, margin: effectiveBudget, user_exchange_id: userExchangeId },
      { onSuccess: () => setSelectedForStart([]) },
    )
  }

  const handleStopAll = () => {
    if (activeSymbols.length === 0) return
    stopTokens.mutate(
      { strategy_id: strategy.id, symbols: activeSymbols, user_exchange_id: userExchangeId },
      { onSuccess: () => setSelectedForStop([]) },
    )
  }

  const handleStopSelected = () => {
    if (selectedForStop.length === 0) return
    stopTokens.mutate(
      { strategy_id: strategy.id, symbols: selectedForStop, user_exchange_id: userExchangeId },
      { onSuccess: () => setSelectedForStop([]) },
    )
  }

  if (verifiedExchanges.length === 0) {
    return (
      <Card className="p-4 border-border bg-input text-center">
        <p className="text-muted-foreground text-sm">Connect and verify an exchange to start trading.</p>
      </Card>
    )
  }

  if (!subscription) {
    return (
      <Card className="p-4 border-border bg-input text-center">
        <p className="text-muted-foreground text-sm">An active subscription is required to trade.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Exchange selector */}
      {verifiedExchanges.length > 1 && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Exchange</Label>
          <div className="flex flex-wrap gap-2">
            {verifiedExchanges.map((ex) => (
              <button
                key={ex.id}
                onClick={() => {
                  setSelectedExchangeId(String(ex.id))
                  setSelectedForStart([])
                  setSelectedForStop([])
                }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  selectedExchangeId === String(ex.id)
                    ? 'bg-[#6c47ff] border-[#6c47ff] text-white'
                    : 'bg-input border-border text-muted-foreground hover:border-[#6c47ff]',
                )}
              >
                {ex.exchange_id.toUpperCase()}
                {ex.balance_usdt_free != null && (
                  <span className="ml-1 opacity-70">${parseFloat(String(ex.balance_usdt_free)).toFixed(0)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Budget */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">
          Total DCA budget (USDT)
        </Label>
        {currentMargin !== null ? (
          <div className="flex items-center gap-2">
            <div className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground font-semibold w-32">
              ${currentMargin.toFixed(2)}
            </div>
            <span className="text-muted-foreground text-xs">Active — budget locked</span>
          </div>
        ) : (
          <div className="space-y-1">
            <Input
              type="number"
              min="0.1"
              step="0.1"
              placeholder="e.g. 10.00"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-40 text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Split proportionally across all DCA orders per token cycle
            </p>
          </div>
        )}
      </div>

      {/* Tokens */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs text-muted-foreground">Tokens</Label>
          <div className="flex gap-2">
            {inactiveSymbols.length > 0 && (
              <button
                className="text-xs text-[#a78bfa] hover:text-[#6c47ff] transition-colors"
                onClick={() =>
                  setSelectedForStart((prev) =>
                    prev.length === inactiveSymbols.length ? [] : [...inactiveSymbols],
                  )
                }
              >
                {selectedForStart.length === inactiveSymbols.length ? 'Deselect all' : 'Select all inactive'}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Active tokens */}
          {activeSymbols.map((sym) => {
            const forStop = selectedForStop.includes(sym)
            return (
              <button
                key={sym}
                onClick={() => toggleStopSelect(sym)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  forStop
                    ? 'bg-destructive/20 border-destructive text-destructive'
                    : 'bg-green-500/10 border-green-500/40 text-green-400 hover:border-destructive/60',
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                {sym.replace('/USDT', '')}
                {forStop && <XCircle size={11} className="opacity-80" />}
              </button>
            )
          })}

          {/* Inactive tokens */}
          {inactiveSymbols.map((sym) => {
            const forStart = selectedForStart.includes(sym)
            return (
              <button
                key={sym}
                onClick={() => toggleStartSelect(sym)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  forStart
                    ? 'bg-[#6c47ff]/20 border-[#6c47ff] text-[#a78bfa]'
                    : 'bg-input border-border text-muted-foreground hover:border-[#6c47ff]/50',
                )}
              >
                {sym.replace('/USDT', '')}
                {forStart && <CheckCircle2 size={11} className="opacity-80" />}
              </button>
            )
          })}
        </div>

        {allSymbols.length === 0 && (
          <p className="text-muted-foreground text-xs mt-2">No tokens configured for this strategy.</p>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {inactiveSymbols.length > 0 && (
          <Button
            size="sm"
            onClick={handleStartAll}
            disabled={startTokens.isPending || !budgetValid || (!activeWorker && !canStartNew)}
            className="bg-[#6c47ff] hover:bg-[#5a3de8] text-white text-xs"
          >
            {startTokens.isPending ? 'Starting…' : `▶ Start All (${inactiveSymbols.length})`}
          </Button>
        )}
        {selectedForStart.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleStartSelected}
            disabled={startTokens.isPending || !budgetValid || (!activeWorker && !canStartNew)}
            className="text-xs"
          >
            {startTokens.isPending ? 'Starting…' : `▶ Start Selected (${selectedForStart.length})`}
          </Button>
        )}
        {activeSymbols.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleStopAll}
            disabled={stopTokens.isPending}
            className="border-destructive/50 text-destructive hover:bg-destructive/10 text-xs"
          >
            {stopTokens.isPending ? 'Stopping…' : `⏹ Stop All`}
          </Button>
        )}
        {selectedForStop.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleStopSelected}
            disabled={stopTokens.isPending}
            className="border-destructive/50 text-destructive hover:bg-destructive/10 text-xs"
          >
            {stopTokens.isPending ? 'Stopping…' : `⏹ Stop Selected (${selectedForStop.length})`}
          </Button>
        )}
      </div>

      {/* Plan limit warning */}
      {!activeWorker && runningCount >= maxSlots && (
        <p className="text-yellow-400 text-xs">
          Plan limit reached ({maxSlots} active strateg{maxSlots === 1 ? 'y' : 'ies'}). Stop another strategy to start this one.
        </p>
      )}

      {/* Feedback */}
      {startTokens.isSuccess && (
        <p className="text-green-400 text-xs">
          ✓ Tokens activated. Trading started automatically in the background.
        </p>
      )}
      {startTokens.isError && (
        <p className="text-destructive text-xs">
          {startTokens.error instanceof Error ? startTokens.error.message : 'Failed to start tokens'}
        </p>
      )}
      {stopTokens.isSuccess && (
        <p className="text-muted-foreground text-xs">
          ✓ {(stopTokens.data as { message?: string })?.message ?? 'Tokens stopped.'}
        </p>
      )}
      {stopTokens.isError && (
        <p className="text-destructive text-xs">
          {stopTokens.error instanceof Error ? stopTokens.error.message : 'Failed to stop tokens'}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trade item
// ---------------------------------------------------------------------------

function TradeItem({ trade }: { trade: Trade }) {
  const d = trade.details ?? {}
  const isOpen = trade.status === 'open'
  return (
    <Card className="p-3 bg-input border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-semibold text-sm">{trade.symbol}</span>
          <Badge variant={isOpen ? 'secondary' : trade.status === 'win' ? 'success' : 'destructive'} className="text-xs">
            {trade.status.toUpperCase()}
          </Badge>
        </div>
        {trade.exchange && (
          <span className="text-muted-foreground text-xs">{trade.exchange.toUpperCase()}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {[
          { l: 'Entry', v: d.entry_price ? `$${parseFloat(String(d.entry_price)).toFixed(4)}` : '—' },
          { l: 'TP', v: d.take_profit_price ? `$${parseFloat(String(d.take_profit_price)).toFixed(4)}` : '—' },
          { l: 'SL', v: d.stop_loss_price ? `$${parseFloat(String(d.stop_loss_price)).toFixed(4)}` : '—' },
          { l: 'Budget', v: d.margin ? `$${parseFloat(String(d.margin)).toFixed(2)}` : '—' },
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
  const runningWorkers = strategyWorkers.filter((w) => w.status === 'running')

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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-lg font-bold leading-tight truncate">{strategy.name}</h1>
            {runningWorkers.length > 0 && (
              <Badge variant="success" className="text-xs shrink-0">{runningWorkers.length} active</Badge>
            )}
          </div>
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
                  const swapSyms = strategy.symbols.filter((s) => s.market_type === 'swap')
                  if (swapSyms.length === 0) return 'Spot'
                  const leverages = [...new Set(swapSyms.map((s) => `${s.leverage}×`))].join('/')
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
                • Total budget split proportionally — all orders stay within the set amount
              </>
            ) : (
              <>
                • Runs automatically in the background
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

        {/* Tokens panel */}
        <div>
          <h2 className="text-foreground font-semibold text-sm mb-3">Trading Tokens</h2>
          <TokensPanel
            strategy={strategy}
            exchanges={exchanges}
            subscription={activeSub}
            workers={workers}
          />
        </div>

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
