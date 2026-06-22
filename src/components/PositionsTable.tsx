'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { formatCurrency, formatPercent, formatNumber } from '@/lib/format'
import ExportButton from '@/components/ExportButton'
import type { Position } from '@/lib/types'

const STRATEGY_COLORS: Record<string, string> = {
  'Basis': '#84cc16',
  'Saisonalitäten': '#3b82f6',
  'Aktien-Trading': '#f59e0b',
  'Krypto': '#a855f7',
}

type SortKey = 'ticker' | 'strategy' | 'shares' | 'avgCost' | 'currentPrice' | 'totalInvested' | 'currentValue' | 'unrealizedPnL' | 'unrealizedPnLPct'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} style={{ opacity: 0.3 }} />
  return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
}

export default function PositionsTable({ positions }: { positions: Position[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('currentValue')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = useMemo(() => {
    return [...positions].sort((a, b) => {
      let va: string | number = 0, vb: string | number = 0
      if (sortKey === 'ticker') { va = a.security.ticker; vb = b.security.ticker }
      else if (sortKey === 'strategy') { va = a.security.strategy; vb = b.security.strategy }
      else if (sortKey === 'shares') { va = a.shares; vb = b.shares }
      else if (sortKey === 'avgCost') { va = a.avgCost; vb = b.avgCost }
      else if (sortKey === 'currentPrice') { va = a.currentPrice ?? 0; vb = b.currentPrice ?? 0 }
      else if (sortKey === 'totalInvested') { va = a.totalInvested; vb = b.totalInvested }
      else if (sortKey === 'currentValue') { va = a.currentValue ?? 0; vb = b.currentValue ?? 0 }
      else if (sortKey === 'unrealizedPnL') { va = a.unrealizedPnL ?? 0; vb = b.unrealizedPnL ?? 0 }
      else if (sortKey === 'unrealizedPnLPct') { va = a.unrealizedPnLPct ?? 0; vb = b.unrealizedPnLPct ?? 0 }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [positions, sortKey, sortDir])

  const exportHeaders = ['Ticker', 'Name', 'Strategie', 'Stück', 'Ø Kauf', 'Akt. Kurs', 'Limit', 'Stop-Limit', 'Investiert', 'Akt. Wert', 'G/V', 'G/V %']
  const exportRows = sorted.map(p => [
    p.security.ticker, p.security.name, p.security.strategy,
    p.shares, p.avgCost, p.currentPrice ?? '',
    p.limitPrice ?? '', p.stopLimitPrice ?? '',
    p.totalInvested, p.currentValue ?? '', p.unrealizedPnL ?? '', p.unrealizedPnLPct ?? '',
  ])

  const thClass = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none"

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Offene Positionen</h3>
        <ExportButton filename="positionen" headers={exportHeaders} rows={exportRows} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {([
                ['Wertpapier', 'ticker'], ['Strategie', 'strategy'], ['Stück', 'shares'],
                ['Ø Kauf', 'avgCost'], ['Akt. Kurs', 'currentPrice'],
              ] as [string, SortKey][]).map(([label, key]) => (
                <th key={key} className={thClass} style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort(key)}>
                  <div className="flex items-center gap-1">{label}<SortIcon col={key} sortKey={sortKey} sortDir={sortDir} /></div>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Limit</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Stop-Limit</th>
              {([
                ['Investiert', 'totalInvested'], ['Akt. Wert', 'currentValue'],
                ['G/V', 'unrealizedPnL'], ['G/V %', 'unrealizedPnLPct'],
              ] as [string, SortKey][]).map(([label, key]) => (
                <th key={key} className={thClass} style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort(key)}>
                  <div className="flex items-center gap-1">{label}<SortIcon col={key} sortKey={sortKey} sortDir={sortDir} /></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const isPos = (p.unrealizedPnL ?? 0) >= 0
              return (
                <tr key={`${p.security.ticker}::${p.security.strategy}`}
                  style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                  className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.security.ticker}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.security.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${STRATEGY_COLORS[p.security.strategy] ?? '#6b7280'}20`, color: STRATEGY_COLORS[p.security.strategy] ?? '#6b7280' }}>
                      {p.security.strategy}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatNumber(p.shares, 4)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(p.avgCost)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.currentPrice != null ? formatCurrency(p.currentPrice) : '—'}</td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: p.limitPrice ? '#84cc16' : 'var(--text-muted)' }}>
                    {p.limitPrice ? formatCurrency(p.limitPrice) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: p.stopLimitPrice ? '#ef4444' : 'var(--text-muted)' }}>
                    {p.stopLimitPrice ? formatCurrency(p.stopLimitPrice) : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(p.totalInvested, 0)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{p.currentValue != null ? formatCurrency(p.currentValue, 0) : '—'}</td>
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
          <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Keine offenen Positionen</div>
        )}
      </div>
    </div>
  )
}
