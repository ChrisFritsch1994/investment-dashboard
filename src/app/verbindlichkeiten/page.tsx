'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/format'
import ExportButton from '@/components/ExportButton'

interface Verbindlichkeit {
  id: string
  name: string
  lender: string | null
  liability_type: string
  original_amount: number | null
  current_balance: number
  interest_rate: number | null
  monthly_payment: number | null
  start_date: string | null
  end_date: string | null
  notes: string | null
}

const LIABILITY_TYPES = ['Hypothek', 'Konsumkredit', 'Autokredit', 'Studienkredit', 'Kreditkarte', 'Sonstiges']
const TYPE_COLORS: Record<string, string> = { Hypothek: '#ef4444', Konsumkredit: '#f59e0b', Autokredit: '#f97316', Studienkredit: '#3b82f6', Kreditkarte: '#a855f7', Sonstiges: '#6b7280' }

const inputStyle = { background: '#0d1117', border: '1px solid var(--border)', color: 'var(--text-primary)' }
const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none'

const EMPTY: Omit<Verbindlichkeit, 'id'> = { name: '', lender: null, liability_type: 'Konsumkredit', original_amount: null, current_balance: 0, interest_rate: null, monthly_payment: null, start_date: null, end_date: null, notes: null }

export default function VerbindlichkeitenPage() {
  const [rows, setRows] = useState<Verbindlichkeit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Verbindlichkeit | null>(null)
  const [form, setForm] = useState<Omit<Verbindlichkeit, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('verbindlichkeiten').select('*').order('current_balance', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true) }
  const openEdit = (r: Verbindlichkeit) => { setForm({ ...r }); setEditing(r); setShowForm(true) }
  const set = (k: string, v: string | number | null) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, lender: form.lender || null, original_amount: form.original_amount || null, interest_rate: form.interest_rate || null, monthly_payment: form.monthly_payment || null, start_date: form.start_date || null, end_date: form.end_date || null }
    if (editing) await supabase.from('verbindlichkeiten').update(payload).eq('id', editing.id)
    else await supabase.from('verbindlichkeiten').insert(payload)
    setSaving(false); setShowForm(false); load()
  }

  const totalBalance = rows.reduce((s, r) => s + r.current_balance, 0)
  const totalMonthly = rows.reduce((s, r) => s + (r.monthly_payment ?? 0), 0)
  const totalInterestYear = rows.reduce((s, r) => s + r.current_balance * ((r.interest_rate ?? 0) / 100), 0)

  const exportHeaders = ['Name', 'Gläubiger', 'Typ', 'Ursprungsbetrag', 'Restschuld', 'Zinssatz %', 'Rate/M', 'Laufzeit bis', 'Notiz']
  const exportRows = rows.map(r => [r.name, r.lender ?? '', r.liability_type, r.original_amount ?? '', r.current_balance, r.interest_rate ?? '', r.monthly_payment ?? '', r.end_date ?? '', r.notes ?? ''])

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Verbindlichkeiten</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{rows.length} Positionen</p>
        </div>
        <div className="flex gap-2">
          <ExportButton filename="verbindlichkeiten" headers={exportHeaders} rows={exportRows} />
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent-green)', color: '#0a0a0a' }}>
            <Plus size={16} /> Neue Position
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Gesamtschulden', value: formatCurrency(totalBalance, 0), color: '#ef4444' },
          { label: 'Monatl. Raten', value: formatCurrency(totalMonthly, 0), color: '#f59e0b' },
          { label: 'Zinskosten/Jahr', value: formatCurrency(totalInterestYear, 0), color: '#f97316' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
            <div className="text-xl font-bold mt-1" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Bezeichnung', 'Gläubiger', 'Typ', 'Restschuld', 'Rate/M', 'Zins %', 'Tilgungsquote', 'Laufzeit bis', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const repayPct = r.original_amount ? ((1 - r.current_balance / r.original_amount) * 100) : null
                return (
                  <tr key={r.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #111827' : 'none' }} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{r.lender ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${TYPE_COLORS[r.liability_type] ?? '#6b7280'}20`, color: TYPE_COLORS[r.liability_type] ?? '#6b7280' }}>{r.liability_type}</span>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#ef4444' }}>{formatCurrency(r.current_balance, 0)}</td>
                    <td className="px-4 py-3" style={{ color: '#f59e0b' }}>{r.monthly_payment ? formatCurrency(r.monthly_payment, 0) : '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{r.interest_rate != null ? `${r.interest_rate}%` : '—'}</td>
                    <td className="px-4 py-3">
                      {repayPct != null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(repayPct, 100)}%` }} />
                          </div>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{repayPct.toFixed(0)}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{r.end_date ? formatDate(r.end_date) : '—'}</td>
                    <td className="px-4 py-3"><button onClick={() => openEdit(r)} className="p-1.5 rounded-md hover:bg-white/10" style={{ color: 'var(--text-muted)' }}><Pencil size={13} /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && !loading && <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Keine Verbindlichkeiten erfasst</div>}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl shadow-2xl my-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Bearbeiten' : 'Neue Verbindlichkeit'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Bezeichnung</label>
                  <input required className={inputClass} style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Gläubiger</label>
                  <input className={inputClass} style={inputStyle} value={form.lender ?? ''} onChange={e => set('lender', e.target.value || null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Typ</label>
                  <select className={inputClass} style={inputStyle} value={form.liability_type} onChange={e => set('liability_type', e.target.value)}>
                    {LIABILITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Ursprungsbetrag (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.original_amount ?? ''} onChange={e => set('original_amount', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Restschuld (€)</label>
                  <input type="number" step="any" required className={inputClass} style={inputStyle} value={form.current_balance || ''} onChange={e => set('current_balance', parseFloat(e.target.value) || 0)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Zinssatz (%)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.interest_rate ?? ''} onChange={e => set('interest_rate', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Monatsrate (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.monthly_payment ?? ''} onChange={e => set('monthly_payment', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Start</label>
                  <input type="date" className={inputClass} style={inputStyle} value={form.start_date ?? ''} onChange={e => set('start_date', e.target.value || null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Laufzeit bis</label>
                  <input type="date" className={inputClass} style={inputStyle} value={form.end_date ?? ''} onChange={e => set('end_date', e.target.value || null)} /></div>
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
