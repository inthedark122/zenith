import {
  BarChart3,
  ChevronLeft,
  Eye,
  EyeOff,
  FlaskConical,
  Save,
  Shield,
  Trash2,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  useAdminStrategies,
  useBacktestCandles,
  useDeleteAdminStrategy,
  usePublishBacktest,
  useRunStrategyBacktest,
  useStrategyBacktests,
  useUpdateAdminStrategy,
} from '../hooks/useAdmin'
import {
  AdminStrategyPayload,
  StrategyBacktestOrder,
  StrategyBacktestRun,
  StrategyBacktestSummary,
} from '../types'
import { Badge } from '@/components/ui/badge'
import { BacktestChart } from '@/components/ui/backtest-chart'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { SymbolPicker } from '@/components/ui/symbol-picker'

// ---- Small helpers ----

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-muted-foreground text-[11px] uppercase tracking-wide">{label}</div>
      <div className={`font-semibold text-sm ${highlight ? 'text-[#a78bfa]' : 'text-foreground'}`}>{value}</div>
    </div>
  )
}

function StatBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SummaryCard({ summary, actions }: { summary: StrategyBacktestSummary; actions?: React.ReactNode }) {
  return (
    <Card className="p-4 border-border">
      <div className="flex justify-between items-start gap-3 mb-4">
        <div>
          <div className="text-muted-foreground text-xs">
            {summary.period_start} → {summary.period_end} · {summary.lookback_days}d · ${summary.margin_per_trade}/trade
          </div>
          <div className="text-foreground font-semibold mt-1">{summary.total_trades} simulated trades</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={summary.net_profit_usd >= 0 ? 'success' : 'destructive'}>
            {summary.net_profit_usd >= 0 ? '+' : ''}{summary.net_profit_usd.toFixed(2)} USDT
          </Badge>
          {actions}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <Metric label="Win Rate" value={`${summary.win_rate.toFixed(1)}%`} highlight />
        <Metric label="Profit Factor" value={summary.profit_factor?.toFixed(2) ?? '—'} />
        <Metric label="Max Drawdown" value={`-$${summary.max_drawdown_usd.toFixed(2)}`} />
        <Metric label="Avg Win" value={`+$${summary.avg_win_usd.toFixed(2)}`} />
        <Metric label="Gross Profit" value={`+$${summary.gross_profit_usd.toFixed(2)}`} />
        <Metric label="Gross Loss" value={`-$${summary.gross_loss_usd.toFixed(2)}`} />
        <Metric label="Best Trade" value={`+$${(summary.best_trade_usd ?? 0).toFixed(2)}`} />
        <Metric label="Worst Trade" value={`-$${Math.abs(summary.worst_trade_usd ?? 0).toFixed(2)}`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatBar label="Wins" value={summary.wins} total={summary.total_trades} color="bg-success" />
        <StatBar label="Losses" value={summary.losses} total={summary.total_trades} color="bg-destructive" />
      </div>
    </Card>
  )
}

function OrdersTable({ orders }: { orders: StrategyBacktestOrder[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        <div className="grid grid-cols-[1fr_0.7fr_0.7fr_1fr_1fr_0.8fr_0.8fr_0.7fr] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground pb-2 border-b border-border px-2">
          <div>Symbol / Date</div>
          <div>Side</div>
          <div>Result</div>
          <div>Entry</div>
          <div>Exit</div>
          <div>Margin</div>
          <div>PnL</div>
          <div>Bars</div>
        </div>
        {orders.map((o, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_0.7fr_0.7fr_1fr_1fr_0.8fr_0.8fr_0.7fr] gap-2 text-xs py-2 border-b border-border last:border-0 px-2 hover:bg-input/50 transition-colors"
          >
            <div>
              <div className="text-foreground font-medium">{o.symbol}</div>
              <div className="text-muted-foreground text-[10px]">
                {new Date(o.closed_at).toLocaleDateString()} · {o.close_reason}
              </div>
            </div>
            <div className="text-foreground self-center">{o.side.toUpperCase()}</div>
            <div className={`self-center font-semibold ${o.status === 'win' ? 'text-success' : 'text-destructive'}`}>
              {o.status.toUpperCase()}
            </div>
            <div className="text-foreground self-center">${o.entry_price.toFixed(4)}</div>
            <div className="text-foreground self-center">${o.exit_price.toFixed(4)}</div>
            <div className="text-foreground self-center">${o.margin_per_trade.toFixed(2)}</div>
            <div className={`self-center font-semibold ${o.pnl_usd >= 0 ? 'text-success' : 'text-destructive'}`}>
              {o.pnl_usd >= 0 ? '+' : ''}{o.pnl_usd.toFixed(2)}
            </div>
            <div className="text-muted-foreground self-center">{o.bars_held}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Tabs ----

type Tab = 'dashboard' | 'edit' | 'backtests'

const TABS: { key: Tab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'edit', label: 'Edit' },
  { key: 'backtests', label: 'Backtests' },
]

// ---- Main page ----

export default function AdminStrategyDetail() {
  const { id } = useParams<{ id: string }>()
  const strategyId = id ? parseInt(id, 10) : null
  const navigate = useNavigate()

  const { data: strategies = [], isLoading: strategiesLoading } = useAdminStrategies()
  const strategy = strategies.find((s) => s.id === strategyId) ?? null

  const { data: backtests = [], isLoading: backtestsLoading } = useStrategyBacktests(strategyId)

  const updateStrategy = useUpdateAdminStrategy()
  const deleteStrategy = useDeleteAdminStrategy()
  const runBacktest = useRunStrategyBacktest()
  const publishBacktest = usePublishBacktest()

  const [tab, setTab] = useState<Tab>('dashboard')
  const [form, setForm] = useState<AdminStrategyPayload | null>(null)
  const [formError, setFormError] = useState('')
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [backtestDays, setBacktestDays] = useState('365')
  const [backtestMargin, setBacktestMargin] = useState('100')
  const [chartSymbol, setChartSymbol] = useState<string | null>(null)

  useEffect(() => {
    if (strategy) {
      setForm({
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
      })
    }
  }, [strategy?.id])

  useEffect(() => {
    if (backtests.length > 0 && selectedRunId === null) {
      setSelectedRunId(backtests[0].id)
    }
  }, [backtests])

  const selectedRun = useMemo(
    () => backtests.find((r) => r.id === selectedRunId) ?? backtests[0] ?? null,
    [backtests, selectedRunId],
  )

  // Auto-select first symbol for chart when run changes
  useEffect(() => {
    if (selectedRun) {
      const firstSymbol = selectedRun.symbol_results[0]?.symbol ?? selectedRun.orders[0]?.symbol ?? null
      setChartSymbol(firstSymbol)
    }
  }, [selectedRun?.id])

  const { data: chartCandles = [], isFetching: chartLoading } = useBacktestCandles(
    selectedRun?.id ?? null,
    chartSymbol,
  )

  const dashboardBacktest = strategy?.latest_backtest ?? backtests[0] ?? null

  if (strategiesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  if (!strategy || !form) {
    return (
      <div className="min-h-screen bg-background px-5 pt-10">
        <p className="text-destructive text-sm">Strategy not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/admin/strategies')}>
          ← Back to strategies
        </Button>
      </div>
    )
  }

  const handleFieldChange = <K extends keyof AdminStrategyPayload>(key: K, value: AdminStrategyPayload[K]) => {
    setForm((f) => f ? { ...f, [key]: value } : f)
  }

  const saveStrategy = () => {
    if (!form) return
    setFormError('')
    const payload = { ...form, symbols: form.symbols.filter(Boolean) }
    if (!payload.name.trim()) { setFormError('Strategy name is required'); return }
    if (payload.symbols.length === 0) { setFormError('Add at least one symbol'); return }
    updateStrategy.mutate({ strategyId: strategy.id, payload })
  }

  const handleDelete = () => {
    if (!window.confirm(`Delete "${strategy.name}"? This cannot be undone.`)) return
    deleteStrategy.mutate(strategy.id, {
      onSuccess: () => navigate('/admin/strategies'),
    })
  }

  const triggerBacktest = (days: number) => {
    runBacktest.mutate(
      { strategyId: strategy.id, payload: { lookback_days: days, margin_per_trade: Number(backtestMargin) } },
      { onSuccess: (run) => { setSelectedRunId(run.id); setTab('backtests') } },
    )
  }

  const togglePublish = (run: StrategyBacktestRun) => {
    publishBacktest.mutate({ strategyId: strategy.id, backtestId: run.id, isPublic: !run.is_public })
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 pt-6 pb-4">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate('/admin/strategies')}>
          <ChevronLeft size={20} />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Shield size={16} className="text-[#a78bfa] shrink-0" />
            <span className="text-foreground text-lg font-bold truncate">{strategy.name}</span>
            <Badge variant={strategy.is_active ? 'success' : 'secondary'} className="shrink-0">
              {strategy.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="text-muted-foreground text-xs mt-1">
            {strategy.strategy} · {strategy.symbols.join(', ')} · {strategy.leverage}× · R:R 1:{strategy.rr_ratio}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex mx-5 mb-4 border-b border-border">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold cursor-pointer bg-transparent border-none border-b-2 transition-colors ${
              tab === key ? 'text-[#a78bfa] border-b-[#a78bfa]' : 'text-muted-foreground border-b-transparent hover:text-foreground'
            }`}
          >
            {label}
            {key === 'backtests' && backtests.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-input text-muted-foreground px-1.5 py-0.5 rounded-full">
                {backtests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-5 space-y-4">
        {/* ---- DASHBOARD TAB ---- */}
        {tab === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Backtests', value: String(backtests.length) },
                { label: 'Public Backtests', value: String(backtests.filter((r) => r.is_public).length) },
                { label: 'Symbols', value: String(strategy.symbols.length) },
                { label: 'Leverage', value: `${strategy.leverage}×` },
              ].map((m) => (
                <Card key={m.label} className="p-4">
                  <Metric label={m.label} value={m.value} />
                </Card>
              ))}
            </div>

            {dashboardBacktest ? (
              <>
                <div className="text-foreground text-sm font-semibold">Latest Backtest Snapshot</div>
                <SummaryCard summary={dashboardBacktest} />

                {dashboardBacktest.symbol_results.length > 0 && (
                  <Card className="p-4">
                    <div className="text-foreground font-semibold text-sm mb-3">Per-Symbol</div>
                    <div className="space-y-2">
                      {dashboardBacktest.symbol_results.map((sr) => (
                        <div key={sr.symbol} className="flex items-center justify-between text-xs">
                          <span className="text-foreground font-medium">{sr.symbol}</span>
                          <span className="text-muted-foreground">
                            {sr.total_trades} trades · {sr.win_rate.toFixed(1)}% win ·{' '}
                            <span className={sr.net_profit_usd >= 0 ? 'text-success' : 'text-destructive'}>
                              {sr.net_profit_usd >= 0 ? '+' : ''}{sr.net_profit_usd.toFixed(2)} USDT
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <Card className="p-6 text-center">
                <FlaskConical size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No backtests yet.</p>
                <Button variant="outline" className="mt-4 gap-2" onClick={() => setTab('backtests')}>
                  <BarChart3 size={14} />
                  Run First Backtest
                </Button>
              </Card>
            )}
          </>
        )}

        {/* ---- EDIT TAB ---- */}
        {tab === 'edit' && (
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => handleFieldChange('name', e.target.value)} placeholder="BTC Daily Trend" className="mt-1" />
              </div>
              <div>
                <Label>Strategy Key</Label>
                <Input value={form.strategy} disabled className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Label>Symbols</Label>
                <SymbolPicker
                  value={form.symbols}
                  onChange={(syms) => handleFieldChange('symbols', syms)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Leverage</Label>
                <Input type="number" value={form.leverage} onChange={(e) => handleFieldChange('leverage', Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <Label>Risk : Reward</Label>
                <Input type="number" step="0.1" value={form.rr_ratio} onChange={(e) => handleFieldChange('rr_ratio', Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <Label>Max daily trades</Label>
                <Input
                  type="number"
                  value={form.settings.max_daily_trades ?? 2}
                  onChange={(e) => handleFieldChange('settings', { ...form.settings, max_daily_trades: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Max daily margin (USDT)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.settings.max_daily_margin_usd ?? 0}
                  onChange={(e) => handleFieldChange('settings', { ...form.settings, max_daily_margin_usd: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground mt-4 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => handleFieldChange('is_active', e.target.checked)} />
              Active and visible to users
            </label>

            {formError && <p className="text-destructive text-xs mt-3">{formError}</p>}
            {(updateStrategy.error || deleteStrategy.error) && (
              <p className="text-destructive text-xs mt-3">
                {(updateStrategy.error ?? deleteStrategy.error)?.message ?? 'Action failed'}
              </p>
            )}
            {updateStrategy.isSuccess && <p className="text-success text-xs mt-3">Saved successfully.</p>}

            <div className="flex gap-3 mt-4">
              <Button className="flex-1 gap-2" onClick={saveStrategy} disabled={updateStrategy.isPending}>
                <Save size={15} />
                {updateStrategy.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button variant="danger" size="icon" onClick={handleDelete} disabled={deleteStrategy.isPending}>
                <Trash2 size={15} />
              </Button>
            </div>
          </Card>
        )}

        {/* ---- BACKTESTS TAB ---- */}
        {tab === 'backtests' && (
          <>
            {/* Run backtest panel */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <FlaskConical size={16} className="text-[#a78bfa]" />
                <span className="text-foreground font-semibold">Run Backtest</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Lookback days</Label>
                  <Input type="number" value={backtestDays} onChange={(e) => setBacktestDays(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Margin per trade (USDT)</Label>
                  <Input type="number" value={backtestMargin} onChange={(e) => setBacktestMargin(e.target.value)} className="mt-1" />
                </div>
              </div>
              {runBacktest.error && (
                <p className="text-destructive text-xs mt-3">{runBacktest.error.message ?? 'Backtest failed'}</p>
              )}
              <div className="flex gap-2 mt-4">
                <Button
                  className="flex-1 gap-2"
                  variant="outline"
                  onClick={() => triggerBacktest(Number(backtestDays))}
                  disabled={runBacktest.isPending}
                >
                  <BarChart3 size={14} />
                  {runBacktest.isPending ? 'Running…' : 'Run Full Backtest'}
                </Button>
                <Button
                  className="gap-2"
                  variant="outline"
                  onClick={() => { setBacktestDays('30'); triggerBacktest(30) }}
                  disabled={runBacktest.isPending}
                  title="Quick 30-day backtest"
                >
                  <Zap size={14} />
                  30d Quick
                </Button>
                <Button
                  className="gap-2"
                  variant="outline"
                  onClick={() => { setBacktestDays('90'); triggerBacktest(90) }}
                  disabled={runBacktest.isPending}
                  title="Short 90-day backtest"
                >
                  <Zap size={14} />
                  90d
                </Button>
              </div>
            </Card>

            {/* Backtest history */}
            {backtestsLoading ? (
              <p className="text-muted-foreground text-sm py-4">Loading backtests…</p>
            ) : backtests.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No backtests yet.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                {/* Run list */}
                <div className="space-y-2">
                  {backtests.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => setSelectedRunId(run.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${
                        selectedRun?.id === run.id ? 'border-[#6c47ff] bg-input' : 'border-border hover:border-[#333]'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="text-foreground text-sm font-semibold flex items-center gap-1.5">
                            Run #{run.id}
                            {run.is_public && (
                              <Eye size={11} className="text-[#a78bfa]" />
                            )}
                          </div>
                          <div className="text-muted-foreground text-[10px] mt-0.5">
                            {new Date(run.generated_at).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant={run.net_profit_usd >= 0 ? 'success' : 'destructive'} className="text-[10px]">
                          {run.net_profit_usd >= 0 ? '+' : ''}{run.net_profit_usd.toFixed(2)}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground text-[10px] mt-1.5">
                        {run.total_trades} trades · {run.win_rate.toFixed(1)}% win · {run.lookback_days}d
                      </div>
                    </button>
                  ))}
                </div>

                {/* Selected run detail */}
                {selectedRun && (
                  <div className="space-y-4">
                    <SummaryCard
                      summary={selectedRun}
                      actions={
                        <Button
                          variant={selectedRun.is_public ? 'outline' : 'default'}
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => togglePublish(selectedRun)}
                          disabled={publishBacktest.isPending}
                        >
                          {selectedRun.is_public ? <EyeOff size={13} /> : <Eye size={13} />}
                          {selectedRun.is_public ? 'Unpublish' : 'Make Public'}
                        </Button>
                      }
                    />

                    {/* KLine chart */}
                    {chartSymbol !== null && (
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                          <div className="text-foreground font-semibold text-sm flex items-center gap-2">
                            <BarChart3 size={15} className="text-[#a78bfa]" />
                            Chart
                            {chartLoading && (
                              <span className="text-muted-foreground text-[10px] font-normal">Loading…</span>
                            )}
                          </div>
                          {selectedRun.symbol_results.length > 1 && (
                            <div className="flex gap-1.5 flex-wrap">
                              {selectedRun.symbol_results.map((sr) => (
                                <button
                                  key={sr.symbol}
                                  onClick={() => setChartSymbol(sr.symbol)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer border ${
                                    chartSymbol === sr.symbol
                                      ? 'border-[#6c47ff] bg-[#6c47ff]/20 text-foreground'
                                      : 'border-border text-muted-foreground hover:text-foreground hover:border-[#333]'
                                  }`}
                                >
                                  {sr.symbol}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {!chartLoading && chartCandles.length > 0 ? (
                          <BacktestChart
                            candles={chartCandles}
                            orders={selectedRun.orders}
                            symbol={chartSymbol}
                          />
                        ) : !chartLoading ? (
                          <p className="text-muted-foreground text-sm py-8 text-center">No candle data available.</p>
                        ) : (
                          <div className="h-[420px] rounded-lg bg-[#111] animate-pulse" />
                        )}
                        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-[#4ade80]" />BUY entry</span>
                          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-px border-t border-dashed border-[#4ade80]" />TP level</span>
                          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-px border-t border-dashed border-[#f87171]" />SL level</span>
                          <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-[#a78bfa]" />Exit (TP/SL/FC)</span>
                        </div>
                      </Card>
                    )}

                    {selectedRun.symbol_results.length > 0 && (
                      <Card className="p-4">
                        <div className="text-foreground font-semibold text-sm mb-3">Per-Symbol Results</div>
                        <div className="space-y-2">
                          {selectedRun.symbol_results.map((sr) => (
                            <div key={sr.symbol}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-foreground font-medium">{sr.symbol}</span>
                                <span className={sr.net_profit_usd >= 0 ? 'text-success' : 'text-destructive'}>
                                  {sr.net_profit_usd >= 0 ? '+' : ''}{sr.net_profit_usd.toFixed(2)} USDT
                                </span>
                              </div>
                              <div className="text-muted-foreground text-[10px]">
                                {sr.total_trades} trades · {sr.win_rate.toFixed(1)}% win
                              </div>
                              <Separator className="mt-2" />
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    {selectedRun.assumption_notes.length > 0 && (
                      <Card className="p-4">
                        <div className="text-foreground font-semibold text-sm mb-2">Assumptions</div>
                        <div className="space-y-1">
                          {selectedRun.assumption_notes.map((note) => (
                            <div key={note} className="text-muted-foreground text-xs">• {note}</div>
                          ))}
                        </div>
                      </Card>
                    )}

                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-foreground font-semibold text-sm">Simulated Orders</div>
                        <div className="text-muted-foreground text-xs">{selectedRun.orders.length} closed</div>
                      </div>
                      {selectedRun.orders.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No orders in this run.</p>
                      ) : (
                        <OrdersTable orders={selectedRun.orders} />
                      )}
                    </Card>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
