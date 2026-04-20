import { BarChart3, ChevronLeft, FlaskConical, Plus, Save, Shield, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  useAdminStrategies,
  useCreateAdminStrategy,
  useDeleteAdminStrategy,
  useRunStrategyBacktest,
  useStrategyBacktests,
  useUpdateAdminStrategy,
} from '../hooks/useAdmin'
import {
  AdminStrategyPayload,
  Strategy,
  StrategyBacktestOrder,
  StrategyBacktestSummary,
} from '../types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function defaultPayload(): AdminStrategyPayload {
  return {
    name: '',
    strategy: 'DCA_MACD_DAILY',
    symbols: ['BTC/USDT'],
    leverage: 20,
    rr_ratio: 2,
    settings: {
      max_daily_margin_usd: 0,
      max_daily_trades: 2,
    },
    is_active: true,
  }
}

function toPayload(strategy: Strategy): AdminStrategyPayload {
  return {
    name: strategy.name,
    strategy: strategy.strategy,
    symbols: strategy.symbols,
    leverage: strategy.leverage,
    rr_ratio: strategy.rr_ratio,
    settings: {
      max_daily_margin_usd: strategy.settings?.max_daily_margin_usd ?? 0,
      max_daily_trades: strategy.settings?.max_daily_trades ?? 2,
    },
    is_active: strategy.is_active ?? true,
  }
}

function Metric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div className="text-muted-foreground text-[11px] uppercase tracking-wide">{label}</div>
      <div className="text-foreground font-semibold text-sm mt-1">{value}</div>
    </div>
  )
}

function SummaryCard({
  title,
  summary,
}: {
  title: string
  summary: StrategyBacktestSummary
}) {
  return (
    <Card className="p-4 bg-input border-border">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div>
          <div className="text-foreground font-semibold text-sm">{title}</div>
          <div className="text-muted-foreground text-xs mt-1">
            {summary.period_start} → {summary.period_end} • {summary.lookback_days}d • $
            {summary.margin_per_trade}/trade
          </div>
        </div>
        <Badge variant={summary.net_profit_usd >= 0 ? 'success' : 'destructive'}>
          {summary.net_profit_usd >= 0 ? '+' : ''}
          {summary.net_profit_usd.toFixed(2)} USDT
        </Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Trades" value={String(summary.total_trades)} />
        <Metric label="Win Rate" value={`${summary.win_rate.toFixed(2)}%`} />
        <Metric label="Profit Factor" value={summary.profit_factor?.toFixed(2) ?? '—'} />
        <Metric label="Max DD" value={`-${summary.max_drawdown_usd.toFixed(2)} USDT`} />
      </div>
    </Card>
  )
}

function OrderRow({ order }: { order: StrategyBacktestOrder }) {
  return (
    <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.9fr_0.9fr_0.8fr_0.9fr_0.8fr] gap-3 text-xs py-2 border-b border-border last:border-b-0">
      <div>
        <div className="text-foreground font-medium">{order.symbol}</div>
        <div className="text-muted-foreground">
          {new Date(order.closed_at).toLocaleDateString()} • {order.close_reason}
        </div>
      </div>
      <div className="text-foreground">{order.side.toUpperCase()}</div>
      <div className={order.status === 'win' ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
        {order.status.toUpperCase()}
      </div>
      <div className="text-foreground">${order.entry_price.toFixed(4)}</div>
      <div className="text-foreground">${order.exit_price.toFixed(4)}</div>
      <div className="text-foreground">${order.margin_per_trade.toFixed(2)}</div>
      <div className={order.pnl_usd >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
        {order.pnl_usd >= 0 ? '+' : ''}
        {order.pnl_usd.toFixed(2)}
      </div>
      <div className="text-muted-foreground">{order.bars_held} bars</div>
    </div>
  )
}

export default function AdminStrategies() {
  const navigate = useNavigate()
  const { data: strategies = [], isLoading } = useAdminStrategies()
  const createStrategy = useCreateAdminStrategy()
  const updateStrategy = useUpdateAdminStrategy()
  const deleteStrategy = useDeleteAdminStrategy()
  const runBacktest = useRunStrategyBacktest()

  const [selectedId, setSelectedId] = useState<number | 'new'>('new')
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [form, setForm] = useState<AdminStrategyPayload>(defaultPayload())
  const [backtestLookbackDays, setBacktestLookbackDays] = useState('365')
  const [backtestMargin, setBacktestMargin] = useState('100')
  const [formError, setFormError] = useState('')

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === selectedId) ?? null,
    [selectedId, strategies],
  )
  const { data: backtests = [], isLoading: backtestsLoading } = useStrategyBacktests(
    selectedStrategy?.id ?? null,
  )

  useEffect(() => {
    setSelectedRunId(backtests[0]?.id ?? null)
  }, [selectedStrategy?.id, backtests])

  const selectedBacktest = useMemo(
    () => backtests.find((run) => run.id === selectedRunId) ?? backtests[0] ?? null,
    [backtests, selectedRunId],
  )

  const loadStrategy = (strategy: Strategy | null) => {
    if (strategy) {
      setSelectedId(strategy.id)
      setForm(toPayload(strategy))
    } else {
      setSelectedId('new')
      setForm(defaultPayload())
    }
    setFormError('')
  }

  const handleFieldChange = <K extends keyof AdminStrategyPayload>(key: K, value: AdminStrategyPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const saveStrategy = () => {
    setFormError('')
    const payload: AdminStrategyPayload = {
      ...form,
      symbols: form.symbols.filter(Boolean),
    }

    if (!payload.name.trim()) {
      setFormError('Strategy name is required')
      return
    }
    if (payload.symbols.length === 0) {
      setFormError('Add at least one symbol')
      return
    }

    if (selectedId === 'new') {
      createStrategy.mutate(payload, {
        onSuccess: (strategy) => loadStrategy(strategy),
      })
      return
    }

    updateStrategy.mutate({
      strategyId: selectedId,
      payload,
    })
  }

  const removeStrategy = (strategyId: number) => {
    if (!window.confirm('Delete this strategy?')) return
    deleteStrategy.mutate(strategyId, {
      onSuccess: () => loadStrategy(null),
    })
  }

  const triggerBacktest = (strategyId: number) => {
    runBacktest.mutate(
      {
        strategyId,
        payload: {
          lookback_days: Number(backtestLookbackDays),
          margin_per_trade: Number(backtestMargin),
        },
      },
      {
        onSuccess: (run) => setSelectedRunId(run.id),
      },
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </Button>
        <div>
          <div className="text-foreground text-lg font-semibold flex items-center gap-2">
            <Shield size={18} className="text-[#a78bfa]" />
            Admin Strategy Lab
          </div>
          <div className="text-muted-foreground text-xs mt-1">
            Manage strategy parameters, run historical simulations, and inspect each simulated order.
          </div>
        </div>
      </div>

      <div className="px-5 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-center gap-2" onClick={() => loadStrategy(null)}>
            <Plus size={16} />
            New Strategy
          </Button>

          {isLoading ? (
            <Card className="p-4 text-sm text-muted-foreground">Loading strategies…</Card>
          ) : (
            strategies.map((strategy) => (
              <Card
                key={strategy.id}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedId === strategy.id ? 'border-[#6c47ff]' : 'hover:border-[#333]'
                }`}
                onClick={() => loadStrategy(strategy)}
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="text-foreground font-semibold">{strategy.name}</div>
                    <div className="text-[#a78bfa] text-xs mt-1">{strategy.strategy}</div>
                  </div>
                  <Badge variant={strategy.is_active ? 'success' : 'secondary'}>
                    {strategy.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="text-muted-foreground text-xs mt-2">
                  {(strategy.symbols ?? []).join(', ')}
                </div>
                {strategy.latest_backtest && (
                  <div className="text-muted-foreground text-xs mt-2">
                    {strategy.latest_backtest.total_trades} trades •{' '}
                    {strategy.latest_backtest.win_rate.toFixed(2)}% win •{' '}
                    {strategy.latest_backtest.net_profit_usd >= 0 ? '+' : ''}
                    {strategy.latest_backtest.net_profit_usd.toFixed(2)} USDT
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-foreground font-semibold text-base">
                  {selectedId === 'new' ? 'Create Strategy' : 'Edit Strategy'}
                </div>
                <div className="text-muted-foreground text-xs mt-1">
                  Parameter tuning lives here; execution logic remains in Python strategy adapters.
                </div>
              </div>
              {selectedStrategy && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeStrategy(selectedStrategy.id)}
                  disabled={deleteStrategy.isPending}
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="BTC Daily Trend"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Strategy Key</Label>
                <Input value={form.strategy} disabled className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <Label>Symbols (comma separated)</Label>
                <Input
                  value={form.symbols.join(', ')}
                  onChange={(e) =>
                    handleFieldChange(
                      'symbols',
                      e.target.value
                        .split(',')
                        .map((symbol) => symbol.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="BTC/USDT, ETH/USDT"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Leverage</Label>
                <Input
                  type="number"
                  value={form.leverage}
                  onChange={(e) => handleFieldChange('leverage', Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Risk : Reward</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.rr_ratio}
                  onChange={(e) => handleFieldChange('rr_ratio', Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Max daily trades</Label>
                <Input
                  type="number"
                  value={form.settings.max_daily_trades ?? 2}
                  onChange={(e) =>
                    handleFieldChange('settings', {
                      ...form.settings,
                      max_daily_trades: Number(e.target.value),
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Max daily margin (USDT)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.settings.max_daily_margin_usd ?? 0}
                  onChange={(e) =>
                    handleFieldChange('settings', {
                      ...form.settings,
                      max_daily_margin_usd: Number(e.target.value),
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground mt-4">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => handleFieldChange('is_active', e.target.checked)}
              />
              Active and visible to users
            </label>

            {formError && <p className="text-destructive text-xs mt-3">{formError}</p>}
            {(createStrategy.error ?? updateStrategy.error ?? deleteStrategy.error) && (
              <p className="text-destructive text-xs mt-3">
                {(createStrategy.error ?? updateStrategy.error ?? deleteStrategy.error)?.message ??
                  'Admin action failed'}
              </p>
            )}

            <Button className="mt-4 w-full gap-2" onClick={saveStrategy}>
              <Save size={16} />
              {selectedId === 'new' ? 'Create Strategy' : 'Save Changes'}
            </Button>
          </Card>

          {selectedStrategy && (
            <>
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FlaskConical size={18} className="text-[#a78bfa]" />
                  <div>
                    <div className="text-foreground font-semibold">Run Backtest</div>
                    <div className="text-muted-foreground text-xs mt-1">
                      Each run is saved separately with its own statistics and simulated orders.
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Lookback days</Label>
                    <Input
                      type="number"
                      value={backtestLookbackDays}
                      onChange={(e) => setBacktestLookbackDays(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Margin per trade (USDT)</Label>
                    <Input
                      type="number"
                      value={backtestMargin}
                      onChange={(e) => setBacktestMargin(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                {runBacktest.error && (
                  <p className="text-destructive text-xs mt-3">
                    {runBacktest.error.message ?? 'Backtest failed'}
                  </p>
                )}
                <Button
                  className="mt-4 w-full gap-2"
                  variant="outline"
                  onClick={() => triggerBacktest(selectedStrategy.id)}
                  disabled={runBacktest.isPending}
                >
                  <BarChart3 size={16} />
                  {runBacktest.isPending ? 'Running Backtest…' : 'Run and Save Backtest'}
                </Button>
              </Card>

              {selectedStrategy.latest_backtest && (
                <SummaryCard title="Latest Published Snapshot" summary={selectedStrategy.latest_backtest} />
              )}

              <Card className="p-5">
                <div className="text-foreground font-semibold mb-3">Backtest History</div>
                {backtestsLoading ? (
                  <div className="text-muted-foreground text-sm">Loading backtests…</div>
                ) : backtests.length === 0 ? (
                  <div className="text-muted-foreground text-sm">
                    No backtests yet. Run one to generate statistics and order history.
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      {backtests.map((run) => (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => setSelectedRunId(run.id)}
                          className={`w-full text-left p-3 rounded-xl border transition-colors ${
                            selectedBacktest?.id === run.id
                              ? 'border-[#6c47ff] bg-input'
                              : 'border-border hover:border-[#333]'
                          }`}
                        >
                          <div className="flex justify-between gap-3 items-start">
                            <div>
                              <div className="text-foreground text-sm font-semibold">
                                Run #{run.id}
                              </div>
                              <div className="text-muted-foreground text-xs mt-1">
                                {new Date(run.generated_at).toLocaleString()}
                              </div>
                            </div>
                            <Badge variant={run.net_profit_usd >= 0 ? 'success' : 'destructive'}>
                              {run.net_profit_usd >= 0 ? '+' : ''}
                              {run.net_profit_usd.toFixed(2)}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground text-xs mt-2">
                            {run.total_trades} trades • {run.win_rate.toFixed(2)}% win • DD{' '}
                            {run.max_drawdown_usd.toFixed(2)}
                          </div>
                        </button>
                      ))}
                    </div>

                    {selectedBacktest && (
                      <div className="space-y-4">
                        <SummaryCard title={`Backtest Run #${selectedBacktest.id}`} summary={selectedBacktest} />

                        <Card className="p-4 bg-input border-border">
                          <div className="text-foreground font-semibold text-sm mb-3">Per-Symbol Results</div>
                          <div className="space-y-2">
                            {selectedBacktest.symbol_results.map((result) => (
                              <div
                                key={result.symbol}
                                className="flex items-center justify-between text-xs border-b border-border pb-2 last:border-b-0"
                              >
                                <div className="text-foreground font-medium">{result.symbol}</div>
                                <div className="text-muted-foreground">
                                  {result.total_trades} trades • {result.win_rate.toFixed(2)}% •{' '}
                                  {result.net_profit_usd >= 0 ? '+' : ''}
                                  {result.net_profit_usd.toFixed(2)} USDT
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>

                        <Card className="p-4 bg-input border-border">
                          <div className="text-foreground font-semibold text-sm mb-3">Assumptions</div>
                          <div className="text-muted-foreground text-xs space-y-1">
                            {selectedBacktest.assumption_notes.map((note) => (
                              <div key={note}>• {note}</div>
                            ))}
                          </div>
                        </Card>

                        <Card className="p-4 bg-input border-border">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-foreground font-semibold text-sm">Simulated Orders</div>
                            <div className="text-muted-foreground text-xs">
                              {selectedBacktest.orders.length} closed orders
                            </div>
                          </div>
                          {selectedBacktest.orders.length === 0 ? (
                            <div className="text-muted-foreground text-sm">No orders were opened in this run.</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <div className="min-w-[880px]">
                                <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.9fr_0.9fr_0.8fr_0.9fr_0.8fr] gap-3 text-[11px] uppercase tracking-wide text-muted-foreground pb-2 border-b border-border">
                                  <div>Trade</div>
                                  <div>Side</div>
                                  <div>Status</div>
                                  <div>Entry</div>
                                  <div>Exit</div>
                                  <div>Margin</div>
                                  <div>PnL</div>
                                  <div>Bars</div>
                                </div>
                                {selectedBacktest.orders.map((order, index) => (
                                  <OrderRow key={`${order.symbol}-${order.closed_at}-${index}`} order={order} />
                                ))}
                              </div>
                            </div>
                          )}
                        </Card>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
