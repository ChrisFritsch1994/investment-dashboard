'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/format'
import ExportButton from '@/components/ExportButton'

interface Sachwert {
  id: string
  name: string
  category: string
  purchase_date: string | null
  purchase_price: number | null
  current_value: number | null
  quantity: number
  unit: string
  notes: string | null
}

const CATEGORIES = ['Gold', 'Silber', 'Platin', 'Kunst', 'Schmuck', 'Oldtimer', 'Wein', 'Uhren', 'Sonstiges']
const CAT_COLORS: Record<string, string> = { Gold: '#f59e0b', Silber: '#94a3b8', Platin: '#a855f7', Kunst: '#3b82f6', Schmuck: '#ec4899', Oldtimer: '#f97316', Wein: '#dc2626', Uhren: '#06b6d4', Sonstiges: '#6b7280' }

const inputStyle = { background: '#0d1117', border: '1px solid var(--border)', color: 'var(--text-primary)' }
const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none'

const EMPTY: Omit<Sachwert, 'id'> = { name: '', category: 'Gold', purchase_date: null, purchase_price: null, current_value: null, quantity: 1, unit: 'Stück', notes: null }

export default function SachWertePage() {
  const [rows, setRows] = useState<Sachwert[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Sachwert | null>(null)
  const [form, setForm] = useState<Omit<Sachwert, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filterCat, setFilterCat] = useState('alle')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('sachwerte').select('*').order('category')
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true) }
  const openEdit = (r: Sachwert) => { setForm({ ...r }); setEditing(r); setShowForm(true) }
  const set = (k: string, v: string | number | null) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, purchase_date: form.purchase_date || null, purchase_price: form.purchase_price || null, current_value: form.current_value || null }
    if (editing) await supabase.from('sachwerte').update(payload).eq('id', editing.id)
    else await supabase.from('sachwerte').insert(payload)
    setSaving(false); setShowForm(false); load()
  }

  const filtered = rows.filter(r => filterCat === 'alle' || r.category === filterCat)
  const totalValue = rows.reduce((s, r) => s + (r.current_value ?? 0), 0)
  const totalCost = rows.reduce((s, r) => s + (r.purchase_price ?? 0), 0)
  const pnl = totalValue - totalCost

  const exportHeaders = ['Name', 'Kategorie', 'Kaufdatum', 'Kaufpreis', 'Akt. Wert', 'G/V', 'Menge', 'Einheit', 'Notiz']
  const exportRows = filtered.map(r => [r.name, r.category, r.purchase_date ?? '', r.purchase_price ?? '', r.current_value ?? '', (r.current_value ?? 0) - (r.purchase_price ?? 0), r.quantity, r.unit, r.notes ?? ''])

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Sachwerte</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{rows.length} Positionen</p>
        </div>
        <div className="flex gap-2">
          <ExportButton filename="sachwerte" headers={exportHeaders} rows={exportRows} />
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent-green)', color: '#0a0a0a' }}>
            <Plus size={16} /> Neuer Sachwert
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Anschaffungswert', value: formatCurrency(totalCost, 0), color: 'var(--text-secondary)' },
          { label: 'Akt. Marktwert', value: formatCurrency(totalValue, 0), color: '#f59e0b' },
          { label: 'Wertsteigerung', value: formatCurrency(pnl, 0), color: pnl >= 0 ? '#84cc16' : '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
            <div className="text-xl font-bold mt-1" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['alle', ...CATEGORIES] as const).map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: filterCat === c ? 'rgba(132,204,22,0.15)' : 'var(--bg-card)', color: filterCat === c ? 'var(--accent-green)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {c === 'alle' ? 'Alle' : c}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Bezeichnung', 'Kategorie', 'Menge', 'Kaufpreis', 'Akt. Wert', 'G/V', 'G/V %', 'Kaufdatum', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const pnl = r.current_value != null && r.purchase_price != null ? r.current_value - r.purchase_price : null
                const pnlPct = pnl != null && r.purchase_price ? (pnl / r.purchase_price) * 100 : null
                return (
                  <tr key={r.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #111827' : 'none' }} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.quantity} {r.unit}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${CAT_COLORS[r.category] ?? '#6b7280'}20`, color: CAT_COLORS[r.category] ?? '#6b7280' }}>{r.category}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{r.quantity} {r.unit}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{r.purchase_price ? formatCurrency(r.purchase_price, 0) : '—'}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{r.current_value ? formatCurrency(r.current_value, 0) : '—'}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: pnl != null && pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{pnl != null ? formatCurrency(pnl, 0) : '—'}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: pnl != null && pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{pnlPct != null ? `${pnlPct.toFixed(1)}%` : '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{r.purchase_date ? formatDate(r.purchase_date) : '—'}</td>
                    <td className="px-4 py-3"><button onClick={() => openEdit(r)} className="p-1.5 rounded-md hover:bg-white/10" style={{ color: 'var(--text-muted)' }}><Pencil size={13} /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && !loading && <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Keine Sachwerte erfasst</div>}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl shadow-2xl my-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Bearbeiten' : 'Neuer Sachwert'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Bezeichnung</label>
                  <input required className={inputClass} style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Kategorie</label>
                  <select className={inputClass} style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Kaufdatum</label>
                  <input type="date" className={inputClass} style={inputStyle} value={form.purchase_date ?? ''} onChange={e => set('purchase_date', e.target.value || null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Menge</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.quantity} onChange={e => set('quantity', parseFloat(e.target.value) || 1)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Einheit</label>
                  <input className={inputClass} style={inputStyle} value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="Stück / oz / g" /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Kaufpreis (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.purchase_price ?? ''} onChange={e => set('purchase_price', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Akt. Wert (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.current_value ?? ''} onChange={e => set('current_value', e.target.value ? parseFloat(e.target.value) : null)} /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Notiz</label>
                <input className={inputClass} style={inputStyle} value={form.notes ?? ''} onChange={e => set('notes', e.target.value || null)} /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg text-sm"
                  style={{ background: '#0d1117', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Abbrechen</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-bold"
                  style={{ background: 'var(--accent-green)', color: '#0a0a0a', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Speichern…' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
