import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'

export default function Subscriptions() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState([])
  const [mySubs, setMySubs] = useState([])
  const [wallet, setWallet] = useState(null)
  const [availableSymbols, setAvailableSymbols] = useState([])
  const [buying, setBuying] = useState('')
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [selectedCoins, setSelectedCoins] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = () => {
    client.get('/subscriptions/plans').then((r) => setPlans(r.data)).catch(() => {})
    client.get('/subscriptions/me').then((r) => setMySubs(r.data)).catch(() => {})
    client.get('/wallet').then((r) => setWallet(r.data)).catch(() => {})
    client.get('/trading/strategies')
      .then((r) => {
        const symbols = [...new Set(r.data.flatMap((s) => s.symbols || []))]
        setAvailableSymbols(symbols)
      })
      .catch(() => {})
  }

  useEffect(() => { load() }, [])

  const activeSub = mySubs.find((s) => s.status === 'active')

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan)
    setSelectedCoins([])
    setError('')
  }

  const toggleCoin = (symbol) => {
    if (selectedCoins.includes(symbol)) {
      setSelectedCoins(selectedCoins.filter((c) => c !== symbol))
    } else if (selectedCoins.length < selectedPlan.coins) {
      setSelectedCoins([...selectedCoins, symbol])
    }
  }

  const handleBuy = async () => {
    if (!selectedPlan) return
    if (selectedCoins.length !== selectedPlan.coins) {
      setError(`Please select exactly ${selectedPlan.coins} coin(s)`)
      return
    }
    setError('')
    setSuccess('')
    setBuying(selectedPlan.plan)
    try {
      await client.post('/subscriptions', { plan: selectedPlan.plan, coins: selectedCoins })
      setSuccess(`${selectedPlan.plan.charAt(0).toUpperCase() + selectedPlan.plan.slice(1)} plan activated!`)
      setSelectedPlan(null)
      setSelectedCoins([])
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to purchase subscription')
    } finally {
      setBuying('')
    }
  }

  const handleCancel = async (subId) => {
    if (!window.confirm('Cancel your subscription?')) return
    try {
      await client.delete(`/subscriptions/${subId}`)
      setSuccess('Subscription cancelled')
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to cancel subscription')
    }
  }

  const planColors = { starter: '#34d399', trader: '#a78bfa', pro: '#fbbf24' }
  const planIcons = { starter: '🌱', trader: '⚡', pro: '👑' }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button className="bg-transparent border-none text-white text-2xl cursor-pointer" onClick={() => navigate(-1)}>←</button>
        <div className="text-white text-lg font-semibold">Subscription Plans</div>
      </div>

      {/* Wallet balance */}
      {wallet && (
        <div className="mx-5 mb-4 bg-[#141414] border border-[#222] rounded-xl px-4 py-3 flex justify-between items-center">
          <div className="text-[#aaa] text-sm">Wallet Balance</div>
          <div className="text-white font-bold">${Number(wallet.balance).toFixed(2)} USDT</div>
        </div>
      )}

      {/* Active subscription */}
      {activeSub && (
        <div className="mx-5 mb-5 bg-[rgba(52,211,153,0.07)] border border-[#34d399] rounded-xl p-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[#34d399] font-bold text-sm">Active Plan: {activeSub.plan.charAt(0).toUpperCase() + activeSub.plan.slice(1)}</div>
              <div className="text-[#888] text-xs mt-1">
                Coins: {activeSub.coins?.join(', ') || '—'}
              </div>
              <div className="text-[#888] text-xs mt-0.5">
                Expires: {activeSub.expires_at ? new Date(activeSub.expires_at).toLocaleDateString() : '—'}
              </div>
            </div>
            <button
              onClick={() => handleCancel(activeSub.id)}
              className="text-[#f87171] text-xs bg-transparent border border-[#f87171] rounded-lg px-3 py-1.5 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-[#f87171] text-xs mx-5 mb-3">{error}</div>}
      {success && <div className="text-[#34d399] text-xs mx-5 mb-3">{success}</div>}

      {/* Coin selection modal */}
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
              onClick={() => { setSelectedPlan(null); setSelectedCoins([]); setError('') }}
              className="flex-1 bg-[#1e1e1e] border border-[#333] rounded-xl text-[#aaa] py-2.5 font-semibold text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleBuy}
              disabled={selectedCoins.length !== selectedPlan.coins || !!buying}
              className="flex-1 bg-gradient-to-r from-[#6c47ff] to-[#a78bfa] border-none rounded-xl text-white py-2.5 font-semibold text-sm cursor-pointer disabled:opacity-40"
            >
              {buying === selectedPlan.plan ? 'Activating…' : `Confirm — $${selectedPlan.price}/mo`}
            </button>
          </div>
        </div>
      )}

      {/* Plan cards */}
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
                  onClick={() => !activeSub && handleSelectPlan(plan)}
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

      {/* Subscription history */}
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

