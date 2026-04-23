import { ArrowLeft, Crown, Leaf, Zap } from 'lucide-react'
import { type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useCancelSubscription, useMySubs, usePlans, useSubscribe } from '../hooks/useSubscriptions'
import { useWallet } from '../hooks/useWallet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface PlanConfig {
  color: string
  icon: LucideIcon
}

const planConfig: Record<string, PlanConfig> = {
  starter: { color: '#34d399', icon: Leaf },
  trader: { color: '#a78bfa', icon: Zap },
  pro: { color: '#fbbf24', icon: Crown },
}

export default function Subscriptions() {
  const navigate = useNavigate()

  const { data: plans = [] } = usePlans()
  const { data: mySubs = [] } = useMySubs()
  const { data: wallet } = useWallet()

  const subscribeMutation = useSubscribe()
  const cancelMutation = useCancelSubscription()

  const activeSub = mySubs.find((s) => s.status === 'active')

  const handleBuy = (plan: string) => {
    if (!window.confirm(`Activate the ${plan} plan?`)) return
    subscribeMutation.mutate({ plan })
  }

  const handleCancel = (subId: number) => {
    if (!window.confirm('Cancel your subscription?')) return
    cancelMutation.mutate(subId)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-foreground text-lg font-semibold">Subscription Plans</h1>
      </div>

      {wallet && (
        <Card className="mx-5 mb-4 px-4 py-3 flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Wallet Balance</span>
          <span className="text-foreground font-bold">${Number(wallet.balance).toFixed(2)} USDT</span>
        </Card>
      )}

      {activeSub && (
        <Card className="mx-5 mb-5 p-4 border-success bg-success/5">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-success font-bold text-sm">
                Active Plan: {activeSub.plan.charAt(0).toUpperCase() + activeSub.plan.slice(1)}
              </div>
              <div className="text-muted-foreground text-xs mt-0.5">
                Expires:{' '}
                {activeSub.expires_at
                  ? new Date(activeSub.expires_at).toLocaleDateString()
                  : '—'}
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleCancel(activeSub.id)}
              disabled={cancelMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {(subscribeMutation.error ?? cancelMutation.error) && (
        <p className="text-destructive text-xs mx-5 mb-3">
          {(subscribeMutation.error ?? cancelMutation.error)?.message ?? 'An error occurred'}
        </p>
      )}
      {subscribeMutation.isSuccess && (
        <p className="text-success text-xs mx-5 mb-3">Plan activated successfully!</p>
      )}
      {cancelMutation.isSuccess && (
        <p className="text-success text-xs mx-5 mb-3">Subscription cancelled.</p>
      )}

      <div className="px-5 pb-4">
        <p className="text-muted-foreground text-xs mb-4">
          {activeSub ? 'Cancel current plan to switch' : 'Choose a plan to start trading automatically'}
        </p>
        {plans.map((plan) => {
          const isActive = activeSub?.plan === plan.plan
          const { color, icon: PlanIcon } = planConfig[plan.plan] ?? {
            color: '#a78bfa',
            icon: Zap,
          }
          return (
            <Card
              key={plan.plan}
              className="mb-4 p-5 transition-colors"
              style={{ borderColor: isActive ? color : undefined }}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <PlanIcon size={24} style={{ color }} />
                  <div>
                    <div className="text-foreground font-bold text-base">
                      {plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1)}
                    </div>
                    <div className="text-muted-foreground text-xs">{plan.description}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg" style={{ color }}>
                    ${plan.price}
                  </div>
                  <div className="text-muted-foreground text-xs">/month</div>
                </div>
              </div>

              <Card className="bg-secondary border-0 p-3 mb-4 text-xs text-muted-foreground space-y-1">
                <div>
                  • {plan.coins} concurrent token{plan.coins > 1 ? 's' : ''} (worker
                  {plan.coins > 1 ? 's' : ''})
                </div>
                <div>• DCA_MACD_DAILY strategy</div>
                <div>• Automated trading — no manual intervention</div>
              </Card>

              {isActive ? (
                <div
                  className="text-center font-semibold text-sm py-2"
                  style={{ color }}
                >
                  ✓ Current Plan
                </div>
              ) : (
                <button
                  onClick={() => !activeSub && handleBuy(plan.plan)}
                  disabled={!!activeSub || subscribeMutation.isPending}
                  className="w-full border-none rounded-xl text-white py-3 font-semibold text-sm cursor-pointer disabled:opacity-40"
                  style={{ background: `linear-gradient(135deg, ${color}99, ${color})` }}
                >
                  {subscribeMutation.isPending
                    ? 'Activating…'
                    : activeSub
                    ? 'Cancel current plan first'
                    : `Select ${plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1)}`}
                </button>
              )}
            </Card>
          )
        })}
      </div>

      {mySubs.filter((s) => s.status !== 'active').length > 0 && (
        <>
          <h2 className="text-foreground font-semibold text-sm px-5 mb-3">History</h2>
          {mySubs
            .filter((s) => s.status !== 'active')
            .map((sub) => (
              <Card key={sub.id} className="mx-5 mb-2.5 p-4 flex justify-between items-center">
                <div>
                  <div className="text-foreground font-semibold text-sm">
                    {sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)}
                  </div>
                  <div className="text-muted-foreground text-xs mt-0.5">
                    {sub.started_at ? new Date(sub.started_at).toLocaleDateString() : '—'}
                  </div>
                </div>
                <Badge variant="secondary">{sub.status}</Badge>
              </Card>
            ))}
        </>
      )}
    </div>
  )
}
