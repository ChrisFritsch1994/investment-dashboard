'use client'

import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface ChartPoint {
  date: string
  portfolio?: number
  msci?: number
}

interface Props {
  portfolioSeries: { date: string; value: number }[]
  msciSeries: { date: string; value: number }[]
}

function fmtAxisDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg p-3 text-xs shadow-xl"
      style={{ background: '#111827', border: '1px solid #1f2937' }}
    >
      <div className="mb-2 font-medium" style={{ color: '#6b7280' }}>
        {new Date(label).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span style={{ color: p.color }}>●</span>
            <span style={{ color: '#9ca3af' }}>{p.name}</span>
          </span>
          <span className="font-semibold tabular-nums" style={{ color: p.color }}>
            {p.value != null ? `${p.value.toFixed(1)}` : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function PerformanceChart({ portfolioSeries, msciSeries }: Props) {
  const data = useMemo((): ChartPoint[] => {
    const byDate = new Map<string, ChartPoint>()
    for (const p of portfolioSeries) byDate.set(p.date, { date: p.date, portfolio: p.value })
    for (const p of msciSeries) {
      const existing = byDate.get(p.date) ?? { date: p.date }
      byDate.set(p.date, { ...existing, msci: p.value })
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [portfolioSeries, msciSeries])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm" style={{ color: '#4b5563' }}>
        Verlaufsdaten werden geladen…
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtAxisDate}
          tick={{ fill: '#4b5563', fontSize: 11 }}
          axisLine={{ stroke: '#1f2937' }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={60}
        />
        <YAxis
          tick={{ fill: '#4b5563', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v.toFixed(0)}`}
          domain={['auto', 'auto']}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
          formatter={(value: string) => <span style={{ color: '#9ca3af' }}>{value}</span>}
        />
        <ReferenceLine y={100} stroke="#374151" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="portfolio"
          name="Mein Portfolio"
          stroke="#84cc16"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="msci"
          name="MSCI World (EUNL.DE)"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
