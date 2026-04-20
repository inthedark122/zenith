import { Chart, KLineData, Period, dispose, init, registerOverlay } from 'klinecharts'
import { useEffect, useRef, useState } from 'react'

import { adminApi } from '@/api/admin'
import { StrategyBacktestOrder } from '@/types'

// ---- Custom triangle overlays (registered once) ----

interface BuyOverlayData { price: number; amount: number }
interface ExitOverlayData { price: number; pnl: number; color: string }

function fmtPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (p >= 1) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return p.toPrecision(4)
}

function fmtUsd(v: number): string {
  const abs = Math.abs(v)
  const prefix = v < 0 ? '-$' : '$'
  return prefix + abs.toFixed(2)
}

let _overlaysRegistered = false
function ensureOverlays() {
  if (_overlaysRegistered) return
  _overlaysRegistered = true

  // Green ▲ — apex at price, base below; shows price + amount below base
  registerOverlay<BuyOverlayData>({
    name: 'buyTriangle',
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates }) => {
      const { x, y } = coordinates[0]
      const s = 7
      const baseY = y + s * 1.7
      const d = overlay.extendData as BuyOverlayData | undefined
      const figs: object[] = [
        {
          type: 'polygon',
          attrs: { coordinates: [{ x, y }, { x: x - s, y: baseY }, { x: x + s, y: baseY }] },
          styles: { style: 'fill', color: '#4ade80', borderColor: '#4ade80', borderSize: 0 },
          ignoreEvent: true,
        },
      ]
      if (d) {
        figs.push(
          { type: 'text', attrs: { x, y: baseY + 4, text: fmtPrice(d.price), align: 'center', baseline: 'top' }, styles: { color: '#4ade80', size: 10, family: 'inherit', weight: 'normal' }, ignoreEvent: true },
          { type: 'text', attrs: { x, y: baseY + 16, text: fmtUsd(d.amount), align: 'center', baseline: 'top' }, styles: { color: 'rgba(74,222,128,0.65)', size: 10, family: 'inherit', weight: 'normal' }, ignoreEvent: true },
        )
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return figs as any
    },
  })

  // ▼ — apex at price, base above; shows price + pnl below apex; color via extendData
  registerOverlay<ExitOverlayData>({
    name: 'exitTriangle',
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates }) => {
      const { x, y } = coordinates[0]
      const s = 7
      const d = overlay.extendData as ExitOverlayData | undefined
      const color = d?.color ?? '#f87171'
      const pnlColor = (d?.pnl ?? 0) >= 0 ? 'rgba(74,222,128,0.65)' : 'rgba(248,113,113,0.65)'
      const figs: object[] = [
        {
          type: 'polygon',
          attrs: { coordinates: [{ x, y }, { x: x - s, y: y - s * 1.7 }, { x: x + s, y: y - s * 1.7 }] },
          styles: { style: 'fill', color, borderColor: color, borderSize: 0 },
          ignoreEvent: true,
        },
      ]
      if (d) {
        figs.push(
          { type: 'text', attrs: { x, y: y + 4, text: fmtPrice(d.price), align: 'center', baseline: 'top' }, styles: { color, size: 10, family: 'inherit', weight: 'normal' }, ignoreEvent: true },
          { type: 'text', attrs: { x, y: y + 16, text: fmtUsd(d.pnl), align: 'center', baseline: 'top' }, styles: { color: pnlColor, size: 10, family: 'inherit', weight: 'normal' }, ignoreEvent: true },
        )
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return figs as any
    },
  })
}

// ---- Timeframe helpers ----

type TF = '1d' | '4h' | '1h' | '30m' | '15m'

const TIMEFRAMES: { value: TF; label: string }[] = [
  { value: '1d', label: '1D' },
  { value: '4h', label: '4H' },
  { value: '1h', label: '1H' },
  { value: '30m', label: '30M' },
  { value: '15m', label: '15M' },
]

function parsePeriod(tf: TF): Period {
  const map: Record<TF, Period> = {
    '1d': { type: 'day', span: 1 },
    '4h': { type: 'hour', span: 4 },
    '1h': { type: 'hour', span: 1 },
    '30m': { type: 'minute', span: 30 },
    '15m': { type: 'minute', span: 15 },
  }
  return map[tf]
}

function periodToTF(period: Period): TF {
  if (period.type === 'day') return `${period.span}d` as TF
  if (period.type === 'hour') return `${period.span}h` as TF
  if (period.type === 'minute') return `${period.span}m` as TF
  return '1d'
}

const PAGE_SIZE = 300

// ---- Dark chart styles ----

const CHART_STYLES = {
  grid: {
    show: true,
    horizontal: { show: true, size: 1, color: 'rgba(255,255,255,0.04)', style: 'dashed' as const, dashedValue: [4, 4] },
    vertical: { show: false },
  },
  candle: {
    bar: {
      upColor: '#4ade80', upBorderColor: '#4ade80', upWickColor: '#4ade80',
      downColor: '#f87171', downBorderColor: '#f87171', downWickColor: '#f87171',
      noChangeColor: '#666', noChangeBorderColor: '#666', noChangeWickColor: '#666',
    },
    tooltip: {
      showRule: 'follow_cross' as const,
      text: { color: '#a0a0a0', size: 11 },
    },
    priceMark: {
      show: true,
      high: { show: false },
      low: { show: false },
      last: {
        show: true,
        upColor: '#4ade80', downColor: '#f87171', noChangeColor: '#666',
        line: { show: true, style: 'dashed' as const, dashedValue: [4, 4], size: 1 },
        text: { show: true, size: 11, color: '#a0a0a0', paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
      },
    },
  },
  xAxis: {
    show: true,
    axisLine: { show: true, color: 'rgba(255,255,255,0.08)', size: 1 },
    tickLine: { show: true, color: 'rgba(255,255,255,0.08)', size: 1, length: 4 },
    tickText: { show: true, color: '#555', size: 11, family: 'inherit', weight: 'normal' },
  },
  yAxis: {
    show: true,
    position: 'right' as const,
    axisLine: { show: false },
    tickLine: { show: false },
    tickText: { show: true, color: '#555', size: 11, family: 'inherit', weight: 'normal' },
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: { show: true, style: 'dashed' as const, dashedValue: [4, 4], size: 1, color: 'rgba(255,255,255,0.15)' },
      text: { show: true, size: 11, color: '#a0a0a0', paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2, backgroundColor: '#1e1e1e' },
    },
    vertical: {
      show: true,
      line: { show: true, style: 'dashed' as const, dashedValue: [4, 4], size: 1, color: 'rgba(255,255,255,0.15)' },
      text: { show: true, size: 11, color: '#a0a0a0', paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2, backgroundColor: '#1e1e1e' },
    },
  },
}

// ---- Overlay helpers ----

function addOrderOverlays(chart: Chart, orders: StrategyBacktestOrder[], symbol: string) {
  const symbolOrders = orders.filter((o) => o.symbol === symbol)
  for (const order of symbolOrders) {
    const entryTs = new Date(order.opened_at).getTime()
    const exitTs = new Date(order.closed_at).getTime()
    const exitColor = order.status === 'win' ? '#4ade80' : '#f87171'

    chart.createOverlay({ name: 'buyTriangle', lock: true, points: [{ timestamp: entryTs, value: order.entry_price }], extendData: { price: order.entry_price, amount: order.margin_per_trade } as BuyOverlayData })

    chart.createOverlay({
      name: 'horizontalSegment',
      lock: true,
      points: [{ timestamp: entryTs, value: order.take_profit_price }, { timestamp: exitTs, value: order.take_profit_price }],
      styles: { line: { color: 'rgba(74,222,128,0.45)', size: 1, style: 'dashed', dashedValue: [4, 4] }, point: { color: 'transparent', borderColor: 'transparent', radius: 0, activeRadius: 0 } },
    })

    chart.createOverlay({
      name: 'horizontalSegment',
      lock: true,
      points: [{ timestamp: entryTs, value: order.stop_loss_price }, { timestamp: exitTs, value: order.stop_loss_price }],
      styles: { line: { color: 'rgba(248,113,113,0.45)', size: 1, style: 'dashed', dashedValue: [4, 4] }, point: { color: 'transparent', borderColor: 'transparent', radius: 0, activeRadius: 0 } },
    })

    chart.createOverlay({ name: 'exitTriangle', lock: true, points: [{ timestamp: exitTs, value: order.exit_price }], extendData: { price: order.exit_price, pnl: order.pnl_usd, color: exitColor } as ExitOverlayData })
  }
}

// ---- Component ----

interface BacktestChartProps {
  backtestId: number
  symbol: string
  orders: StrategyBacktestOrder[]
  height?: number
}

export function BacktestChart({ backtestId, symbol, orders, height = 420 }: BacktestChartProps) {
  ensureOverlays()

  const [timeframe, setTimeframe] = useState<TF>('1d')
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)

  // Init chart — re-run when backtestId or symbol changes
  useEffect(() => {
    if (!containerRef.current) return

    const chart = init(containerRef.current)
    if (!chart) return
    chartRef.current = chart

    chart.setStyles(CHART_STYLES)

    // setDataLoader must be registered before setSymbol/setPeriod so the
    // initial load fires correctly when setPeriod triggers _processDataLoad.
    chart.setDataLoader({
      getBars: async ({ type, timestamp, period, callback }) => {
        const tf = periodToTF(period)
        // 'forward' = user scrolled left → load candles BEFORE the oldest visible timestamp
        const before = type === 'forward' && timestamp != null ? timestamp : undefined
        try {
          const candles = await adminApi.getBacktestCandles(backtestId, symbol, tf, before)
          callback(candles as KLineData[], { forward: candles.length >= PAGE_SIZE })
        } catch {
          callback([], { forward: false })
        }
      },
    })

    chart.setSymbol({ ticker: symbol, pricePrecision: 2, volumePrecision: 6 })
    chart.setPeriod(parsePeriod(timeframe))

    addOrderOverlays(chart, orders, symbol)

    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(containerRef.current!)

    return () => {
      ro.disconnect()
      if (containerRef.current) dispose(containerRef.current)
      chartRef.current = null
    }
  }, [backtestId, symbol]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update period when timeframe toggle changes
  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.setPeriod(parsePeriod(timeframe))
  }, [timeframe])

  return (
    <div className="space-y-3">
      {/* Timeframe switcher */}
      <div className="flex items-center gap-1.5">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setTimeframe(tf.value)}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer border ${
              timeframe === tf.value
                ? 'border-[#6c47ff] bg-[#6c47ff]/20 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-[#333]'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Chart canvas */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: `${height}px`, background: '#111' }}
        className="rounded-lg overflow-hidden"
      />

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,0 0,10 10,10" fill="#4ade80"/></svg>
          BUY entry
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="2" viewBox="0 0 14 2"><line x1="0" y1="1" x2="14" y2="1" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="3,2"/></svg>
          Take profit
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="2" viewBox="0 0 14 2"><line x1="0" y1="1" x2="14" y2="1" stroke="#f87171" strokeWidth="1.5" strokeDasharray="3,2"/></svg>
          Stop loss
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,10 0,0 10,0" fill="#4ade80"/></svg>
          Exit (win)
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,10 0,0 10,0" fill="#f87171"/></svg>
          Exit (loss)
        </span>
      </div>
    </div>
  )
}

