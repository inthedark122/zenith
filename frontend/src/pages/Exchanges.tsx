import { ArrowLeft, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { useAddExchange, useExchangeBalance, useExchanges, useRemoveExchange, useSupportedExchanges } from '../hooks/useExchanges'
import { AddExchangePayload, Exchange } from '../types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const UI_SUPPORTED_EXCHANGES = ['okx']

function ExchangeCard({ exc, onDelete, deleteDisabled }: {
  exc: Exchange
  onDelete: (id: string) => void
  deleteDisabled: boolean
}) {
  const { data: balanceData, isLoading: balanceLoading, refetch } = useExchangeBalance(exc.exchange_id)

  return (
    <Card className="mx-5 mb-3 p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="text-foreground font-bold text-sm flex items-center gap-2">
            {exc.exchange_id.toUpperCase()}
            {exc.is_default && (
              <Badge variant="default" className="text-[10px]">
                DEFAULT
              </Badge>
            )}
          </div>
          {exc.label && (
            <div className="text-muted-foreground text-xs mt-0.5">{exc.label}</div>
          )}
          <div className="text-muted-foreground text-xs mt-1">
            Key: ••••{exc.api_key?.slice(-4) ?? '••••'}
          </div>

          {/* Balance section */}
          <div className="mt-2 pt-2 border-t border-border">
            {balanceLoading ? (
              <div className="text-muted-foreground text-xs flex items-center gap-1.5">
                <RefreshCw size={10} className="animate-spin" />
                Loading balance…
              </div>
            ) : balanceData?.error ? (
              <div className="text-destructive text-xs">
                ⚠ {balanceData.error.length > 80 ? 'Invalid credentials or connection error' : balanceData.error}
              </div>
            ) : balanceData?.accounts && balanceData.accounts.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {balanceData.accounts.map((acc) => (
                  <div key={acc.label}>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wide">{acc.label}</div>
                    <div className="text-foreground text-sm font-semibold">
                      {acc.usdt_free.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                    </div>
                    {acc.usdt_total !== acc.usdt_free && (
                      <div className="text-muted-foreground text-[10px]">
                        Total: {acc.usdt_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => refetch()}
                  className="text-muted-foreground hover:text-foreground transition-colors self-end mb-0.5"
                  title="Refresh balance"
                >
                  <RefreshCw size={11} />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(exc.exchange_id)}
          disabled={deleteDisabled}
          className="ml-3 shrink-0"
        >
          <Trash2 size={14} />
          Remove
        </Button>
      </div>
    </Card>
  )
}

export default function Exchanges() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddExchangePayload>()

  const { data: exchanges = [] } = useExchanges()
  const { data: supportedData } = useSupportedExchanges()
  // Filter to UI-supported exchanges only (OKX)
  const supported = (supportedData?.exchanges ?? []).filter((id) =>
    UI_SUPPORTED_EXCHANGES.includes(id)
  )

  const addExchange = useAddExchange()
  const removeExchange = useRemoveExchange()

  const onSubmit = (data: AddExchangePayload) => {
    addExchange.mutate(data, {
      onSuccess: () => {
        setShowForm(false)
        reset()
      },
    })
  }

  const handleDelete = (exchangeId: string) => {
    if (!window.confirm(`Remove ${exchangeId}?`)) return
    removeExchange.mutate(exchangeId)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-foreground text-lg font-semibold">Exchange Connections</h1>
      </div>

      {removeExchange.error && (
        <p className="text-destructive text-xs mx-5 mb-3">
          {removeExchange.error.message ?? 'Failed to remove exchange'}
        </p>
      )}

      {exchanges.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 px-5 text-sm">
          No exchanges connected yet.
        </p>
      ) : (
        exchanges.map((exc) => (
          <ExchangeCard
            key={exc.exchange_id}
            exc={exc}
            onDelete={handleDelete}
            deleteDisabled={removeExchange.isPending}
          />
        ))
      )}

      {!showForm && (
        <div className="mx-5 mt-2">
          <Button size="lg" className="w-full" onClick={() => setShowForm(true)}>
            <Plus size={16} />
            Connect Exchange
          </Button>
        </div>
      )}

      {showForm && (
        <Card className="mx-5 mt-4 p-5">
          <h2 className="text-foreground font-semibold text-sm mb-4">Connect New Exchange</h2>

          {addExchange.error && (
            <p className="text-destructive text-xs mb-3">
              {addExchange.error.message ?? 'Failed to connect exchange'}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-3">
              <Label htmlFor="exchange_id">Exchange *</Label>
              <select
                id="exchange_id"
                className="flex h-10 w-full rounded-lg border border-border bg-input px-3.5 py-2 text-sm text-foreground outline-none appearance-none focus-visible:ring-2 focus-visible:ring-ring mt-1.5"
                {...register('exchange_id', { required: 'Select an exchange' })}
              >
                <option value="">Select exchange…</option>
                {supported.map((id) => (
                  <option key={id} value={id}>
                    {id.toUpperCase()}
                  </option>
                ))}
              </select>
              {errors.exchange_id && (
                <p className="text-destructive text-xs mt-1">{errors.exchange_id.message}</p>
              )}
            </div>

            <div className="mb-3">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                className="mt-1.5"
                placeholder="e.g. My OKX Account"
                {...register('label')}
              />
            </div>

            <div className="mb-3">
              <Label htmlFor="api_key">API Key *</Label>
              <Input
                id="api_key"
                className="mt-1.5"
                placeholder="API key"
                {...register('api_key', { required: 'API Key is required' })}
              />
              {errors.api_key && (
                <p className="text-destructive text-xs mt-1">{errors.api_key.message}</p>
              )}
            </div>

            <div className="mb-3">
              <Label htmlFor="api_secret">API Secret *</Label>
              <Input
                id="api_secret"
                type="password"
                className="mt-1.5"
                placeholder="API secret"
                {...register('api_secret', { required: 'API Secret is required' })}
              />
              {errors.api_secret && (
                <p className="text-destructive text-xs mt-1">{errors.api_secret.message}</p>
              )}
            </div>

            <div className="mb-4">
              <Label htmlFor="passphrase">Passphrase (if required)</Label>
              <Input
                id="passphrase"
                type="password"
                className="mt-1.5"
                placeholder="Passphrase (OKX)"
                {...register('passphrase')}
              />
            </div>

            <div className="flex gap-3 mt-1">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => {
                  setShowForm(false)
                  reset()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={addExchange.isPending} className="flex-1">
                {addExchange.isPending ? 'Connecting…' : 'Connect'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
