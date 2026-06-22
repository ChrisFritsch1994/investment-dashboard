'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError('Falsches Passwort')
      }
    } catch {
      setError('Verbindungsfehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 space-y-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="text-center space-y-1">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(132,204,22,0.1)', border: '1px solid rgba(132,204,22,0.2)' }}
          >
            <Lock size={22} style={{ color: 'var(--accent-green)' }} />
          </div>
          <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Portfolio Dashboard
          </div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Bitte Passwort eingeben
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Passwort"
              autoFocus
              className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'var(--bg-base)',
                border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border)'}`,
                color: 'var(--text-primary)',
              }}
              onFocus={e => {
                if (!error) e.currentTarget.style.borderColor = 'rgba(132,204,22,0.5)'
              }}
              onBlur={e => {
                if (!error) e.currentTarget.style.borderColor = 'var(--border)'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: 'var(--text-muted)' }}
              tabIndex={-1}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div className="text-xs text-center" style={{ color: 'var(--accent-red)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent-green)', color: '#0a0a0a' }}
          >
            {loading ? 'Prüfe…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
