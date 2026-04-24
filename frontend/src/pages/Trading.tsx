import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useStrategies, useWorkers } from '../hooks/useTrading'
import { Strategy } from '../types'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

function StrategyListCard({
  strategy,
  runningCount,
}: {
  strategy: Strategy
  runningCount: number
}) {
  const navigate = useNavigate()
  const isDCA = strategy.strategy === 'DCA'

  return (
    <Card
      className="mx-5 mb-3 p-4 cursor-pointer hover:border-[#6c47ff] transition-colors"
      onClick={() => navigate(`/trading/${strategy.id}`)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-foreground font-bold text-base truncate">{strategy.name}</span>
            {runningCount > 0 && (
              <Badge variant="success" className="text-xs shrink-0">{runningCount} running</Badge>
            )}
          </div>
          <div className="text-[#a78bfa] text-xs mb-2">{strategy.strategy}</div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {isDCA ? (
              <>
                <span>Max orders: <strong className="text-foreground">{strategy.settings?.max_orders ?? 5}</strong></span>
                <span>Step: <strong className="text-foreground">{strategy.settings?.step_percent ?? 0.5}%</strong></span>
                <span>TP: <strong className="text-foreground">+{strategy.settings?.take_profit_percent ?? 1.0}%</strong></span>
              </>
            ) : (
              <>
                <span>Mode: <strong className="text-foreground">{
                  (() => {
                    const swapSyms = strategy.symbols.filter(s => s.market_type === 'swap')
                    if (swapSyms.length === 0) return 'Spot'
                    const leverages = [...new Set(swapSyms.map(s => `${s.leverage}×`))].join('/')
                    return leverages + ' Futures'
                  })()
                }</strong></span>
                <span>R:R: <strong className="text-foreground">1:{strategy.rr_ratio}</strong></span>
              </>
            )}
            <span>Pairs: <strong className="text-foreground">{(strategy.symbols ?? []).length}</strong></span>
          </div>

          {strategy.latest_backtest && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={strategy.latest_backtest.net_profit_usd >= 0 ? 'success' : 'destructive'} className="text-xs">
                {strategy.latest_backtest.net_profit_usd >= 0 ? '+' : ''}
                {strategy.latest_backtest.net_profit_usd.toFixed(2)} USDT backtest
              </Badge>
              <span className="text-muted-foreground text-xs">{strategy.latest_backtest.win_rate.toFixed(1)}% WR</span>
            </div>
          )}
        </div>
        <ChevronRight size={18} className="text-muted-foreground ml-3 shrink-0" />
      </div>
    </Card>
  )
}

export default function Trading() {
  const { data: strategies = [], isLoading } = useStrategies()
  const { data: workers = [] } = useWorkers()

  const runningCountByStrategy = (strategyId: number) =>
    workers.filter((w) => w.strategy_id === strategyId && w.status === 'running').length

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-foreground text-[22px] font-bold">Strategies</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {strategies.length > 0
            ? `${strategies.length} strateg${strategies.length === 1 ? 'y' : 'ies'} available — tap to trade`
            : 'No strategies available yet'}
        </p>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-6 px-5 text-sm">Loading strategies…</p>
      ) : strategies.length === 0 ? (
        <p className="text-center text-muted-foreground py-6 px-5 text-sm">No strategies available yet.</p>
      ) : (
        strategies.map((s) => (
          <StrategyListCard
            key={s.id}
            strategy={s}
            runningCount={runningCountByStrategy(s.id)}
          />
        ))
      )}
    </div>
  )
}
