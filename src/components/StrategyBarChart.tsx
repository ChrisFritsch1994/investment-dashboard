'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/format'

interface BarEntry {
  name: string
  invested: number
  value: number
}

export default function StrategyBarChart({ data }: { data: BarEntry[] }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
        Investiert vs. Aktuell je Strategie
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => [formatCurrency(Number(v), 0), '']}
            contentStyle={{
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#f9fafb',
              fontSize: '12px',
            }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                {value === 'invested' ? 'Investiert' : 'Aktuell'}
              </span>
            )}
          />
          <Bar dataKey="invested" fill="#374151" radius={[4, 4, 0, 0]} name="invested" />
          <Bar dataKey="value" fill="#84cc16" radius={[4, 4, 0, 0]} name="value" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
