import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, Loader2, Search, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { useSymbols } from '@/hooks/useAdmin'
import { cn } from '@/lib/utils'

// ---- Supported exchange / market-type options ----

const EXCHANGES = ['okx', 'binance', 'bybit'] as const
const MARKET_TYPES = ['spot', 'swap'] as const

type Exchange = (typeof EXCHANGES)[number]
type MarketType = (typeof MARKET_TYPES)[number]

// ---- Props ----

interface SymbolPickerProps {
  value: string[]
  onChange: (symbols: string[]) => void
  className?: string
}

// ---- Component ----

export function SymbolPicker({ value, onChange, className }: SymbolPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [exchange, setExchange] = useState<Exchange>('okx')
  const [marketType, setMarketType] = useState<MarketType>('spot')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: allSymbols = [], isLoading, isError } = useSymbols(exchange, marketType)

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase()
    if (!q) return allSymbols.slice(0, 100) // cap initial list to 100
    return allSymbols.filter((s) => s.toUpperCase().includes(q)).slice(0, 100)
  }, [allSymbols, search])

  const toggle = (symbol: string) => {
    if (value.includes(symbol)) {
      onChange(value.filter((s) => s !== symbol))
    } else {
      onChange([...value, symbol])
    }
  }

  const remove = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter((s) => s !== symbol))
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* Trigger — selected chips + open button */}
      <Popover.Trigger asChild>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
          className={cn(
            'min-h-12 w-full rounded-2xl border border-border bg-input px-4 py-2 flex flex-wrap gap-1.5 items-center cursor-pointer',
            'focus-visible:ring-2 focus-visible:ring-ring/50 outline-none',
            'hover:border-[#333] transition-colors',
            className,
          )}
        >
          {value.length === 0 && (
            <span className="text-muted-foreground text-sm">Search symbols…</span>
          )}
          {value.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1 bg-[#1e1e2e] border border-[#6c47ff]/40 text-[#a78bfa] text-xs font-medium px-2 py-0.5 rounded-lg"
            >
              {s}
              <button
                type="button"
                onClick={(e) => remove(s, e)}
                className="text-[#a78bfa]/60 hover:text-[#a78bfa] transition-colors"
                aria-label={`Remove ${s}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <ChevronDown
            size={14}
            className={cn('ml-auto shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        </div>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-popover-trigger-width)] max-w-lg rounded-2xl border border-border bg-background shadow-xl outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            inputRef.current?.focus()
          }}
        >
          {/* Filters row */}
          <div className="flex gap-2 px-3 pt-3 pb-2 border-b border-border">
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as Exchange)}
              className="flex-1 bg-input text-foreground text-xs rounded-lg border border-border px-2 py-1.5 outline-none cursor-pointer"
            >
              {EXCHANGES.map((ex) => (
                <option key={ex} value={ex}>{ex.toUpperCase()}</option>
              ))}
            </select>
            <select
              value={marketType}
              onChange={(e) => setMarketType(e.target.value as MarketType)}
              className="flex-1 bg-input text-foreground text-xs rounded-lg border border-border px-2 py-1.5 outline-none cursor-pointer"
            >
              {MARKET_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative px-3 py-2 border-b border-border">
            <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbols…"
              className="w-full bg-input text-foreground text-sm pl-7 pr-3 py-1.5 rounded-lg border border-border outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Symbol list */}
          <div className="max-h-64 overflow-y-auto overscroll-contain py-1">
            {isLoading && (
              <div className="flex items-center gap-2 px-4 py-4 text-muted-foreground text-sm">
                <Loader2 size={14} className="animate-spin" />
                Loading symbols…
              </div>
            )}
            {isError && (
              <div className="px-4 py-4 text-destructive text-sm">
                Failed to load symbols. Check exchange connection.
              </div>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <div className="px-4 py-4 text-muted-foreground text-sm">No symbols found.</div>
            )}
            {filtered.map((sym) => {
              const selected = value.includes(sym)
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => toggle(sym)}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm flex items-center justify-between gap-2',
                    'hover:bg-input transition-colors',
                    selected && 'text-[#a78bfa]',
                    !selected && 'text-foreground',
                  )}
                >
                  <span>{sym}</span>
                  {selected && (
                    <span className="text-[10px] text-[#a78bfa] bg-[#6c47ff]/20 px-1.5 py-0.5 rounded-md shrink-0">
                      Added
                    </span>
                  )}
                </button>
              )
            })}
            {!isLoading && !isError && filtered.length === 100 && (
              <div className="px-4 py-2 text-muted-foreground text-[11px]">
                Showing first 100 results — type to narrow down
              </div>
            )}
          </div>

          {/* Footer */}
          {value.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-border">
              <span className="text-muted-foreground text-xs">{value.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-destructive hover:text-destructive/80 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
