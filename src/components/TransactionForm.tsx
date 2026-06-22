'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Security, Strategy, Transaction, TransactionType } from '@/lib/types'

interface Props {
  securities: Security[]
  onClose: () => void
  onSaved: () => void
  transaction?: Transaction // if provided → edit mode
}

export default function TransactionForm({ securities, onClose, onSaved, transaction }: Props) {
  const isEdit = !!transaction
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    date: transaction?.date ?? today,
    type: transaction?.type ?? ('Kauf' as TransactionType),
    security_id: transaction?.security_id ?? '',
    ticker: transaction?.security?.ticker ?? '',
    name: transaction?.security?.name ?? '',
    isin: transaction?.security?.isin ?? '',
    strategy: transaction?.strategy ?? ('Basis' as Strategy),
    shares: transaction?.shares?.toString() ?? '',
    price: transaction?.price?.toString() ?? '',
    fees: transaction?.fees?.toString() ?? '0',
    taxes: transaction?.taxes?.toString() ?? '0',
    currency: transaction?.currency ?? 'EUR',
    source: transaction?.source ?? '',
    notes: transaction?.notes ?? '',
    limit_price: transaction?.limit_price?.toString() ?? '',
    stop_limit_price: transaction?.stop_limit_price?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const selectedSec = securities.find(s => s.id === form.security_id)
  const amount = (parseFloat(form.shares) || 0) * (parseFloat(form.price) || 0)
    + (parseFloat(form.fees) || 0)

  const handleSecurityChange = (id: string) => {
    const sec = securities.find(s => s.id === id)
    if (sec) {
      setForm(f => ({
        ...f,
        security_id: id,
        ticker: sec.ticker,
        name: sec.name,
        isin: sec.isin ?? '',
        strategy: sec.strategy,
        currency: sec.currency,
      }))
    } else {
      set('security_id', id)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      let secId = form.security_id

      if (!isEdit && !secId && form.ticker) {
        const { data, error: secErr } = await supabase
          .from('securities')
          .insert({
            ticker: form.ticker.toUpperCase(),
            name: form.name,
            isin: form.isin || null,
            strategy: form.strategy,
            currency: form.currency,
          })
          .select()
          .single()
        if (secErr) throw secErr
        secId = data.id
      }

      const shares = parseFloat(form.shares)
      const price = parseFloat(form.price)
      const fees = parseFloat(form.fees) || 0
      const taxes = parseFloat(form.taxes) || 0
      const totalAmount = form.type === 'Kauf'
        ? shares * price + fees
        : shares * price - fees - taxes

      const payload = {
        date: form.date,
        type: form.type,
        security_id: secId || transaction?.security_id,
        shares,
        price,
        fees,
        taxes,
        amount: Math.abs(totalAmount),
        currency: form.currency,
        strategy: form.strategy,
        source: form.source || null,
        notes: form.notes || null,
        limit_price: form.limit_price ? parseFloat(form.limit_price) : null,
        stop_limit_price: form.stop_limit_price ? parseFloat(form.stop_limit_price) : null,
      }

      if (isEdit) {
        const { error: txErr } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', transaction!.id)
        if (txErr) throw txErr
      } else {
        const { error: txErr } = await supabase.from('transactions').insert(payload)
        if (txErr) throw txErr
      }

      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none"
  const inputStyle = {
    background: '#0d1117',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl my-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Transaktion bearbeiten' : 'Neue Transaktion'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Datum</label>
              <input type="date" required className={inputClass} style={inputStyle}
                value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Typ</label>
              <select className={inputClass} style={inputStyle} value={form.type}
                onChange={e => set('type', e.target.value as TransactionType)}>
                <option value="Kauf">Kauf</option>
                <option value="Verkauf">Verkauf</option>
              </select>
            </div>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Wertpapier
              </label>
              <select className={inputClass} style={inputStyle} value={form.security_id}
                onChange={e => handleSecurityChange(e.target.value)}>
                <option value="">— Neues Wertpapier —</option>
                {securities.map(s => (
                  <option key={s.id} value={s.id}>{s.ticker} — {s.name} ({s.strategy})</option>
                ))}
              </select>
            </div>
          )}

          {isEdit && (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#0d1117', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Wertpapier: </span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {transaction?.security?.ticker} — {transaction?.security?.name}
              </span>
            </div>
          )}

          {!isEdit && !form.security_id && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Ticker</label>
                <input type="text" required className={inputClass} style={inputStyle} placeholder="z.B. AAPL"
                  value={form.ticker} onChange={e => set('ticker', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Name</label>
                <input type="text" required className={inputClass} style={inputStyle}
                  value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>ISIN</label>
                <input type="text" className={inputClass} style={inputStyle}
                  value={form.isin} onChange={e => set('isin', e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Strategie</label>
              <select className={inputClass} style={inputStyle} value={form.strategy}
                onChange={e => set('strategy', e.target.value as Strategy)}
                disabled={!isEdit && !!selectedSec}>
                <option value="Basis">Basis</option>
                <option value="Saisonalitäten">Saisonalitäten</option>
                <option value="Aktien-Trading">Aktien-Trading</option>
                <option value="Krypto">Krypto</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Währung</label>
              <select className={inputClass} style={inputStyle} value={form.currency}
                onChange={e => set('currency', e.target.value)}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Anzahl</label>
              <input type="number" required step="any" min="0" className={inputClass} style={inputStyle}
                value={form.shares} onChange={e => set('shares', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Preis (€)</label>
              <input type="number" required step="any" min="0" className={inputClass} style={inputStyle}
                value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Gebühren</label>
              <input type="number" step="any" min="0" className={inputClass} style={inputStyle}
                value={form.fees} onChange={e => set('fees', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Steuern</label>
              <input type="number" step="any" min="0" className={inputClass} style={inputStyle}
                value={form.taxes} onChange={e => set('taxes', e.target.value)} />
            </div>
          </div>

          {/* Limit / Stop-Limit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Limit (Kursziel) €
              </label>
              <input type="number" step="any" min="0" className={inputClass} style={inputStyle}
                value={form.limit_price} onChange={e => set('limit_price', e.target.value)}
                placeholder="— optional —" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Stop-Limit (Stop-Loss) €
              </label>
              <input type="number" step="any" min="0" className={inputClass} style={inputStyle}
                value={form.stop_limit_price} onChange={e => set('stop_limit_price', e.target.value)}
                placeholder="— optional —" />
            </div>
          </div>

          <div
            className="rounded-lg px-4 py-3 flex items-center justify-between"
            style={{ background: '#0d1117', border: '1px solid var(--border)' }}
          >
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Berechneter Betrag</span>
            <span className="text-sm font-bold" style={{ color: 'var(--accent-green)' }}>
              {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Quelle</label>
              <input type="text" className={inputClass} style={inputStyle} placeholder="z.B. Trade Republic"
                value={form.source} onChange={e => set('source', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Notiz</label>
              <input type="text" className={inputClass} style={inputStyle}
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: 'var(--bg-sidebar)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              Abbrechen
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: 'var(--accent-green)', color: '#0a0a0a', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Speichern…' : isEdit ? 'Änderungen speichern' : 'Transaktion speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
