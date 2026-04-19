import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlans, useMySubs, useSubscribe, useCancelSubscription } from '../hooks/useSubscriptions'
import { useStrategies } from '../hooks/useTrading'
import { useWallet } from '../hooks/useWallet'

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

  const planColors = { starter: '#34d399', trader: '#a78bfa', pro: '#fbbf24' }
  const planIcons = { starter: '🌱', trader: '⚡', pro: '👑' }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button className="bg-transparent border-none text-white text-2xl cursor-pointer" onClick={() => navigate(-1)}>←</button>
        <div className="text-white text-lg font-semibold">Subscription Plans</div>
      </div>

      {wallet && (
        <div className="mx-5 mb-4 bg-[#141414] border border-[#222] rounded-xl px-4 py-3 flex justify-between items-center">
          <div className="text-[#aaa] text-sm">Wallet Balance</div>
          <div className="text-white font-bold">${Number(wallet.balance).toFixed(2)} USDT</div>
        </div>
      )}

      {activeSub && (
        <div className="mx-5 mb-5 bg-[rgba(52,211,153,0.07)] border border-[#34d399] rounded-xl p-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[#34d399] font-bold text-sm">Active Plan: {activeSub.plan.charAt(0).toUpperCase() + activeSub.plan.slice(1)}</div>
              <div className="text-[#888] text-xs mt-1">Coins: {activeSub.coins?.join(', ') || '—'}</div>
              <div className="text-[#888] text-xs mt-0.5">Expires: {activeSub.expires_at ? new Date(activeSub.expires_at).toLocaleDateString() : '—'}</div>
            </div>
            <button
              onClick={() => handleCancel(activeSub.id)}
              disabled={cancelMutation.isPending}
              className="text-[#f87171] text-xs bg-transparent border border-[#f87171] rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {(subscribeMutation.error || cancelMutation.error) && (
        <div className="text-[#f87171] text-xs mx-5 mb-3">
          {(subscribeMutation.error || cancelMutation.error)?.response?.data?.detail || 'An error occurred'}
        </div>
      )}
      {subscribeMutation.isSuccess && (
        <div className="text-[#34d399] text-xs mx-5 mb-3">Plan activated successfully!</div>
      )}
      {cancelMutation.isSuccess && (
        <div className="text-[#34d399] text-xs mx-5 mb-3">Subscription cancelled.</div>
      )}

      {selectedPlan && (
        <div className="mx-5 mb-5 bg-[#141414] border border-[#6c47ff] rounded-xl p-5">
          <div className="text-white font-semibold text-sm mb-1">
            Select {selectedPlan.coins} coin{selectedPlan.coins > 1 ? 's' : ''} for {selectedPlan.plan.charAt(0).toUpperCase() + selectedPlan.plan.slice(1)}
          </div>
          <div className="text-[#888] text-xs mb-3">
            These are the tokens your worker will trade ({selectedCoins.length}/{selectedPlan.coins} selected)
          </div>
          {availableSymbols.length === 0 ? (
            <div className="text-[#555] text-xs">No strategies configured yet — contact admin.</div>
          ) : (
            <div className="flex flex-wrap gap-2 mb-4">
              {availableSymbols.map((sym) => {
                const sel = selectedCoins.includes(sym)
                return (
                  <button
                    key={sym}
                    onClick={() => toggleCoin(sym)}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold border cursor-pointer"
                    style={{
                      background: sel ? 'rgba(108,71,255,0.25)' : '#1e1e1e',
                      borderColor: sel ? '#6c47ff' : '#333',
                      color: sel ? '#a78bfa' : '#aaa',
                    }}
                  >
                    {sym}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { setSelectedPlan(null); setSelectedCoins([]) }}
              className="flex-1 bg-[#1e1e1e] border border-[#333] rounded-xl text-[#aaa] py-2.5 font-semibold text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleBuy}
              disabled={selectedCoins.length !== selectedPlan.coins || subscribeMutation.isPending}
              className="flex-1 bg-gradient-to-r from-[#6c47ff] to-[#a78bfa] border-none rounded-xl text-white py-2.5 font-semibold text-sm cursor-pointer disabled:opacity-40"
            >
              {subscribeMutation.isPending ? 'Activating…' : `Confirm — $${selectedPlan.price}/mo`}
            </button>
          </div>
        </div>
      )}

      <div className="px-5 pb-4">
        <div className="text-[#888] text-xs mb-4">
          {activeSub ? 'Cancel current plan to switch' : 'Choose a plan to start trading automatically'}
        </div>
        {plans.map((plan) => {
          const isActive = activeSub?.plan === plan.plan
          const color = planColors[plan.plan] || '#a78bfa'
          const icon = planIcons[plan.plan] || '💎'
          return (
            <div
              key={plan.plan}
              className="mb-4 rounded-[14px] p-5 border"
              style={{ background: '#141414', borderColor: isActive ? color : '#222' }}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <div className="text-white font-bold text-base">{plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1)}</div>
                    <div className="text-[#888] text-xs">{plan.description}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg" style={{ color }}>${plan.price}</div>
                  <div className="text-[#888] text-xs">/month</div>
                </div>
              </div>

              <div className="bg-[#1a1a1a] rounded-lg p-3 mb-4 text-xs text-[#aaa] space-y-1">
                <div>• {plan.coins} concurrent token{plan.coins > 1 ? 's' : ''} (worker{plan.coins > 1 ? 's' : ''})</div>
                <div>• DCA_MACD_DAILY strategy</div>
                <div>• Automated trading — no manual intervention</div>
              </div>

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
            </div>
          )
        })}
      </div>

      {mySubs.filter((s) => s.status !== 'active').length > 0 && (
        <>
          <div className="text-white font-semibold text-sm px-5 mb-3">History</div>
          {mySubs.filter((s) => s.status !== 'active').map((sub) => (
            <div key={sub.id} className="mx-5 mb-2.5 bg-[#141414] rounded-xl p-4 border border-[#222] flex justify-between items-center">
              <div>
                <div className="text-white font-semibold text-sm">{sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)}</div>
                <div className="text-[#888] text-xs mt-0.5">{sub.started_at ? new Date(sub.started_at).toLocaleDateString() : '—'}</div>
              </div>
              <span className="text-xs text-[#888] bg-[#1e1e1e] rounded-md px-2 py-1">{sub.status}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
