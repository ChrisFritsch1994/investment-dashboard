'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, X, Briefcase } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/format'
import ExportButton from '@/components/ExportButton'

interface Beteiligung {
  id: string
  company_name: string
  sector: string | null
  stake_pct: number | null
  purchase_date: string | null
  invested_amount: number | null
  current_valuation: number | null
  annual_dividend: number
  notes: string | null
}

const inputStyle = { background: '#0d1117', border: '1px solid var(--border)', color: 'var(--text-primary)' }
const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none'

const EMPTY: Omit<Beteiligung, 'id'> = {
  company_name: '', sector: null, stake_pct: null, purchase_date: null,
  invested_amount: null, current_valuation: null, annual_dividend: 0, notes: null,
}

export default function FirmenbeteiligungenPage() {
  const [rows, setRows] = useState<Beteiligung[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Beteiligung | null>(null)
  const [form, setForm] = useState<Omit<Beteiligung, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('firmenbeteiligungen').select('*').order('company_name')
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true) }
  const openEdit = (r: Beteiligung) => { setForm({ ...r }); setEditing(r); setShowForm(true) }
  const set = (k: string, v: string | number | null) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, purchase_date: form.purchase_date || null, stake_pct: form.stake_pct || null, invested_amount: form.invested_amount || null, current_valuation: form.current_valuation || null }
    if (editing) await supabase.from('firmenbeteiligungen').update(payload).eq('id', editing.id)
    else await supabase.from('firmenbeteiligungen').insert(payload)
    setSaving(false); setShowForm(false); load()
  }

  const totalInvested = rows.reduce((s, r) => s + (r.invested_amount ?? 0), 0)
  const totalValue = rows.reduce((s, r) => s + (r.current_valuation ?? 0), 0)
  const totalDividend = rows.reduce((s, r) => s + r.annual_dividend, 0)
  const pnl = totalValue - totalInvested

  const exportHeaders = ['Unternehmen', 'Branche', 'Beteiligung %', 'Kaufdatum', 'Investiert', 'Akt. Bewertung', 'G/V', 'Dividende/J', 'Notiz']
  const exportRows = rows.map(r => [r.company_name, r.sector ?? '', r.stake_pct ?? '', r.purchase_date ?? '', r.invested_amount ?? '', r.current_valuation ?? '', (r.current_valuation ?? 0) - (r.invested_amount ?? 0), r.annual_dividend, r.notes ?? ''])

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Firmenbeteiligungen</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{rows.length} Beteiligungen</p>
        </div>
        <div className="flex gap-2">
          <ExportButton filename="firmenbeteiligungen" headers={exportHeaders} rows={exportRows} />
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent-green)', color: '#0a0a0a' }}>
            <Plus size={16} /> Neue Beteiligung
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Investiert', value: formatCurrency(totalInvested, 0), color: 'var(--text-secondary)' },
          { label: 'Akt. Bewertung', value: formatCurrency(totalValue, 0), color: '#84cc16' },
          { label: 'G/V gesamt', value: formatCurrency(pnl, 0), color: pnl >= 0 ? '#84cc16' : '#ef4444' },
          { label: 'Dividenden/Jahr', value: formatCurrency(totalDividend, 0), color: '#a855f7' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
            <div className="text-xl font-bold mt-1" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(r => {
          const pnl = r.current_valuation != null && r.invested_amount != null ? r.current_valuation - r.invested_amount : null
          const pnlPct = pnl != null && r.invested_amount ? (pnl / r.invested_amount) * 100 : null
          return (
            <div key={r.id} className="rounded-xl p-5 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase size={16} style={{ color: '#f59e0b' }} />
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{r.company_name}</div>
                    {r.sector && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.sector}{r.stake_pct ? ` · ${r.stake_pct}%` : ''}</div>}
                  </div>
                </div>
                <button onClick={() => openEdit(r)} className="p-1.5 rounded-md hover:bg-white/10" style={{ color: 'var(--text-muted)' }}><Pencil size={13} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span style={{ color: 'var(--text-muted)' }}>Investiert</span><div className="font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{r.invested_amount ? formatCurrency(r.invested_amount, 0) : '—'}</div></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Bewertung</span><div className="font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{r.current_valuation ? formatCurrency(r.current_valuation, 0) : '—'}</div></div>
                <div><span style={{ color: 'var(--text-muted)' }}>G/V</span><div className="font-medium mt-0.5" style={{ color: pnl != null && pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{pnl != null ? `${formatCurrency(pnl, 0)} (${pnlPct?.toFixed(1)}%)` : '—'}</div></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Dividende/J</span><div className="font-medium mt-0.5" style={{ color: '#a855f7' }}>{formatCurrency(r.annual_dividend, 0)}</div></div>
              </div>
              {r.purchase_date && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Kauf: {formatDate(r.purchase_date)}</div>}
            </div>
          )
        })}
        {rows.length === 0 && !loading && <div className="col-span-3 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Noch keine Beteiligungen erfasst</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl shadow-2xl my-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Beteiligung bearbeiten' : 'Neue Beteiligung'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Unternehmensname</label>
                  <input required className={inputClass} style={inputStyle} value={form.company_name} onChange={e => set('company_name', e.target.value)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Branche</label>
                  <input className={inputClass} style={inputStyle} value={form.sector ?? ''} onChange={e => set('sector', e.target.value || null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Beteiligung (%)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.stake_pct ?? ''} onChange={e => set('stake_pct', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Kaufdatum</label>
                  <input type="date" className={inputClass} style={inputStyle} value={form.purchase_date ?? ''} onChange={e => set('purchase_date', e.target.value || null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Investierter Betrag (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.invested_amount ?? ''} onChange={e => set('invested_amount', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Akt. Bewertung (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.current_valuation ?? ''} onChange={e => set('current_valuation', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Dividende/Jahr (€)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.annual_dividend} onChange={e => set('annual_dividend', parseFloat(e.target.value) || 0)} /></div>
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
