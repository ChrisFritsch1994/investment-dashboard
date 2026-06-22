'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/format'
import ExportButton from '@/components/ExportButton'

interface Option {
  id: string
  date: string
  underlying: string
  option_type: 'Call' | 'Put'
  strike: number | null
  expiry: string | null
  contracts: number | null
  premium: number | null
  fees: number
  status: 'offen' | 'geschlossen' | 'verfallen' | 'ausgeübt'
  notes: string | null
}

const STATUS_COLORS: Record<string, string> = {
  offen: '#84cc16', geschlossen: '#3b82f6', verfallen: '#ef4444', ausgeübt: '#a855f7',
}

const inputStyle = { background: '#0d1117', border: '1px solid var(--border)', color: 'var(--text-primary)' }
const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none'

const EMPTY: Omit<Option, 'id'> = {
  date: new Date().toISOString().slice(0, 10),
  underlying: '', option_type: 'Call', strike: null, expiry: null,
  contracts: null, premium: null, fees: 0, status: 'offen', notes: null,
}

export default function OptionenPage() {
  const [rows, setRows] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Option | null>(null)
  const [form, setForm] = useState<Omit<Option, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('alle')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('optionen').select('*').order('date', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true) }
  const openEdit = (r: Option) => { setForm({ ...r }); setEditing(r); setShowForm(true) }
  const set = (k: string, v: string | number | null) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, strike: form.strike || null, expiry: form.expiry || null, contracts: form.contracts || null, premium: form.premium || null }
    if (editing) {
      await supabase.from('optionen').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('optionen').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  const filtered = rows.filter(r => filterStatus === 'alle' || r.status === filterStatus)
  const totalPremium = rows.filter(r => r.status !== 'verfallen').reduce((s, r) => s + (r.premium ?? 0) * (r.contracts ?? 1), 0)
  const openCount = rows.filter(r => r.status === 'offen').length

  const exportHeaders = ['Datum', 'Underlying', 'Typ', 'Strike', 'Verfall', 'Kontrakte', 'Prämie', 'Gebühren', 'Status', 'Notiz']
  const exportRows = filtered.map(r => [r.date, r.underlying, r.option_type, r.strike ?? '', r.expiry ?? '', r.contracts ?? '', r.premium ?? '', r.fees, r.status, r.notes ?? ''])

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Optionen</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{rows.length} Kontrakte</p>
        </div>
        <div className="flex gap-2">
          <ExportButton filename="optionen" headers={exportHeaders} rows={exportRows} />
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent-green)', color: '#0a0a0a' }}>
            <Plus size={16} /> Neuer Kontrakt
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Offen', value: openCount, unit: 'Kontrakte', color: '#84cc16' },
          { label: 'Gesamt Prämien', value: formatCurrency(totalPremium), color: '#3b82f6' },
          { label: 'Calls', value: rows.filter(r => r.option_type === 'Call' && r.status === 'offen').length, unit: 'offen', color: '#a855f7' },
          { label: 'Puts', value: rows.filter(r => r.option_type === 'Put' && r.status === 'offen').length, unit: 'offen', color: '#f59e0b' },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
            <div className="text-xl font-bold mt-1" style={{ color }}>{value}{unit ? <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>{unit}</span> : ''}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['alle', 'offen', 'geschlossen', 'verfallen', 'ausgeübt'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: filterStatus === s ? 'rgba(132,204,22,0.15)' : 'var(--bg-card)', color: filterStatus === s ? 'var(--accent-green)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {s === 'alle' ? 'Alle' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Datum', 'Underlying', 'Typ', 'Strike', 'Verfall', 'Kontrakte', 'Prämie/Stk', 'Gesamt', 'Status', 'Notiz', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #111827' : 'none' }} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatDate(r.date)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{r.underlying}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: r.option_type === 'Call' ? 'rgba(132,204,22,0.15)' : 'rgba(239,68,68,0.15)', color: r.option_type === 'Call' ? '#84cc16' : '#ef4444' }}>
                      {r.option_type}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{r.strike ? formatCurrency(r.strike) : '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{r.expiry ? formatDate(r.expiry) : '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{r.contracts ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{r.premium ? formatCurrency(r.premium) : '—'}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {r.premium && r.contracts ? formatCurrency(r.premium * r.contracts) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${STATUS_COLORS[r.status]}20`, color: STATUS_COLORS[r.status] }}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{r.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(r)} className="p-1.5 rounded-md hover:bg-white/10" style={{ color: 'var(--text-muted)' }}><Pencil size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && !loading && <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Keine Optionen</div>}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl shadow-2xl my-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Kontrakt bearbeiten' : 'Neuer Kontrakt'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Datum</label>
                  <input type="date" required className={inputClass} style={inputStyle} value={form.date} onChange={e => set('date', e.target.value)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Underlying</label>
                  <input type="text" required className={inputClass} style={inputStyle} placeholder="z.B. AAPL" value={form.underlying} onChange={e => set('underlying', e.target.value)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Typ</label>
                  <select className={inputClass} style={inputStyle} value={form.option_type} onChange={e => set('option_type', e.target.value)}>
                    <option value="Call">Call</option><option value="Put">Put</option>
                  </select></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Status</label>
                  <select className={inputClass} style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
                    {['offen', 'geschlossen', 'verfallen', 'ausgeübt'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Strike (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.strike ?? ''} onChange={e => set('strike', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Verfall</label>
                  <input type="date" className={inputClass} style={inputStyle} value={form.expiry ?? ''} onChange={e => set('expiry', e.target.value || null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Kontrakte</label>
                  <input type="number" className={inputClass} style={inputStyle} value={form.contracts ?? ''} onChange={e => set('contracts', e.target.value ? parseInt(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Prämie/Kontrakt (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.premium ?? ''} onChange={e => set('premium', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Gebühren (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.fees} onChange={e => set('fees', parseFloat(e.target.value) || 0)} /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Notiz</label>
                <input type="text" className={inputClass} style={inputStyle} value={form.notes ?? ''} onChange={e => set('notes', e.target.value || null)} /></div>
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
