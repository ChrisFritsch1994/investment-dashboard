'use client'

import { formatCurrency, formatPercent, formatNumber } from '@/lib/format'
import type { Position } from '@/lib/types'

const STRATEGY_COLORS: Record<string, string> = {
  'Basis': '#84cc16',
  'Saisonalitäten': '#3b82f6',
  'Aktien-Trading': '#f59e0b',
  'Krypto': '#a855f7',
}

export default function PositionsTable({ positions }: { positions: Position[] }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Offene Positionen
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Wertpapier', 'Strategie', 'Stück', 'Ø Kauf', 'Akt. Kurs', 'Limit', 'Stop-Limit', 'Investiert', 'Akt. Wert', 'G/V', 'G/V %'].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => {
              const isPos = (p.unrealizedPnL ?? 0) >= 0
              return (
                <tr
                  key={`${p.security.ticker}::${p.security.strategy}`}
                  style={{
                    borderBottom: i < positions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {p.security.ticker}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {p.security.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: `${STRATEGY_COLORS[p.security.strategy] ?? '#6b7280'}20`,
                        color: STRATEGY_COLORS[p.security.strategy] ?? '#6b7280',
                      }}
                    >
                      {p.security.strategy}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {formatNumber(p.shares, 4)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {formatCurrency(p.avgCost)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {p.currentPrice != null ? formatCurrency(p.currentPrice) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: p.limitPrice ? '#84cc16' : 'var(--text-muted)' }}>
                    {p.limitPrice ? formatCurrency(p.limitPrice) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: p.stopLimitPrice ? '#ef4444' : 'var(--text-muted)' }}>
                    {p.stopLimitPrice ? formatCurrency(p.stopLimitPrice) : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {formatCurrency(p.totalInvested, 0)}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {p.currentValue != null ? formatCurrency(p.currentValue, 0) : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: isPos ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {p.unrealizedPnL != null ? formatCurrency(p.unrealizedPnL) : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: isPos ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {p.unrealizedPnLPct != null ? formatPercent(p.unrealizedPnLPct) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {positions.length === 0 && (
          <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Keine offenen Positionen
          </div>
        )}
      </div>
    </div>
  )
}
