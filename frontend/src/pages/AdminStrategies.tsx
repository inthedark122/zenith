import { BarChart3, ChevronLeft, Plus, Shield } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAdminStrategies, useCreateAdminStrategy } from '../hooks/useAdmin'
import { AdminStrategyPayload, StrategySymbol } from '../types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SymbolPicker } from '@/components/ui/symbol-picker'

type StrategyType = 'DCA_MACD_DAILY' | 'DCA'

function defaultSettings(type: StrategyType) {
  if (type === 'DCA') {
    return { amount_multiplier: 2, step_percent: 0.5, max_orders: 5, take_profit_percent: 1.0 }
  }
  return { max_daily_margin_usd: 0, max_daily_trades: 2 }
}

function defaultPayload(type: StrategyType = 'DCA_MACD_DAILY'): AdminStrategyPayload {
  return {
    name: '',
    strategy: type,
    symbols: [{ symbol: 'BTC/USDT', market_type: 'spot' as const, leverage: 1 }],
    leverage: type === 'DCA' ? 1 : 20,
    rr_ratio: 2,
    settings: defaultSettings(type),
    is_active: true,
  }
}

export default function AdminStrategies() {
  const navigate = useNavigate()
  const { data: strategies = [], isLoading } = useAdminStrategies()
  const createStrategy = useCreateAdminStrategy()

  const [creating, setCreating] = useState(false)
  const [strategyType, setStrategyType] = useState<StrategyType>('DCA_MACD_DAILY')
  const [form, setForm] = useState<AdminStrategyPayload>(defaultPayload())
  const [formError, setFormError] = useState('')

  const handleStrategyTypeChange = (type: StrategyType) => {
    setStrategyType(type)
    setForm(defaultPayload(type))
  }

  const handleCreate = () => {
    setFormError('')
    const payload = { ...form, symbols: form.symbols.filter((s: StrategySymbol) => s.symbol) }
    if (!payload.name.trim()) { setFormError('Name is required'); return }
    if (payload.symbols.length === 0) { setFormError('Add at least one symbol'); return }
    createStrategy.mutate(payload, {
      onSuccess: (s) => { setCreating(false); setForm(defaultPayload()); navigate(`/admin/strategies/${s.id}`) },
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
            {strategies.length} strateg{strategies.length === 1 ? 'y' : 'ies'}
          </div>
        </div>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => setCreating(true)}>
          <Plus size={15} />
          New
        </Button>
      </div>

      <div className="px-5 space-y-3">
        {/* Create form */}
        {creating && (
          <Card className="p-5">
            <div className="text-foreground font-semibold mb-4">New Strategy</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Strategy Type</Label>
                <select
                  value={strategyType}
                  onChange={(e) => handleStrategyTypeChange(e.target.value as StrategyType)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="DCA_MACD_DAILY">DCA + MACD Daily</option>
                  <option value="DCA">DCA (Dollar Cost Averaging)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="BTC Daily Trend" className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Label>Symbols</Label>
                <SymbolPicker
                  value={form.symbols}
                  onChange={(syms) => setForm((f) => ({ ...f, symbols: syms }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Leverage</Label>
                <Input type="number" value={form.leverage} onChange={(e) => setForm((f) => ({ ...f, leverage: Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label>Risk : Reward</Label>
                <Input type="number" step="0.1" value={form.rr_ratio} onChange={(e) => setForm((f) => ({ ...f, rr_ratio: Number(e.target.value) }))} className="mt-1" />
              </div>

              {strategyType === 'DCA' ? (
                <>
                  <div>
                    <Label>Amount Multiplier</Label>
                    <Input type="number" step="0.1" value={form.settings.amount_multiplier ?? 2} onChange={(e) => setForm((f) => ({ ...f, settings: { ...f.settings, amount_multiplier: Number(e.target.value) } }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Step % (price drop)</Label>
                    <Input type="number" step="0.01" value={form.settings.step_percent ?? 0.5} onChange={(e) => setForm((f) => ({ ...f, settings: { ...f.settings, step_percent: Number(e.target.value) } }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Max Orders</Label>
                    <Input type="number" min={1} value={form.settings.max_orders ?? 5} onChange={(e) => setForm((f) => ({ ...f, settings: { ...f.settings, max_orders: Number(e.target.value) } }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Take Profit %</Label>
                    <Input type="number" step="0.01" value={form.settings.take_profit_percent ?? 1.0} onChange={(e) => setForm((f) => ({ ...f, settings: { ...f.settings, take_profit_percent: Number(e.target.value) } }))} className="mt-1" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>Max daily trades</Label>
                    <Input type="number" value={form.settings.max_daily_trades ?? 2} onChange={(e) => setForm((f) => ({ ...f, settings: { ...f.settings, max_daily_trades: Number(e.target.value) } }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Max daily margin (USDT)</Label>
                    <Input type="number" step="0.01" value={form.settings.max_daily_margin_usd ?? 0} onChange={(e) => setForm((f) => ({ ...f, settings: { ...f.settings, max_daily_margin_usd: Number(e.target.value) } }))} className="mt-1" />
                  </div>
                </>
              )}
            </div>
            {formError && <p className="text-destructive text-xs mt-2">{formError}</p>}
            {createStrategy.error && <p className="text-destructive text-xs mt-2">{createStrategy.error.message}</p>}
            <div className="flex gap-2 mt-4">
              <Button className="flex-1" onClick={handleCreate} disabled={createStrategy.isPending}>
                {createStrategy.isPending ? 'Creating…' : 'Create Strategy'}
              </Button>
              <Button variant="outline" onClick={() => { setCreating(false); setStrategyType('DCA_MACD_DAILY'); setForm(defaultPayload()); setFormError('') }}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {/* Strategy list */}
        {isLoading ? (
          <Card className="p-4 text-sm text-muted-foreground">Loading strategies…</Card>
        ) : strategies.length === 0 && !creating ? (
          <Card className="p-8 text-center">
            <BarChart3 size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No strategies yet. Create one to get started.</p>
          </Card>
        ) : (
          strategies.map((s) => (
            <Card
              key={s.id}
              className="p-4 cursor-pointer hover:border-[#333] transition-colors"
              onClick={() => navigate(`/admin/strategies/${s.id}`)}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="text-foreground font-semibold truncate">{s.name}</div>
                  <div className="text-[#a78bfa] text-xs mt-0.5">{s.strategy}</div>
                  <div className="text-muted-foreground text-xs mt-1">{s.symbols.map(sym => sym.symbol).join(', ')} · {s.leverage}× · R:R 1:{s.rr_ratio}</div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge variant={s.is_active ? 'success' : 'secondary'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
                  {s.latest_backtest && (
                    <span className={`text-xs font-semibold ${s.latest_backtest.net_profit_usd >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {s.latest_backtest.net_profit_usd >= 0 ? '+' : ''}{s.latest_backtest.net_profit_usd.toFixed(2)} USDT
                    </span>
                  )}
                </div>
              </div>
              {s.latest_backtest && (
                <div className="text-muted-foreground text-xs mt-2">
                  {s.latest_backtest.total_trades} trades · {s.latest_backtest.win_rate.toFixed(1)}% win · DD ${s.latest_backtest.max_drawdown_usd.toFixed(2)}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
