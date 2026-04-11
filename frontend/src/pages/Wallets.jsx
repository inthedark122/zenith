import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'

const s = {
  page: { minHeight: '100vh', background: '#0a0a0a', paddingBottom: '80px' },
  header: { display: 'flex', alignItems: 'center', padding: '20px 20px 8px', gap: '12px' },
  back: { background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer' },
  headerTitle: { color: '#fff', fontSize: '18px', fontWeight: '600' },
  balanceCard: { margin: '16px 20px', background: 'linear-gradient(135deg, #6c47ff 0%, #a78bfa 100%)', borderRadius: '20px', padding: '28px 24px' },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginBottom: '8px' },
  balanceAmount: { fontSize: '36px', fontWeight: '800', color: '#fff' },
  balanceCurrency: { fontSize: '16px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' },
  actions: { display: 'flex', gap: '12px', margin: '20px 20px', justifyContent: 'center' },
  actionBtn: { flex: 1, background: '#141414', border: '1px solid #333', borderRadius: '12px', padding: '16px 8px', color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '13px' },
  actionIcon: { fontSize: '22px' },
  sectionTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', padding: '16px 20px 8px' },
  txCard: { margin: '0 20px 12px', background: '#141414', borderRadius: '12px', padding: '16px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  txType: { color: '#fff', fontWeight: '600', fontSize: '14px' },
  txDate: { color: '#888', fontSize: '12px', marginTop: '4px' },
  txAmount: (type) => ({ color: type === 'deposit' || type === 'commission' ? '#34d399' : '#f87171', fontWeight: '700', fontSize: '16px' }),
  empty: { textAlign: 'center', color: '#888', padding: '40px 20px' },
}

export default function Wallets() {
  const navigate = useNavigate()
  const [wallet, setWallet] = useState(null)
  const [txs, setTxs] = useState([])
  const [depositAddress, setDepositAddress] = useState('')
  const [showDeposit, setShowDeposit] = useState(false)

  useEffect(() => {
    client.get('/wallet').then((r) => setWallet(r.data)).catch(() => {})
    client.get('/wallet/transactions').then((r) => setTxs(r.data)).catch(() => {})
    client.get('/wallet/deposit-address').then((r) => setDepositAddress(r.data.address)).catch(() => {})
  }, [])

  const copyAddress = () => {
    navigator.clipboard.writeText(depositAddress).catch(() => {})
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>←</button>
        <div style={s.headerTitle}>My Wallets</div>
      </div>

      <div style={s.balanceCard}>
        <div style={s.balanceLabel}>Total Balance</div>
        <div style={s.balanceAmount}>{wallet ? Number(wallet.balance).toFixed(2) : '0.00'}</div>
        <div style={s.balanceCurrency}>USDT</div>
      </div>

      <div style={s.actions}>
        <button style={s.actionBtn} onClick={() => setShowDeposit((v) => !v)}>
          <div style={s.actionIcon}>📥</div>
          Deposit
        </button>
        <button style={s.actionBtn}>
          <div style={s.actionIcon}>📤</div>
          Withdraw
        </button>
        <button style={s.actionBtn}>
          <div style={s.actionIcon}>🔄</div>
          Convert
        </button>
      </div>

      {showDeposit && (
        <div style={{ margin: '0 20px 16px', background: '#141414', borderRadius: '12px', padding: '16px', border: '1px solid #6c47ff' }}>
          <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>USDT Deposit Address (TRC-20)</div>
          <div style={{ color: '#fff', wordBreak: 'break-all', fontSize: '13px', marginBottom: '10px' }}>
            {depositAddress || 'Loading…'}
          </div>
          <button
            onClick={copyAddress}
            style={{ background: '#6c47ff', border: 'none', borderRadius: '8px', color: '#fff', padding: '8px 16px', cursor: 'pointer', fontSize: '13px' }}
          >
            Copy Address
          </button>
        </div>
      )}

      <div style={s.sectionTitle}>Recent Transactions</div>
      {txs.length === 0 ? (
        <div style={s.empty}>No transactions yet</div>
      ) : (
        txs.map((tx) => (
          <div key={tx.id} style={s.txCard}>
            <div>
              <div style={s.txType}>{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</div>
              <div style={s.txDate}>{new Date(tx.created_at).toLocaleDateString()}</div>
            </div>
            <div style={s.txAmount(tx.type)}>
              {tx.type === 'deposit' || tx.type === 'commission' ? '+' : '-'}{Number(tx.amount).toFixed(2)} USDT
            </div>
          </div>
        ))
      )}
    </div>
  )
}
