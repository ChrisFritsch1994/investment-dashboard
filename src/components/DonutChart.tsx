'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/format'

const COLORS = ['#84cc16', '#3b82f6', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899']

interface DonutEntry {
  name: string
  value: number
}

interface DonutChartProps {
  title: string
  data: DonutEntry[]
}

export default function DonutChart({ title, data }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const filtered = data.filter(d => d.value > 0)

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
        {title}
      </div>
      <div className="flex gap-4 items-center">
        <div className="w-40 h-40 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filtered}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {filtered.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [formatCurrency(Number(v)), '']}
                contentStyle={{
                  background: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f9fafb',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-2">
          {filtered.map((d, i) => {
            const pct = total > 0 ? (d.value / total) * 100 : 0
            return (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                    {d.name}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(d.value, 0)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {pct.toFixed(1)} %
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
