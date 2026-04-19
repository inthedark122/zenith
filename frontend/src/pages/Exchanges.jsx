import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'

export default function Exchanges() {
  const navigate = useNavigate()
  const [exchanges, setExchanges] = useState([])
  const [supported, setSupported] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ exchange_id: '', label: '', api_key: '', api_secret: '', passphrase: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = () => {
    client.get('/exchanges').then((r) => setExchanges(r.data)).catch(() => {})
    client.get('/exchanges/supported').then((r) => setSupported(r.data.exchanges || [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.exchange_id || !form.api_key || !form.api_secret) {
      setError('Exchange, API Key and API Secret are required')
      return
    }
    setSaving(true)
    try {
      await client.post('/exchanges', form)
      setSuccess('Exchange connected successfully')
      setShowForm(false)
      setForm({ exchange_id: '', label: '', api_key: '', api_secret: '', passphrase: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to connect exchange')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (exchangeId) => {
    if (!window.confirm(`Remove ${exchangeId}?`)) return
    try {
      await client.delete(`/exchanges/${exchangeId}`)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove exchange')
    }
  }

  const inputClass = 'w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm outline-none mb-3'
  const labelClass = 'block text-[#aaa] text-xs mb-1'

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button className="bg-transparent border-none text-white text-2xl cursor-pointer" onClick={() => navigate(-1)}>←</button>
        <div className="text-white text-lg font-semibold">Exchange Connections</div>
      </div>

      {error && <div className="text-[#f87171] text-xs mx-5 mb-3">{error}</div>}
      {success && <div className="text-[#34d399] text-xs mx-5 mb-3">{success}</div>}

      {/* Connected exchanges */}
      {exchanges.length === 0 ? (
        <div className="text-center text-[#555] py-8 px-5 text-sm">No exchanges connected yet.</div>
      ) : (
        exchanges.map((exc) => (
          <div key={exc.exchange_id} className="mx-5 mb-3 bg-[#141414] rounded-xl p-4 border border-[#222]">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-white font-bold text-sm">
                  {exc.exchange_id.toUpperCase()}
                  {exc.is_default && (
                    <span className="ml-2 text-[10px] bg-[rgba(108,71,255,0.2)] text-[#a78bfa] rounded-md px-2 py-0.5 font-semibold">DEFAULT</span>
                  )}
                </div>
                {exc.label && <div className="text-[#888] text-xs mt-0.5">{exc.label}</div>}
                <div className="text-[#555] text-xs mt-1">Key: ••••{exc.api_key?.slice(-4) || '••••'}</div>
              </div>
              <button
                onClick={() => handleDelete(exc.exchange_id)}
                className="text-[#f87171] text-xs bg-[rgba(248,113,113,0.1)] border border-[#f87171] rounded-lg px-3 py-1.5 cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        ))
      )}

      {/* Add exchange button */}
      {!showForm && (
        <div className="mx-5 mt-2">
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-gradient-to-r from-[#6c47ff] to-[#a78bfa] border-none rounded-xl text-white py-3.5 font-semibold text-sm cursor-pointer"
          >
            + Connect Exchange
          </button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="mx-5 mt-4 bg-[#141414] rounded-xl p-5 border border-[#222]">
          <div className="text-white font-semibold text-sm mb-4">Connect New Exchange</div>

          <label className={labelClass}>Exchange *</label>
          <select
            className={inputClass + ' appearance-none'}
            value={form.exchange_id}
            onChange={(e) => setForm({ ...form, exchange_id: e.target.value })}
            required
          >
            <option value="">Select exchange…</option>
            {supported.map((id) => (
              <option key={id} value={id}>{id.toUpperCase()}</option>
            ))}
          </select>

          <label className={labelClass}>Label (optional)</label>
          <input className={inputClass} placeholder="e.g. My OKX Account" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />

          <label className={labelClass}>API Key *</label>
          <input className={inputClass} placeholder="API key" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} required />

          <label className={labelClass}>API Secret *</label>
          <input className={inputClass} type="password" placeholder="API secret" value={form.api_secret} onChange={(e) => setForm({ ...form, api_secret: e.target.value })} required />

          <label className={labelClass}>Passphrase (if required)</label>
          <input className={inputClass} type="password" placeholder="Passphrase (OKX)" value={form.passphrase} onChange={(e) => setForm({ ...form, passphrase: e.target.value })} />

          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setError('') }}
              className="flex-1 bg-[#1e1e1e] border border-[#333] rounded-xl text-[#aaa] py-3 font-semibold text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-[#6c47ff] to-[#a78bfa] border-none rounded-xl text-white py-3 font-semibold text-sm cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
