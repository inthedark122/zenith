import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
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
// Tokens panel — card grid layout
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

  // Auto-select exchange: prefer one with a running worker for this strategy
  const runningWorker = workers.find((w) => w.strategy_id === strategy.id && w.status === 'running')
  const defaultExchangeId = runningWorker?.user_exchange_id
    ? String(runningWorker.user_exchange_id)
    : verifiedExchanges[0]
    ? String(verifiedExchanges[0].id)
    : ''

  const [selectedExchangeId, setSelectedExchangeId] = useState(defaultExchangeId)

  const [groupBudget, setGroupBudget] = useState('')
  const [groupPercent, setGroupPercent] = useState('')
  const [marginMode, setMarginMode] = useState<'group' | 'per-token'>('group')
  const [perTokenMargins, setPerTokenMargins] = useState<Record<string, string>>({})

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
  const allSymbols = (strategy.symbols ?? []).map((s) => s.symbol)
  const inactiveSymbols = allSymbols.filter((s) => !activeSymbols.includes(s))

  const [selectedInactive, setSelectedInactive] = useState<Set<string>>(
    () => new Set(inactiveSymbols),
  )
  const [selectedForStop, setSelectedForStop] = useState<string[]>([])

  const enabledList = inactiveSymbols.filter((s) => selectedInactive.has(s))

  const selectedExchange = verifiedExchanges.find((e) => String(e.id) === selectedExchangeId)
  const availableBalance = selectedExchange?.balance_usdt_free != null
    ? parseFloat(String(selectedExchange.balance_usdt_free))
    : null

  const handleGroupBudgetChange = (val: string) => {
    setGroupBudget(val)
    if (availableBalance && val !== '' && !isNaN(parseFloat(val))) {
      setGroupPercent(((parseFloat(val) / availableBalance) * 100).toFixed(1))
    } else {
      setGroupPercent('')
    }
  }
  const handleGroupPercentChange = (val: string) => {
    setGroupPercent(val)
    if (availableBalance && val !== '' && !isNaN(parseFloat(val))) {
      setGroupBudget(((parseFloat(val) / 100) * availableBalance).toFixed(2))
    } else {
      setGroupBudget('')
    }
  }

  const totalBudget = parseFloat(groupBudget) || 0
  const equalShare = enabledList.length > 0 && totalBudget > 0
    ? totalBudget / enabledList.length
    : 0

  const activatePerTokenMode = (editedSym: string, newVal: string) => {
    if (marginMode === 'group') {
      const snapshot: Record<string, string> = {}
      for (const sym of enabledList) {
        snapshot[sym] = equalShare > 0 ? equalShare.toFixed(2) : ''
      }
      snapshot[editedSym] = newVal
      setPerTokenMargins(snapshot)
      setMarginMode('per-token')
    } else {
      setPerTokenMargins((prev) => ({ ...prev, [editedSym]: newVal }))
    }
  }

  const resetToGroupMode = () => {
    setMarginMode('group')
    setPerTokenMargins({})
  }

  const buildSymbolMargins = (symbols: string[]): Record<string, number> => {
    const result: Record<string, number> = {}
    for (const sym of symbols) {
      const val = marginMode === 'per-token'
        ? parseFloat(perTokenMargins[sym] || '0')
        : equalShare
      if (val > 0) result[sym] = val
    }
    return result
  }

  const perTokenTotal = useMemo(() => {
    if (marginMode !== 'per-token') return 0
    return Object.values(perTokenMargins).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
  }, [marginMode, perTokenMargins])

  const globalBudgetValid = groupBudget !== '' && totalBudget > 0
  const perTokenValid = enabledList.every((s) => (parseFloat(perTokenMargins[s] || '0') > 0))

  const planMax: Record<string, number> = { starter: 1, trader: 2, pro: 3 }
  const maxSlots = planMax[subscription?.plan ?? ''] ?? 1
  const runningCount = workers.filter((w) => w.status === 'running').length
  const canStartNew = !activeWorker && runningCount < maxSlots && !!subscription

  const handleStart = () => {
    if (enabledList.length === 0) return
    const symMargins = buildSymbolMargins(enabledList)
    startTokens.mutate({
      strategy_id: strategy.id,
      symbols: enabledList,
      symbol_margins: symMargins,
      user_exchange_id: userExchangeId,
    })
  }

  const handleStopSelected = () => {
    if (selectedForStop.length === 0) return
    stopTokens.mutate(
      { strategy_id: strategy.id, symbols: selectedForStop, user_exchange_id: userExchangeId },
      { onSuccess: () => setSelectedForStop([]) },
    )
  }

  const handleStopAll = () => {
    if (activeSymbols.length === 0) return
    stopTokens.mutate(
      { strategy_id: strategy.id, symbols: activeSymbols, user_exchange_id: userExchangeId },
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

  const startPending = startTokens.isPending
  const stopPending = stopTokens.isPending

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

      {/* Budget section */}
      {inactiveSymbols.length > 0 && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Budget (USDT)</Label>
          {marginMode === 'group' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <Input
                    type="number" min="0.1" step="0.1"
                    placeholder="0.00"
                    value={groupBudget}
                    onChange={(e) => handleGroupBudgetChange(e.target.value)}
                    className="pl-6 w-28 text-sm"
                  />
                </div>
                {availableBalance != null && (
                  <>
                    <span className="text-muted-foreground text-xs">or</span>
                    <div className="relative">
                      <Input
                        type="number" min="0.1" max="100" step="0.1"
                        placeholder="0.0"
                        value={groupPercent}
                        onChange={(e) => handleGroupPercentChange(e.target.value)}
                        className="pr-6 w-20 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                    </div>
                    <span className="text-muted-foreground text-xs">of ${availableBalance.toFixed(0)}</span>
                  </>
                )}
              </div>
              {equalShare > 0 && enabledList.length > 0 && (
                <p className="text-[#a78bfa] text-xs">
                  {enabledList.length} token{enabledList.length !== 1 ? 's' : ''} × ${equalShare.toFixed(2)} each
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-2 text-xs text-yellow-300 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Individual amounts set · Total: ${perTokenTotal.toFixed(2)}</span>
              </div>
              <button
                className="text-xs text-[#a78bfa] hover:text-[#6c47ff] transition-colors underline"
                onClick={resetToGroupMode}
              >
                Reset to equal split
              </button>
            </div>
          )}
        </div>
      )}

      {/* Token cards grid */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">
          Tokens
          <span className="ml-1.5 text-[11px]">
            {activeSymbols.length > 0 && `${activeSymbols.length} active`}
            {activeSymbols.length > 0 && enabledList.length > 0 && ' · '}
            {enabledList.length > 0 && `${enabledList.length} selected`}
          </span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {allSymbols.map((sym) => {
            const isActive = activeSymbols.includes(sym)
            const isSelectedForStop = selectedForStop.includes(sym)
            const isSelectedForStart = selectedInactive.has(sym)
            const isStarting = startPending && isSelectedForStart && !isActive
            const isStopping = stopPending && isSelectedForStop && isActive
            const tokenBudget = activeWorker?.symbol_margins?.[sym]
            const displayAmount = isActive ? null : (
              marginMode === 'per-token'
                ? (perTokenMargins[sym] ?? '')
                : isSelectedForStart && equalShare > 0
                ? equalShare.toFixed(2)
                : ''
            )

            if (isActive) {
              return (
                <button
                  key={sym}
                  onClick={() =>
                    setSelectedForStop((prev) =>
                      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym],
                    )
                  }
                  disabled={isStopping}
                  className={cn(
                    'rounded-xl p-3 border text-left transition-all',
                    isSelectedForStop
                      ? 'bg-destructive/10 border-destructive/60'
                      : 'bg-green-500/5 border-green-500/30 hover:border-green-500/60',
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          isStopping ? 'bg-muted-foreground animate-pulse' : 'bg-green-400',
                        )} />
                        <span className="text-foreground text-sm font-semibold truncate">
                          {sym.replace('/USDT', '')}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-[11px]">USDT</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn(
                        'text-[11px] font-medium mb-0.5',
                        isSelectedForStop ? 'text-destructive' : 'text-green-400',
                      )}>
                        {isStopping ? 'Stopping…' : isSelectedForStop ? 'Stop?' : 'Active'}
                      </div>
                      {tokenBudget != null && (
                        <div className="text-foreground text-xs font-semibold">
                          ${Number(tokenBudget).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            }

            return (
              <div
                key={sym}
                className={cn(
                  'rounded-xl p-3 border transition-all',
                  isSelectedForStart
                    ? 'bg-[#6c47ff]/5 border-[#6c47ff]/40'
                    : 'bg-input border-border opacity-60',
                )}
              >
                <button
                  className="w-full text-left"
                  onClick={() =>
                    setSelectedInactive((prev) => {
                      const next = new Set(prev)
                      if (next.has(sym)) next.delete(sym)
                      else next.add(sym)
                      return next
                    })
                  }
                >
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0 transition-colors',
                          isSelectedForStart ? 'bg-[#6c47ff]' : 'bg-muted-foreground/40',
                        )} />
                        <span className={cn(
                          'text-sm font-semibold truncate',
                          isSelectedForStart ? 'text-foreground' : 'text-muted-foreground',
                        )}>
                          {sym.replace('/USDT', '')}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-[11px]">USDT</span>
                    </div>
                    <div className={cn(
                      'text-[11px] font-medium shrink-0',
                      isSelectedForStart ? 'text-[#a78bfa]' : 'text-muted-foreground/50',
                    )}>
                      {isStarting ? 'Starting…' : isSelectedForStart ? 'Selected' : 'Inactive'}
                    </div>
                  </div>
                </button>
                {isSelectedForStart && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                    <Input
                      type="number" min="0.1" step="0.1"
                      value={displayAmount ?? ''}
                      onChange={(e) => activatePerTokenMode(sym, e.target.value)}
                      placeholder={equalShare > 0 ? equalShare.toFixed(2) : '0.00'}
                      className={cn(
                        'pl-5 w-full h-7 text-xs',
                        marginMode === 'per-token' && perTokenMargins[sym] !== undefined
                          ? 'border-[#6c47ff]/60'
                          : '',
                      )}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {enabledList.length > 0 && (
          <Button
            size="sm"
            onClick={handleStart}
            disabled={
              startPending ||
              (marginMode === 'per-token' && !perTokenValid) ||
              (marginMode === 'group' && !globalBudgetValid) ||
              (!activeWorker && !canStartNew)
            }
            className="bg-[#6c47ff] hover:bg-[#5a3de8] text-white text-xs"
          >
            {startPending
              ? 'Starting…'
              : `▶ Start ${enabledList.length} Token${enabledList.length !== 1 ? 's' : ''}`}
          </Button>
        )}
        {selectedForStop.length > 0 && (
          <Button
            size="sm" variant="outline"
            onClick={handleStopSelected}
            disabled={stopPending}
            className="border-destructive/50 text-destructive hover:bg-destructive/10 text-xs"
          >
            {stopPending ? 'Stopping…' : `⏹ Stop ${selectedForStop.length}`}
          </Button>
        )}
        {activeSymbols.length > 0 && selectedForStop.length === 0 && (
          <Button
            size="sm" variant="outline"
            onClick={handleStopAll}
            disabled={stopPending}
            className="border-destructive/50 text-destructive hover:bg-destructive/10 text-xs"
          >
            {stopPending ? 'Stopping…' : '⏹ Stop All'}
          </Button>
        )}
      </div>

      {!activeWorker && runningCount >= maxSlots && (
        <p className="text-yellow-400 text-xs">
          Plan limit reached ({maxSlots} active strateg{maxSlots === 1 ? 'y' : 'ies'}). Stop another to start this one.
        </p>
      )}

      {startTokens.isSuccess && (
        <p className="text-green-400 text-xs">✓ Tokens activated.</p>
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
