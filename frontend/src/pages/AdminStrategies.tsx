import { BarChart3, ChevronLeft, FlaskConical, Plus, Save, Shield, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  useAdminStrategies,
  useCreateAdminStrategy,
  useDeleteAdminStrategy,
  useRunStrategyBacktest,
  useUpdateAdminStrategy,
} from '../hooks/useAdmin'
import { AdminStrategyPayload, Strategy, StrategyBacktestSummary } from '../types'
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

function BacktestCard({ summary }: { summary: StrategyBacktestSummary }) {
  return (
    <Card className="p-4 bg-input border-border">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div>
          <div className="text-foreground font-semibold text-sm">Latest Backtest</div>
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
      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
        <div>
          <div className="text-muted-foreground">Trades</div>
          <div className="text-foreground font-semibold">{summary.total_trades}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Win rate</div>
          <div className="text-foreground font-semibold">{summary.win_rate.toFixed(2)}%</div>
        </div>
        <div>
          <div className="text-muted-foreground">Wins</div>
          <div className="text-success font-semibold">{summary.wins}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Losses</div>
          <div className="text-destructive font-semibold">{summary.losses}</div>
        </div>
      </div>
      {summary.symbol_results.length > 0 && (
        <div className="space-y-2 mb-3">
          {summary.symbol_results.map((result) => (
            <div key={result.symbol} className="flex items-center justify-between text-xs">
              <div className="text-foreground font-medium">{result.symbol}</div>
              <div className="text-muted-foreground">
                {result.total_trades} trades • {result.win_rate.toFixed(2)}% •{' '}
                {result.net_profit_usd >= 0 ? '+' : ''}
                {result.net_profit_usd.toFixed(2)} USDT
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="text-muted-foreground text-[11px] space-y-1">
        {summary.assumption_notes.map((note) => (
          <div key={note}>• {note}</div>
        ))}
      </div>
    </Card>
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
  const [form, setForm] = useState<AdminStrategyPayload>(defaultPayload())
  const [backtestLookbackDays, setBacktestLookbackDays] = useState('365')
  const [backtestMargin, setBacktestMargin] = useState('100')
  const [formError, setFormError] = useState('')

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === selectedId) ?? null,
    [selectedId, strategies],
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
    runBacktest.mutate({
      strategyId,
      payload: {
        lookback_days: Number(backtestLookbackDays),
        margin_per_trade: Number(backtestMargin),
      },
    })
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
            Configure live strategies and publish historical backtest snapshots for users.
          </div>
        </div>
      </div>

      <div className="px-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
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
                {strategy.backtest_summary && (
                  <div className="text-muted-foreground text-xs mt-2">
                    {strategy.backtest_summary.total_trades} trades •{' '}
                    {strategy.backtest_summary.win_rate.toFixed(2)}% win •{' '}
                    {strategy.backtest_summary.net_profit_usd >= 0 ? '+' : ''}
                    {strategy.backtest_summary.net_profit_usd.toFixed(2)} USDT
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
                  Admins can tune supported parameters; execution logic stays in Python.
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
                  <div className="text-foreground font-semibold">Run Backtest</div>
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
                  {runBacktest.isPending ? 'Running Backtest…' : 'Run and Publish Backtest'}
                </Button>
              </Card>

              {selectedStrategy.backtest_summary && (
                <BacktestCard summary={selectedStrategy.backtest_summary} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
