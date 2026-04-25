import { ArrowLeft, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { useAddExchange, useExchanges, useRemoveExchange, useRevalidateExchange, useSupportedExchanges } from '../hooks/useExchanges'
import { AddExchangePayload, Exchange } from '../types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const UI_SUPPORTED_EXCHANGES = ['okx']
const WORKER_IP = '35.198.209.195'

function StatusBadge({ status }: { status: Exchange['status'] }) {
  if (status === 'verified') {
    return <Badge variant="success" className="text-[10px]">✓ Verified</Badge>
  }
  if (status === 'invalid') {
    return <Badge variant="destructive" className="text-[10px]">✗ Invalid</Badge>
  }
  return <Badge variant="secondary" className="text-[10px]">⏳ Validating…</Badge>
}

function ExchangeCard({ exc, onDelete, deleteDisabled }: {
  exc: Exchange
  onDelete: (id: number) => void
  deleteDisabled: boolean
}) {
  const revalidate = useRevalidateExchange()
  const isRechecking = revalidate.isPending
  const hasCachedBalance = exc.status === 'verified' && exc.balance_usdt_free != null
  const updatedAt = exc.balance_updated_at
    ? new Date(exc.balance_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <Card className="mx-5 mb-3 p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="text-foreground font-bold text-sm flex items-center gap-2 flex-wrap">
            {exc.exchange_id.toUpperCase()}
            {exc.is_demo && (
              <Badge variant="warning" className="text-[10px]">DEMO</Badge>
            )}
            {exc.is_default && (
              <Badge variant="default" className="text-[10px]">DEFAULT</Badge>
            )}
            <StatusBadge status={exc.status} />
          </div>
          {exc.label && (
            <div className="text-muted-foreground text-xs mt-0.5">{exc.label}</div>
          )}
          <div className="text-muted-foreground text-xs mt-1">
            Key: ••••{exc.api_key?.slice(-4) ?? '••••'}
          </div>

          {/* Balance section */}
          <div className="mt-2 pt-2 border-t border-border">
            {exc.status === 'pending' && (
              <div className="text-muted-foreground text-xs">Awaiting validation from worker…</div>
            )}
            {exc.status === 'invalid' && (
              <div className="text-destructive text-xs">
                {exc.last_error
                  ? `⚠ ${exc.last_error}`
                  : `⚠ Validation failed — check credentials and ensure IP ${WORKER_IP} is whitelisted`
                }
              </div>
            )}
            {hasCachedBalance && (
              <div className="flex items-end gap-3">
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Trading</div>
                  <div className="text-foreground text-sm font-semibold">
                    {exc.balance_usdt_free!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                  </div>
                  {exc.balance_usdt_total != null && exc.balance_usdt_total !== exc.balance_usdt_free && (
                    <div className="text-muted-foreground text-[10px]">
                      Total: {exc.balance_usdt_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
                {updatedAt && (
                  <div className="text-muted-foreground text-[10px] mb-0.5">updated {updatedAt}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 ml-3 shrink-0">
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(exc.id)}
            disabled={deleteDisabled}
          >
            <Trash2 size={14} />
            Remove
          </Button>
          {exc.status !== 'pending' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => revalidate.mutate(exc.id)}
              disabled={isRechecking}
            >
              <RefreshCw size={14} className={isRechecking ? 'animate-spin' : ''} />
              {isRechecking ? 'Checking…' : 'Recheck'}
            </Button>
          )}
        </div>
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
    control,
    formState: { errors },
  } = useForm<AddExchangePayload>()

  const selectedExchangeId = useWatch({ control, name: 'exchange_id' })

  const { data: exchanges = [] } = useExchanges()
  const { data: supportedData } = useSupportedExchanges()
  const supported = (supportedData?.exchanges ?? []).filter((id) =>
    UI_SUPPORTED_EXCHANGES.includes(id)
  )

  const addExchange = useAddExchange()
  const removeExchange = useRemoveExchange()

  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  const onSubmit = (data: AddExchangePayload) => {
    addExchange.mutate(data, {
      onSuccess: () => {
        setShowForm(false)
        reset()
      },
    })
  }

  const handleDelete = (id: number) => {
    setDeleteTarget(id)
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
          <h2 className="text-foreground font-semibold text-sm mb-1">Connect New Exchange</h2>
          <p className="text-muted-foreground text-xs mb-4">
            Your API key must allow IP{' '}
            <span className="font-mono font-semibold text-foreground">{WORKER_IP}</span>
            {' '}(our trading server).
          </p>

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

            {selectedExchangeId === 'okx' && (
              <div className="mb-4 flex items-center gap-2">
                <input
                  id="is_demo"
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-primary"
                  {...register('is_demo')}
                />
                <Label htmlFor="is_demo" className="cursor-pointer">
                  Demo trading (paper money)
                </Label>
              </div>
            )}

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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove exchange?"
        message="This will disconnect the exchange and stop any active workers using it."
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={() => { if (deleteTarget != null) removeExchange.mutate(deleteTarget); setDeleteTarget(null) }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
