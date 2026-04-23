import { useMySubs } from '../hooks/useSubscriptions'
import { useWorkers } from '../hooks/useTrading'
import { cn } from '@/lib/utils'

const PLAN_MAX: Record<string, number> = { starter: 1, trader: 2, pro: 3 }
const PLAN_LABEL: Record<string, string> = { starter: 'Starter', trader: 'Trader', pro: 'Pro' }

export default function SubscriptionBar() {
  const { data: subscriptions = [] } = useMySubs()
  const { data: workers = [] } = useWorkers()

  const activeSub = subscriptions.find((s) => s.status === 'active') ?? null
  const runningCount = workers.filter((w) => w.status === 'running').length

  if (!activeSub) {
    return (
      <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] bg-destructive/15 border-t border-destructive/30 px-4 py-1.5 flex items-center gap-2">
        <span className="text-destructive text-[11px] font-semibold">⚠ No active subscription</span>
      </div>
    )
  }

  const maxSlots = PLAN_MAX[activeSub.plan] ?? 1
  const slotsExhausted = runningCount >= maxSlots
  const coins = activeSub.coins ?? []

  return (
    <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] bg-card/95 backdrop-blur border-t border-border px-4 py-1.5 flex items-center gap-3">
      <span className="text-[#a78bfa] text-[11px] font-bold uppercase tracking-wide shrink-0">
        {PLAN_LABEL[activeSub.plan] ?? activeSub.plan}
      </span>
      <span className={cn(
        'text-[11px] font-semibold shrink-0',
        slotsExhausted ? 'text-destructive' : 'text-success',
      )}>
        {runningCount}/{maxSlots} bots
      </span>
      {coins.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {coins.map((c) => (
            <span
              key={c}
              className="shrink-0 bg-[#6c47ff22] text-[#a78bfa] text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-[#6c47ff44]"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
