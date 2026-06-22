'use client'

import { useState } from 'react'
import { Plus, Pencil, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePortfolio } from '@/hooks/usePortfolio'
import { formatCurrency, formatDate } from '@/lib/format'
import type { Cashflow, CashflowCategory } from '@/lib/types'

const CATEGORY_COLORS: Record<string, string> = {
  'Einzahlung': '#84cc16',
  'Auszahlung': '#ef4444',
  'Zinsen': '#3b82f6',
  'Dividende': '#a855f7',
  'Gebühr': '#f59e0b',
  'Steuererstattung': '#06b6d4',
}

const CATEGORIES: CashflowCategory[] = ['Einzahlung', 'Auszahlung', 'Zinsen', 'Dividende', 'Gebühr', 'Steuererstattung']

export default function CashflowPage() {
  const { cashflows, loading, reload } = usePortfolio()
  const [showForm, setShowForm] = useState(false)
  const [editingCf, setEditingCf] = useState<Cashflow | null>(null)
  const [filterCat, setFilterCat] = useState('alle')
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '',
    category: 'Einzahlung' as CashflowCategory,
    isin: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const filtered = cashflows
    .filter(cf => filterCat === 'alle' || cf.category === filterCat)
    .slice().reverse()

  // Amounts in DB: Einzahlung = positive, Auszahlung = negative (from Excel import)
  // We display absolute values with color indicating direction
  const totals = cashflows.reduce((acc, cf) => {
    if (cf.category === 'Einzahlung') acc.einzahlungen += Math.abs(cf.amount)
    else if (cf.category === 'Auszahlung') acc.auszahlungen += Math.abs(cf.amount)
    else if (cf.category === 'Dividende') acc.dividenden += Math.abs(cf.amount)
    else if (cf.category === 'Zinsen') acc.zinsen += Math.abs(cf.amount)
    else if (cf.category === 'Gebühr') acc.gebuehren += Math.abs(cf.amount)
    else if (cf.category === 'Steuererstattung') acc.steuer += Math.abs(cf.amount)
    return acc
  }, { einzahlungen: 0, auszahlungen: 0, dividenden: 0, zinsen: 0, gebuehren: 0, steuer: 0 })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    try {
      const { error } = await supabase.from('cashflows').insert({
        date: form.date,
        description: form.description || null,
        amount: parseFloat(form.amount),
        category: form.category,
        isin: form.isin || null,
      })
      if (error) throw error
      setShowForm(false)
      reload()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: React.FormEvent, cf: Cashflow, editForm: typeof form) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('cashflows').update({
        date: editForm.date,
        description: editForm.description || null,
        amount: parseFloat(editForm.amount),
        category: editForm.category as CashflowCategory,
        isin: editForm.isin || null,
      }).eq('id', cf.id)
      if (error) throw error
      setEditingCf(null)
      reload()
    } catch (e: unknown) {
      console.error(e)
    }
  }

  const inputStyle = {
    background: '#0d1117',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Cashflow</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {cashflows.length} Buchungen
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--accent-green)', color: '#0a0a0a' }}
        >
          <Plus size={16} />
          Neue Buchung
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Einzahlungen', value: totals.einzahlungen, color: '#84cc16' },
          { label: 'Auszahlungen', value: totals.auszahlungen, color: '#ef4444' },
          { label: 'Dividenden', value: totals.dividenden, color: '#a855f7' },
          { label: 'Zinsen', value: totals.zinsen, color: '#3b82f6' },
          { label: 'Gebühren', value: totals.gebuehren, color: '#f59e0b' },
          { label: 'Steuererstattung', value: totals.steuer, color: '#06b6d4' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
            <div className="text-lg font-bold mt-1" style={{ color }}>{formatCurrency(value, 0)}</div>
          </div>
        ))}
      </div>

      {/* Net */}
      <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Netto-Zufluss (Einzahlungen − Auszahlungen)
        </span>
        <span className="text-xl font-bold" style={{ color: (totals.einzahlungen - totals.auszahlungen) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
          {formatCurrency(totals.einzahlungen - totals.auszahlungen, 0)}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['alle', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: filterCat === cat ? 'rgba(132,204,22,0.15)' : 'var(--bg-card)',
              color: filterCat === cat ? 'var(--accent-green)' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {cat === 'alle' ? 'Alle' : cat}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Datum', 'Beschreibung', 'Kategorie', 'Betrag', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((cf, i) => (
                <tr key={cf.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #111827' : 'none' }}
                  className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatDate(cf.date)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{cf.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${CATEGORY_COLORS[cf.category] ?? '#6b7280'}20`, color: CATEGORY_COLORS[cf.category] ?? '#6b7280' }}>
                      {cf.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium"
                    style={{ color: ['Einzahlung', 'Dividende', 'Zinsen', 'Steuererstattung'].includes(cf.category) ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {formatCurrency(Math.abs(cf.amount))}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditingCf(cf)}
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
            <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Keine Einträge</div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Neue Cashflow-Buchung</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Datum</label>
                  <input type="date" required className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
                    value={form.date} onChange={e => set('date', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Kategorie</label>
                  <select className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
                    value={form.category} onChange={e => set('category', e.target.value as CashflowCategory)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Beschreibung</label>
                <input type="text" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
                  value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Betrag (€)</label>
                <input type="number" required step="any" min="0" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
                  value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
              </div>
              {err && <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{err}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm"
                  style={{ background: '#0d1117', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  Abbrechen
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-bold"
                  style={{ background: 'var(--accent-green)', color: '#0a0a0a', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Speichern…' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingCf && (
        <CashflowEditModal
          cf={editingCf}
          onClose={() => setEditingCf(null)}
          onSave={handleEdit}
          inputStyle={inputStyle}
        />
      )}
    </div>
  )
}

function CashflowEditModal({
  cf, onClose, onSave, inputStyle,
}: {
  cf: Cashflow
  onClose: () => void
  onSave: (e: React.FormEvent, cf: Cashflow, form: { date: string; description: string; amount: string; category: CashflowCategory; isin: string }) => void
  inputStyle: React.CSSProperties
}) {
  const [form, setForm] = useState({
    date: cf.date,
    description: cf.description ?? '',
    amount: Math.abs(cf.amount).toString(),
    category: cf.category as string,
    isin: cf.isin ?? '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Buchung bearbeiten</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <form onSubmit={e => onSave(e, cf, form)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Datum</label>
              <input type="date" required className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
                value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Kategorie</label>
              <select className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
                value={form.category} onChange={e => set('category', e.target.value)}>
                {(['Einzahlung', 'Auszahlung', 'Zinsen', 'Dividende', 'Gebühr', 'Steuererstattung'] as const).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Beschreibung</label>
            <input type="text" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Betrag (€)</label>
            <input type="number" required step="any" min="0" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
              value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>ISIN (optional)</label>
            <input type="text" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
              value={form.isin} onChange={e => set('isin', e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm"
              style={{ background: '#0d1117', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              Abbrechen
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: 'var(--accent-green)', color: '#0a0a0a' }}>
              Änderungen speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
