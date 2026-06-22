'use client'

import { useState, useMemo } from 'react'
import { Plus, Pencil, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { usePortfolio } from '@/hooks/usePortfolio'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'
import TransactionForm from '@/components/TransactionForm'
import ExportButton from '@/components/ExportButton'
import type { Transaction } from '@/lib/types'

const STRATEGY_COLORS: Record<string, string> = {
  'Basis': '#84cc16',
  'Saisonalitäten': '#3b82f6',
  'Aktien-Trading': '#f59e0b',
  'Krypto': '#a855f7',
}

type SortKey = 'date' | 'type' | 'ticker' | 'strategy' | 'shares' | 'price' | 'fees' | 'taxes' | 'amount'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />
  return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
}

export default function TransaktionenPage() {
  const { transactions, securities, loading, error, reload } = usePortfolio()
  const [showForm, setShowForm] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [filterStrategy, setFilterStrategy] = useState<string>('alle')
  const [filterType, setFilterType] = useState<string>('alle')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    let rows = transactions.filter(tx => {
      if (filterStrategy !== 'alle' && tx.strategy !== filterStrategy) return false
      if (filterType !== 'alle' && tx.type !== filterType) return false
      if (search) {
        const q = search.toLowerCase()
        return (tx.security?.ticker ?? '').toLowerCase().includes(q) ||
          (tx.security?.name ?? '').toLowerCase().includes(q)
      }
      return true
    })

    rows = [...rows].sort((a, b) => {
      let va: string | number = 0, vb: string | number = 0
      if (sortKey === 'date') { va = a.date; vb = b.date }
      else if (sortKey === 'type') { va = a.type; vb = b.type }
      else if (sortKey === 'ticker') { va = a.security?.ticker ?? ''; vb = b.security?.ticker ?? '' }
      else if (sortKey === 'strategy') { va = a.strategy; vb = b.strategy }
      else if (sortKey === 'shares') { va = a.shares; vb = b.shares }
      else if (sortKey === 'price') { va = a.price; vb = b.price }
      else if (sortKey === 'fees') { va = a.fees; vb = b.fees }
      else if (sortKey === 'taxes') { va = a.taxes; vb = b.taxes }
      else if (sortKey === 'amount') { va = a.amount; vb = b.amount }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return rows
  }, [transactions, filterStrategy, filterType, search, sortKey, sortDir])

  const exportHeaders = ['Datum', 'Typ', 'Ticker', 'Name', 'Strategie', 'Stück', 'Preis', 'Gebühren', 'Steuern', 'Betrag', 'Limit', 'Stop-Limit', 'Notiz']
  const exportRows = filtered.map(tx => [
    tx.date, tx.type, tx.security?.ticker ?? '', tx.security?.name ?? '',
    tx.strategy, tx.shares, tx.price, tx.fees, tx.taxes, tx.amount,
    tx.limit_price ?? '', tx.stop_limit_price ?? '', tx.notes ?? '',
  ])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Lade…</div>
    </div>
  )

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Transaktionen</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} von {transactions.length} Buchungen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton filename="transaktionen" headers={exportHeaders} rows={exportRows} />
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent-green)', color: '#0a0a0a' }}
          >
            <Plus size={16} />
            Neue Transaktion
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="text"
          placeholder="Ticker / Name suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 180 }}
        />
        <div className="w-px h-5" style={{ background: 'var(--border)' }} />
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
        <div className="w-px h-5" style={{ background: 'var(--border)' }} />
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

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {([
                  ['Datum', 'date'], ['Typ', 'type'], ['Wertpapier', 'ticker'],
                  ['Strategie', 'strategy'], ['Stück', 'shares'], ['Preis', 'price'],
                  ['Gebühren', 'fees'], ['Steuern', 'taxes'], ['Betrag', 'amount'],
                ] as [string, SortKey][]).map(([label, key]) => (
                  <th key={key}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => toggleSort(key)}>
                    <div className="flex items-center gap-1">
                      {label}
                      <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                    </div>
                  </th>
                ))}
                {['Limit', 'Stop-Limit', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
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
                  <td className="px-4 py-3 text-xs" style={{ color: tx.limit_price ? '#84cc16' : 'var(--text-muted)' }}>
                    {tx.limit_price ? formatCurrency(tx.limit_price) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: tx.stop_limit_price ? '#ef4444' : 'var(--text-muted)' }}>
                    {tx.stop_limit_price ? formatCurrency(tx.stop_limit_price) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditingTx(tx)}
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                      style={{ color: 'var(--text-muted)' }} title="Bearbeiten">
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
        <TransactionForm securities={securities} onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload() }} />
      )}
      {editingTx && (
        <TransactionForm securities={securities} transaction={editingTx}
          onClose={() => setEditingTx(null)} onSaved={() => { setEditingTx(null); reload() }} />
      )}
    </div>
  )
}
