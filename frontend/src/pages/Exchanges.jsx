import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useExchanges, useSupportedExchanges, useAddExchange, useRemoveExchange } from '../hooks/useExchanges'

export default function Exchanges() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const { data: exchanges = [] } = useExchanges()
  const { data: supportedData } = useSupportedExchanges()
  const supported = supportedData?.exchanges || []

  const addExchange = useAddExchange()
  const removeExchange = useRemoveExchange()

  const onSubmit = (data) => {
    addExchange.mutate(data, {
      onSuccess: () => {
        setShowForm(false)
        reset()
      },
    })
  }

  const handleDelete = (exchangeId) => {
    if (!window.confirm(`Remove ${exchangeId}?`)) return
    removeExchange.mutate(exchangeId)
  }

  const inputClass = 'w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm outline-none mb-3'
  const labelClass = 'block text-[#aaa] text-xs mb-1'

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button className="bg-transparent border-none text-white text-2xl cursor-pointer" onClick={() => navigate(-1)}>←</button>
        <div className="text-white text-lg font-semibold">Exchange Connections</div>
      </div>

      {removeExchange.error && (
        <div className="text-[#f87171] text-xs mx-5 mb-3">
          {removeExchange.error.response?.data?.detail || 'Failed to remove exchange'}
        </div>
      )}

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
                disabled={removeExchange.isPending}
                className="text-[#f87171] text-xs bg-[rgba(248,113,113,0.1)] border border-[#f87171] rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ))
      )}

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

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="mx-5 mt-4 bg-[#141414] rounded-xl p-5 border border-[#222]">
          <div className="text-white font-semibold text-sm mb-4">Connect New Exchange</div>

          {addExchange.error && (
            <div className="text-[#f87171] text-xs mb-3">
              {addExchange.error.response?.data?.detail || 'Failed to connect exchange'}
            </div>
          )}

          <label className={labelClass}>Exchange *</label>
          <select
            className={inputClass + ' appearance-none'}
            {...register('exchange_id', { required: 'Select an exchange' })}
          >
            <option value="">Select exchange…</option>
            {supported.map((id) => (
              <option key={id} value={id}>{id.toUpperCase()}</option>
            ))}
          </select>
          {errors.exchange_id && <div className="text-[#f87171] text-xs -mt-2 mb-2">{errors.exchange_id.message}</div>}

          <label className={labelClass}>Label (optional)</label>
          <input className={inputClass} placeholder="e.g. My OKX Account" {...register('label')} />

          <label className={labelClass}>API Key *</label>
          <input className={inputClass} placeholder="API key" {...register('api_key', { required: 'API Key is required' })} />
          {errors.api_key && <div className="text-[#f87171] text-xs -mt-2 mb-2">{errors.api_key.message}</div>}

          <label className={labelClass}>API Secret *</label>
          <input className={inputClass} type="password" placeholder="API secret" {...register('api_secret', { required: 'API Secret is required' })} />
          {errors.api_secret && <div className="text-[#f87171] text-xs -mt-2 mb-2">{errors.api_secret.message}</div>}

          <label className={labelClass}>Passphrase (if required)</label>
          <input className={inputClass} type="password" placeholder="Passphrase (OKX)" {...register('passphrase')} />

          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); reset() }}
              className="flex-1 bg-[#1e1e1e] border border-[#333] rounded-xl text-[#aaa] py-3 font-semibold text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addExchange.isPending}
              className="flex-1 bg-gradient-to-r from-[#6c47ff] to-[#a78bfa] border-none rounded-xl text-white py-3 font-semibold text-sm cursor-pointer disabled:opacity-50"
            >
              {addExchange.isPending ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
