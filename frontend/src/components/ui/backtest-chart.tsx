import { YAxisPosition, dispose, init, LineType, TooltipShowRule } from 'klinecharts'
import { useEffect, useRef } from 'react'

import { OhlcvCandle, StrategyBacktestOrder } from '@/types'

// Dark theme matching the app palette
const CHART_STYLES = {
  grid: {
    show: true,
    horizontal: { show: true, size: 1, color: 'rgba(255,255,255,0.04)', style: LineType.Dashed, dashedValue: [4, 4] },
    vertical: { show: false },
  },
  candle: {
    bar: {
      upColor: '#4ade80',
      upBorderColor: '#4ade80',
      upWickColor: '#4ade80',
      downColor: '#f87171',
      downBorderColor: '#f87171',
      downWickColor: '#f87171',
      noChangeColor: '#666',
      noChangeBorderColor: '#666',
      noChangeWickColor: '#666',
    },
    tooltip: {
      showRule: TooltipShowRule.FollowCross,
      text: { color: '#a0a0a0', size: 11 },
    },
    priceMark: {
      show: true,
      high: { show: false },
      low: { show: false },
      last: {
        show: true,
        upColor: '#4ade80',
        downColor: '#f87171',
        noChangeColor: '#666',
        line: { show: true, style: LineType.Dashed, dashedValue: [4, 4], size: 1 },
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
    position: YAxisPosition.Right,
    axisLine: { show: false },
    tickLine: { show: false },
    tickText: { show: true, color: '#555', size: 11, family: 'inherit', weight: 'normal' },
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: { show: true, style: LineType.Dashed, dashedValue: [4, 4], size: 1, color: 'rgba(255,255,255,0.15)' },
      text: { show: true, size: 11, color: '#a0a0a0', paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2, backgroundColor: '#1e1e1e' },
    },
    vertical: {
      show: true,
      line: { show: true, style: LineType.Dashed, dashedValue: [4, 4], size: 1, color: 'rgba(255,255,255,0.15)' },
      text: { show: true, size: 11, color: '#a0a0a0', paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2, backgroundColor: '#1e1e1e' },
    },
  },
}

interface BacktestChartProps {
  candles: OhlcvCandle[]
  orders: StrategyBacktestOrder[]
  symbol: string
  height?: number
}

export function BacktestChart({ candles, orders, symbol, height = 420 }: BacktestChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return

    const chart = init(containerRef.current)
    if (!chart) return

    chart.setStyles(CHART_STYLES)
    chart.applyNewData(candles)

    const symbolOrders = orders.filter((o) => o.symbol === symbol)

    for (const order of symbolOrders) {
      const entryTs = new Date(order.opened_at).getTime()
      const exitTs = new Date(order.closed_at).getTime()
      const isWin = order.status === 'win'
      const exitColor = isWin ? '#4ade80' : '#f87171'
      const closeLabel = order.close_reason === 'take_profit' ? 'TP' : order.close_reason === 'stop_loss' ? 'SL' : 'FC'

      // Entry arrow (green upward annotation)
      chart.createOverlay({
        name: 'simpleAnnotation',
        lock: true,
        points: [{ timestamp: entryTs, value: order.entry_price }],
        extendData: 'BUY',
        styles: {
          line: { color: '#4ade80', size: 1, style: LineType.Dashed, dashedValue: [3, 3] },
          text: { color: '#4ade80', size: 10 },
        },
      })

      // TP horizontal dashed line
      chart.createOverlay({
        name: 'horizontalSegment',
        lock: true,
        points: [
          { timestamp: entryTs, value: order.take_profit_price },
          { timestamp: exitTs, value: order.take_profit_price },
        ],
        styles: {
          line: { color: 'rgba(74,222,128,0.5)', size: 1, style: LineType.Dashed, dashedValue: [4, 4] },
          point: { color: 'transparent', borderColor: 'transparent', radius: 0, activeRadius: 0 },
        },
      })

      // SL horizontal dashed line
      chart.createOverlay({
        name: 'horizontalSegment',
        lock: true,
        points: [
          { timestamp: entryTs, value: order.stop_loss_price },
          { timestamp: exitTs, value: order.stop_loss_price },
        ],
        styles: {
          line: { color: 'rgba(248,113,113,0.5)', size: 1, style: LineType.Dashed, dashedValue: [4, 4] },
          point: { color: 'transparent', borderColor: 'transparent', radius: 0, activeRadius: 0 },
        },
      })

      // Exit annotation
      chart.createOverlay({
        name: 'simpleAnnotation',
        lock: true,
        points: [{ timestamp: exitTs, value: order.exit_price }],
        extendData: closeLabel,
        styles: {
          line: { color: exitColor, size: 1, style: LineType.Dashed, dashedValue: [3, 3] },
          text: { color: exitColor, size: 10 },
        },
      })
    }

    // Resize observer
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      if (containerRef.current) dispose(containerRef.current)
    }
  }, [candles, orders, symbol])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: `${height}px`, background: '#111' }}
      className="rounded-lg overflow-hidden"
    />
  )
}
