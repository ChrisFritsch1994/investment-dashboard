'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, X, Home } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/format'
import ExportButton from '@/components/ExportButton'

interface Immobilie {
  id: string
  name: string
  address: string | null
  purchase_date: string | null
  purchase_price: number | null
  current_value: number | null
  rental_income_monthly: number
  mortgage_balance: number
  mortgage_rate: number | null
  area_sqm: number | null
  notes: string | null
}

const inputStyle = { background: '#0d1117', border: '1px solid var(--border)', color: 'var(--text-primary)' }
const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none'

const EMPTY: Omit<Immobilie, 'id'> = {
  name: '', address: null, purchase_date: null, purchase_price: null,
  current_value: null, rental_income_monthly: 0, mortgage_balance: 0,
  mortgage_rate: null, area_sqm: null, notes: null,
}

export default function ImmobilienPage() {
  const [rows, setRows] = useState<Immobilie[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Immobilie | null>(null)
  const [form, setForm] = useState<Omit<Immobilie, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('immobilien').select('*').order('name')
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true) }
  const openEdit = (r: Immobilie) => { setForm({ ...r }); setEditing(r); setShowForm(true) }
  const set = (k: string, v: string | number | null) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price || null,
      current_value: form.current_value || null,
      mortgage_rate: form.mortgage_rate || null,
      area_sqm: form.area_sqm || null,
    }
    if (editing) await supabase.from('immobilien').update(payload).eq('id', editing.id)
    else await supabase.from('immobilien').insert(payload)
    setSaving(false)
    setShowForm(false)
    load()
  }

  const totalValue = rows.reduce((s, r) => s + (r.current_value ?? 0), 0)
  const totalMortgage = rows.reduce((s, r) => s + r.mortgage_balance, 0)
  const totalRental = rows.reduce((s, r) => s + r.rental_income_monthly, 0)
  const equity = totalValue - totalMortgage

  const exportHeaders = ['Name', 'Adresse', 'Kaufdatum', 'Kaufpreis', 'Akt. Wert', 'Mieteinnahmen/M', 'Hypothek', 'Zins %', 'Fläche m²', 'Notiz']
  const exportRows = rows.map(r => [r.name, r.address ?? '', r.purchase_date ?? '', r.purchase_price ?? '', r.current_value ?? '', r.rental_income_monthly, r.mortgage_balance, r.mortgage_rate ?? '', r.area_sqm ?? '', r.notes ?? ''])

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Immobilien</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{rows.length} Objekte</p>
        </div>
        <div className="flex gap-2">
          <ExportButton filename="immobilien" headers={exportHeaders} rows={exportRows} />
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent-green)', color: '#0a0a0a' }}>
            <Plus size={16} /> Neues Objekt
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Marktwert', value: formatCurrency(totalValue, 0), color: '#84cc16' },
          { label: 'Eigenkapital', value: formatCurrency(equity, 0), color: equity >= 0 ? '#84cc16' : '#ef4444' },
          { label: 'Hypotheken', value: formatCurrency(totalMortgage, 0), color: '#ef4444' },
          { label: 'Mieteinnahmen/M', value: formatCurrency(totalRental, 0), color: '#3b82f6' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
            <div className="text-xl font-bold mt-1" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(r => {
          const pnl = r.current_value != null && r.purchase_price != null ? r.current_value - r.purchase_price : null
          const pnlPct = pnl != null && r.purchase_price ? (pnl / r.purchase_price) * 100 : null
          const ekRendite = r.current_value && (r.current_value - r.mortgage_balance) > 0 ? (r.rental_income_monthly * 12) / (r.current_value - r.mortgage_balance) * 100 : null
          return (
            <div key={r.id} className="rounded-xl p-5 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Home size={16} style={{ color: 'var(--accent-green)' }} />
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</div>
                    {r.address && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.address}</div>}
                  </div>
                </div>
                <button onClick={() => openEdit(r)} className="p-1.5 rounded-md hover:bg-white/10" style={{ color: 'var(--text-muted)' }}><Pencil size={13} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span style={{ color: 'var(--text-muted)' }}>Kaufpreis</span><div className="font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{r.purchase_price ? formatCurrency(r.purchase_price, 0) : '—'}</div></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Akt. Wert</span><div className="font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{r.current_value ? formatCurrency(r.current_value, 0) : '—'}</div></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Wertentw.</span><div className="font-medium mt-0.5" style={{ color: pnl != null && pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{pnl != null ? `${formatCurrency(pnl, 0)} (${pnlPct?.toFixed(1)}%)` : '—'}</div></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Miete/M</span><div className="font-medium mt-0.5" style={{ color: '#3b82f6' }}>{formatCurrency(r.rental_income_monthly, 0)}</div></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Hypothek</span><div className="font-medium mt-0.5" style={{ color: '#ef4444' }}>{formatCurrency(r.mortgage_balance, 0)}</div></div>
                <div><span style={{ color: 'var(--text-muted)' }}>EK-Rendite</span><div className="font-medium mt-0.5" style={{ color: '#a855f7' }}>{ekRendite != null ? `${ekRendite.toFixed(1)}%` : '—'}</div></div>
              </div>
              {r.area_sqm && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.area_sqm} m² · {r.mortgage_rate ? `${r.mortgage_rate}% Zins` : 'Kein Kredit'}</div>}
            </div>
          )
        })}
        {rows.length === 0 && !loading && (
          <div className="col-span-3 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Noch keine Immobilien erfasst</div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl shadow-2xl my-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Objekt bearbeiten' : 'Neues Objekt'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Bezeichnung</label>
                <input required className={inputClass} style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Adresse</label>
                <input className={inputClass} style={inputStyle} value={form.address ?? ''} onChange={e => set('address', e.target.value || null)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Kaufdatum</label>
                  <input type="date" className={inputClass} style={inputStyle} value={form.purchase_date ?? ''} onChange={e => set('purchase_date', e.target.value || null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Fläche (m²)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.area_sqm ?? ''} onChange={e => set('area_sqm', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Kaufpreis (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.purchase_price ?? ''} onChange={e => set('purchase_price', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Akt. Marktwert (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.current_value ?? ''} onChange={e => set('current_value', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Mieteinnahmen/M (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.rental_income_monthly} onChange={e => set('rental_income_monthly', parseFloat(e.target.value) || 0)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Hypothek restl. (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.mortgage_balance} onChange={e => set('mortgage_balance', parseFloat(e.target.value) || 0)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Zinssatz (%)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.mortgage_rate ?? ''} onChange={e => set('mortgage_rate', e.target.value ? parseFloat(e.target.value) : null)} /></div>
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
