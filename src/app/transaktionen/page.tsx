'use client'

import { useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { usePortfolio } from '@/hooks/usePortfolio'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'
import TransactionForm from '@/components/TransactionForm'
import type { Transaction } from '@/lib/types'

const STRATEGY_COLORS: Record<string, string> = {
  'Basis': '#84cc16',
  'Saisonalitäten': '#3b82f6',
  'Aktien-Trading': '#f59e0b',
  'Krypto': '#a855f7',
}

export default function TransaktionenPage() {
  const { transactions, securities, loading, error, reload } = usePortfolio()
  const [showForm, setShowForm] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [filterStrategy, setFilterStrategy] = useState<string>('alle')
  const [filterType, setFilterType] = useState<string>('alle')

  const filtered = transactions.filter(tx => {
    if (filterStrategy !== 'alle' && tx.strategy !== filterStrategy) return false
    if (filterType !== 'alle' && tx.type !== filterType) return false
    return true
  }).slice().reverse()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Lade…</div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Transaktionen</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {transactions.length} Buchungen gesamt
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--accent-green)', color: '#0a0a0a' }}
        >
          <Plus size={16} />
          Neue Transaktion
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        {(['alle', 'Basis', 'Saisonalitäten', 'Aktien-Trading', 'Krypto'] as const).map(s => (
          <button key={s} onClick={() => setFilterStrategy(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: filterStrategy === s ? 'rgba(132,204,22,0.15)' : 'var(--bg-card)',
              color: filterStrategy === s ? 'var(--accent-green)' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}>
            {s === 'alle' ? 'Alle Strategien' : s}
          </button>
        ))}
        <div className="w-px" style={{ background: 'var(--border)' }} />
        {(['alle', 'Kauf', 'Verkauf'] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: filterType === t ? 'rgba(132,204,22,0.15)' : 'var(--bg-card)',
              color: filterType === t ? 'var(--accent-green)' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}>
            {t === 'alle' ? 'Alle Typen' : t}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          Fehler: {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Datum', 'Typ', 'Wertpapier', 'Strategie', 'Stück', 'Preis', 'Gebühren', 'Steuern', 'Betrag', 'Limit', 'Stop-Limit', 'Quelle', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx, i) => (
                <tr key={tx.id}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid #111827' : 'none' }}
                  className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{
                        background: tx.type === 'Kauf' ? 'rgba(132,204,22,0.15)' : 'rgba(239,68,68,0.15)',
                        color: tx.type === 'Kauf' ? 'var(--accent-green)' : 'var(--accent-red)',
                      }}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{tx.security?.ticker ?? '—'}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{tx.security?.name ?? ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${STRATEGY_COLORS[tx.strategy] ?? '#6b7280'}20`, color: STRATEGY_COLORS[tx.strategy] ?? '#6b7280' }}>
                      {tx.strategy}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatNumber(tx.shares, 4)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(tx.price)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(tx.fees)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(tx.taxes)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(tx.amount, 0)}</td>
                  <td className="px-4 py-3 text-xs"
                    style={{ color: tx.limit_price ? '#84cc16' : 'var(--text-muted)' }}>
                    {tx.limit_price ? formatCurrency(tx.limit_price) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs"
                    style={{ color: tx.stop_limit_price ? '#ef4444' : 'var(--text-muted)' }}>
                    {tx.stop_limit_price ? formatCurrency(tx.stop_limit_price) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{tx.source ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditingTx(tx)}
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      title="Bearbeiten"
                    >
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Keine Transaktionen gefunden
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <TransactionForm
          securities={securities}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload() }}
        />
      )}

      {editingTx && (
        <TransactionForm
          securities={securities}
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => { setEditingTx(null); reload() }}
        />
      )}
    </div>
  )
}
