import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet, useTransactions, useDepositAddress } from '../hooks/useWallet'

export default function Wallets() {
  const navigate = useNavigate()
  const [showDeposit, setShowDeposit] = useState(false)
  const { data: wallet } = useWallet()
  const { data: txs = [] } = useTransactions()
  const { data: depositData } = useDepositAddress()
  const depositAddress = depositData?.address || ''

  const copyAddress = () => {
    navigator.clipboard.writeText(depositAddress).catch(() => {})
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <div className="flex items-center px-5 pt-5 pb-2 gap-3">
        <button className="bg-none border-none text-white text-2xl cursor-pointer" onClick={() => navigate(-1)}>←</button>
        <div className="text-white text-lg font-semibold">My Wallets</div>
      </div>

      <div className="mx-5 mt-4 mb-5 bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] rounded-[20px] p-7">
        <div className="text-[rgba(255,255,255,0.7)] text-xs mb-2">Total Balance</div>
        <div className="text-white text-4xl font-extrabold">{wallet ? Number(wallet.balance).toFixed(2) : '0.00'}</div>
        <div className="text-[rgba(255,255,255,0.8)] text-base mt-1">USDT</div>
      </div>

      <div className="flex gap-3 mx-5 mb-5">
        <button className="flex-1 bg-[#141414] border border-[#333] rounded-xl p-4 text-white cursor-pointer flex flex-col items-center gap-1.5 text-xs" onClick={() => setShowDeposit((v) => !v)}>
          <span className="text-2xl">📥</span>Deposit
        </button>
        <button className="flex-1 bg-[#141414] border border-[#333] rounded-xl p-4 text-white cursor-pointer flex flex-col items-center gap-1.5 text-xs">
          <span className="text-2xl">📤</span>Withdraw
        </button>
        <button className="flex-1 bg-[#141414] border border-[#333] rounded-xl p-4 text-white cursor-pointer flex flex-col items-center gap-1.5 text-xs">
          <span className="text-2xl">🔄</span>Convert
        </button>
      </div>

      {showDeposit && (
        <div className="mx-5 mb-4 bg-[#141414] rounded-xl p-4 border border-[#6c47ff]">
          <div className="text-[#aaa] text-xs mb-2">USDT Deposit Address (ERC-20)</div>
          <div className="text-white text-xs break-all mb-3">{depositAddress || 'Loading…'}</div>
          <button
            onClick={copyAddress}
            className="bg-[#6c47ff] border-none rounded-lg text-white px-4 py-2 cursor-pointer text-xs"
          >
            Copy Address
          </button>
        </div>
      )}

      <div className="text-white font-semibold text-base px-5 mb-3">Recent Transactions</div>
      {txs.length === 0 ? (
        <div className="text-center text-[#888] py-10 px-5">No transactions yet</div>
      ) : (
        txs.map((tx) => (
          <div key={tx.id} className="mx-5 mb-3 bg-[#141414] rounded-xl p-4 border border-[#222] flex justify-between items-center">
            <div>
              <div className="text-white font-semibold text-sm">{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</div>
              <div className="text-[#888] text-xs mt-1">{new Date(tx.created_at).toLocaleDateString()}</div>
            </div>
            <div className={`font-bold text-base ${tx.type === 'deposit' || tx.type === 'commission' ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
              {tx.type === 'deposit' || tx.type === 'commission' ? '+' : '-'}{Number(tx.amount).toFixed(2)} USDT
            </div>
          </div>
        ))
      )}
    </div>
  )
}
