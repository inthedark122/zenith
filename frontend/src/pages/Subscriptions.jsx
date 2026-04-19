import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Leaf, Zap, Crown } from 'lucide-react'
import { usePlans, useMySubs, useSubscribe, useCancelSubscription } from '../hooks/useSubscriptions'
import { useStrategies } from '../hooks/useTrading'
import { useWallet } from '../hooks/useWallet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const planConfig = {
  starter: { color: '#34d399', icon: Leaf },
  trader: { color: '#a78bfa', icon: Zap },
  pro: { color: '#fbbf24', icon: Crown },
}

export default function Subscriptions() {
  const navigate = useNavigate()
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [selectedCoins, setSelectedCoins] = useState([])

  const { data: plans = [] } = usePlans()
  const { data: mySubs = [] } = useMySubs()
  const { data: wallet } = useWallet()
  const { data: strategies = [] } = useStrategies()
  const availableSymbols = [...new Set(strategies.flatMap((s) => s.symbols || []))]

  const subscribeMutation = useSubscribe()
  const cancelMutation = useCancelSubscription()

  const activeSub = mySubs.find((s) => s.status === 'active')

  const toggleCoin = (symbol) => {
    if (selectedCoins.includes(symbol)) {
      setSelectedCoins(selectedCoins.filter((c) => c !== symbol))
    } else if (selectedPlan && selectedCoins.length < selectedPlan.coins) {
      setSelectedCoins([...selectedCoins, symbol])
    }
  }

  const handleBuy = () => {
    if (!selectedPlan || selectedCoins.length !== selectedPlan.coins) return
    subscribeMutation.mutate(
      { plan: selectedPlan.plan, coins: selectedCoins },
      {
        onSuccess: () => {
          setSelectedPlan(null)
          setSelectedCoins([])
        },
      },
    )
  }

  const handleCancel = (subId) => {
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
              <div className="text-muted-foreground text-xs mt-1">Coins: {activeSub.coins?.join(', ') || '—'}</div>
              <div className="text-muted-foreground text-xs mt-0.5">
                Expires: {activeSub.expires_at ? new Date(activeSub.expires_at).toLocaleDateString() : '—'}
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

      {(subscribeMutation.error || cancelMutation.error) && (
        <p className="text-destructive text-xs mx-5 mb-3">
          {(subscribeMutation.error || cancelMutation.error)?.response?.data?.detail || 'An error occurred'}
        </p>
      )}
      {subscribeMutation.isSuccess && (
        <p className="text-success text-xs mx-5 mb-3">Plan activated successfully!</p>
      )}
      {cancelMutation.isSuccess && (
        <p className="text-success text-xs mx-5 mb-3">Subscription cancelled.</p>
      )}

      {selectedPlan && (
        <Card className="mx-5 mb-5 p-5 border-[#6c47ff]">
          <h2 className="text-foreground font-semibold text-sm mb-1">
            Select {selectedPlan.coins} coin{selectedPlan.coins > 1 ? 's' : ''} for {selectedPlan.plan.charAt(0).toUpperCase() + selectedPlan.plan.slice(1)}
          </h2>
          <p className="text-muted-foreground text-xs mb-3">
            These are the tokens your worker will trade ({selectedCoins.length}/{selectedPlan.coins} selected)
          </p>
          {availableSymbols.length === 0 ? (
            <p className="text-muted-foreground text-xs">No strategies configured yet — contact admin.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-4">
              {availableSymbols.map((sym) => {
                const sel = selectedCoins.includes(sym)
                return (
                  <button
                    key={sym}
                    onClick={() => toggleCoin(sym)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-semibold border cursor-pointer transition-colors',
                      sel
                        ? 'bg-[rgba(108,71,255,0.25)] border-[#6c47ff] text-[#a78bfa]'
                        : 'bg-input border-border text-muted-foreground hover:border-[#444]',
                    )}
                  >
                    {sym}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => { setSelectedPlan(null); setSelectedCoins([]) }}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={handleBuy}
              disabled={selectedCoins.length !== selectedPlan.coins || subscribeMutation.isPending}
            >
              {subscribeMutation.isPending ? 'Activating…' : `Confirm — $${selectedPlan.price}/mo`}
            </Button>
          </div>
        </Card>
      )}

      <div className="px-5 pb-4">
        <p className="text-muted-foreground text-xs mb-4">
          {activeSub ? 'Cancel current plan to switch' : 'Choose a plan to start trading automatically'}
        </p>
        {plans.map((plan) => {
          const isActive = activeSub?.plan === plan.plan
          const { color, icon: PlanIcon } = planConfig[plan.plan] || { color: '#a78bfa', icon: Zap }
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
                  <div className="font-bold text-lg" style={{ color }}>${plan.price}</div>
                  <div className="text-muted-foreground text-xs">/month</div>
                </div>
              </div>

              <Card className="bg-secondary border-0 p-3 mb-4 text-xs text-muted-foreground space-y-1">
                <div>• {plan.coins} concurrent token{plan.coins > 1 ? 's' : ''} (worker{plan.coins > 1 ? 's' : ''})</div>
                <div>• DCA_MACD_DAILY strategy</div>
                <div>• Automated trading — no manual intervention</div>
              </Card>

              {isActive ? (
                <div className="text-center font-semibold text-sm py-2" style={{ color }}>✓ Current Plan</div>
              ) : (
                <button
                  onClick={() => !activeSub && (setSelectedPlan(plan), setSelectedCoins([]))}
                  disabled={!!activeSub}
                  className="w-full border-none rounded-xl text-white py-3 font-semibold text-sm cursor-pointer disabled:opacity-40"
                  style={{ background: `linear-gradient(135deg, ${color}99, ${color})` }}
                >
                  {activeSub ? 'Cancel current plan first' : `Select ${plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1)}`}
                </button>
              )}
            </Card>
          )
        })}
      </div>

      {mySubs.filter((s) => s.status !== 'active').length > 0 && (
        <>
          <h2 className="text-foreground font-semibold text-sm px-5 mb-3">History</h2>
          {mySubs.filter((s) => s.status !== 'active').map((sub) => (
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
