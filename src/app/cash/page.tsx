'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/format'
import ExportButton from '@/components/ExportButton'

interface CashPosition {
  id: string
  name: string
  bank: string | null
  account_type: string
  amount: number
  interest_rate: number
  notes: string | null
}

const ACCOUNT_TYPES = ['Girokonto', 'Tagesgeld', 'Festgeld', 'Sparkonto', 'Sonstiges']
const TYPE_COLORS: Record<string, string> = { Girokonto: '#6b7280', Tagesgeld: '#3b82f6', Festgeld: '#84cc16', Sparkonto: '#a855f7', Sonstiges: '#f59e0b' }

const inputStyle = { background: '#0d1117', border: '1px solid var(--border)', color: 'var(--text-primary)' }
const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none'

const EMPTY: Omit<CashPosition, 'id'> = { name: '', bank: null, account_type: 'Tagesgeld', amount: 0, interest_rate: 0, notes: null }

export default function CashPage() {
  const [rows, setRows] = useState<CashPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CashPosition | null>(null)
  const [form, setForm] = useState<Omit<CashPosition, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('cash_positionen').select('*').order('account_type')
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true) }
  const openEdit = (r: CashPosition) => { setForm({ ...r }); setEditing(r); setShowForm(true) }
  const set = (k: string, v: string | number | null) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, bank: form.bank || null }
    if (editing) await supabase.from('cash_positionen').update(payload).eq('id', editing.id)
    else await supabase.from('cash_positionen').insert(payload)
    setSaving(false); setShowForm(false); load()
  }

  const totalCash = rows.reduce((s, r) => s + r.amount, 0)
  const weightedRate = rows.reduce((s, r) => s + r.amount * r.interest_rate, 0) / (totalCash || 1)
  const annualInterest = rows.reduce((s, r) => s + r.amount * (r.interest_rate / 100), 0)

  const exportHeaders = ['Bezeichnung', 'Bank', 'Kontotyp', 'Betrag', 'Zinssatz %', 'Zinsen/Jahr', 'Notiz']
  const exportRows = rows.map(r => [r.name, r.bank ?? '', r.account_type, r.amount, r.interest_rate, (r.amount * r.interest_rate / 100).toFixed(2), r.notes ?? ''])

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Cash & Liquidität</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{rows.length} Konten</p>
        </div>
        <div className="flex gap-2">
          <ExportButton filename="cash-liquiditaet" headers={exportHeaders} rows={exportRows} />
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent-green)', color: '#0a0a0a' }}>
            <Plus size={16} /> Neues Konto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Gesamt Cash', value: formatCurrency(totalCash, 0), color: '#84cc16' },
          { label: 'Ø Zinssatz', value: `${weightedRate.toFixed(2)}%`, color: '#3b82f6' },
          { label: 'Zinserträge/Jahr', value: formatCurrency(annualInterest, 0), color: '#a855f7' },
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
                {['Bezeichnung', 'Bank', 'Kontotyp', 'Betrag', 'Zinssatz', 'Zinsen/Jahr', 'Anteil', 'Notiz', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #111827' : 'none' }} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{r.bank ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${TYPE_COLORS[r.account_type] ?? '#6b7280'}20`, color: TYPE_COLORS[r.account_type] ?? '#6b7280' }}>{r.account_type}</span>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--accent-green)' }}>{formatCurrency(r.amount, 0)}</td>
                  <td className="px-4 py-3" style={{ color: '#3b82f6' }}>{r.interest_rate.toFixed(2)}%</td>
                  <td className="px-4 py-3" style={{ color: '#a855f7' }}>{formatCurrency(r.amount * r.interest_rate / 100, 0)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{totalCash > 0 ? `${((r.amount / totalCash) * 100).toFixed(1)}%` : '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{r.notes ?? '—'}</td>
                  <td className="px-4 py-3"><button onClick={() => openEdit(r)} className="p-1.5 rounded-md hover:bg-white/10" style={{ color: 'var(--text-muted)' }}><Pencil size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !loading && <div className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Keine Cash-Positionen erfasst</div>}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl shadow-2xl my-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{editing ? 'Konto bearbeiten' : 'Neues Konto'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Bezeichnung</label>
                  <input required className={inputClass} style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Bank / Institut</label>
                  <input className={inputClass} style={inputStyle} value={form.bank ?? ''} onChange={e => set('bank', e.target.value || null)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Kontotyp</label>
                  <select className={inputClass} style={inputStyle} value={form.account_type} onChange={e => set('account_type', e.target.value)}>
                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Betrag (€)</label>
                  <input type="number" step="any" required className={inputClass} style={inputStyle} value={form.amount || ''} onChange={e => set('amount', parseFloat(e.target.value) || 0)} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Zinssatz (%)</label>
                  <input type="number" step="any" className={inputClass} style={inputStyle} value={form.interest_rate || ''} onChange={e => set('interest_rate', parseFloat(e.target.value) || 0)} /></div>
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
