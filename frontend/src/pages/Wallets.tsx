import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Copy, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useDepositAddress, useTransactions, useWallet } from '../hooks/useWallet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function Wallets() {
  const navigate = useNavigate()
  const [showDeposit, setShowDeposit] = useState(false)
  const { data: wallet } = useWallet()
  const { data: txs = [] } = useTransactions()
  const { data: depositData } = useDepositAddress()
  const depositAddress = depositData?.address ?? ''

  const copyAddress = () => {
    navigator.clipboard.writeText(depositAddress).catch(() => {})
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="flex items-center px-5 pt-5 pb-2 gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-foreground text-lg font-semibold">My Wallets</h1>
      </div>

      <div className="mx-5 mt-4 mb-5 bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] rounded-[20px] p-7">
        <div className="text-white/70 text-xs mb-2">Total Balance</div>
        <div className="text-white text-4xl font-extrabold">
          {wallet ? Number(wallet.balance).toFixed(2) : '0.00'}
        </div>
        <div className="text-white/80 text-base mt-1">USDT</div>
      </div>

      <div className="flex gap-3 mx-5 mb-5">
        <Button
          variant="outline"
          className="flex-1 flex-col h-auto py-4 gap-1.5 text-xs"
          onClick={() => setShowDeposit((v) => !v)}
        >
          <ArrowDownToLine size={22} />
          Deposit
        </Button>
        <Button variant="outline" className="flex-1 flex-col h-auto py-4 gap-1.5 text-xs">
          <ArrowUpFromLine size={22} />
          Withdraw
        </Button>
        <Button variant="outline" className="flex-1 flex-col h-auto py-4 gap-1.5 text-xs">
          <RefreshCw size={22} />
          Convert
        </Button>
      </div>

      {showDeposit && (
        <Card className="mx-5 mb-4 p-4 border-[#6c47ff]">
          <p className="text-muted-foreground text-xs mb-2">USDT Deposit Address (ERC-20)</p>
          <p className="text-foreground text-xs break-all mb-3">{depositAddress || 'Loading…'}</p>
          <Button size="sm" onClick={copyAddress} className="gap-1.5">
            <Copy size={14} />
            Copy Address
          </Button>
        </Card>
      )}

      <h2 className="text-foreground font-semibold text-base px-5 mb-3">Recent Transactions</h2>
      {txs.length === 0 ? (
        <p className="text-center text-muted-foreground py-10 px-5">No transactions yet</p>
      ) : (
        txs.map((tx) => {
          const isCredit = tx.type === 'deposit' || tx.type === 'commission'
          return (
            <Card key={tx.id} className="mx-5 mb-3 p-4 flex justify-between items-center">
              <div>
                <div className="text-foreground font-semibold text-sm">
                  {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                </div>
                <div className="text-muted-foreground text-xs mt-1">
                  {new Date(tx.created_at).toLocaleDateString()}
                </div>
              </div>
              <span
                className={`font-bold text-base ${isCredit ? 'text-success' : 'text-destructive'}`}
              >
                {isCredit ? '+' : '-'}
                {Number(tx.amount).toFixed(2)} USDT
              </span>
            </Card>
          )
        })
      )}
    </div>
  )
}
