'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, TrendingUp, Calendar, BarChart2, Bitcoin,
  ArrowLeftRight, Wallet, Menu, X, ChevronRight
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Übersicht', icon: LayoutDashboard },
  { href: '/basis', label: 'Basis', icon: TrendingUp, sub: 'ETF Buy & Hold' },
  { href: '/saisonalitaeten', label: 'Saisonalitäten', icon: Calendar },
  { href: '/aktien-trading', label: 'Aktien-Trading', icon: BarChart2 },
  { href: '/krypto', label: 'Krypto', icon: Bitcoin },
  { href: '/transaktionen', label: 'Transaktionen', icon: ArrowLeftRight },
  { href: '/cashflow', label: 'Cashflow', icon: Wallet },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg lg:hidden"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}
      >
        <Menu size={20} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          w-64 flex flex-col h-full
          transform transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>
              PORTFOLIO
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Dashboard
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-4 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon, sub }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group"
                style={{
                  background: active ? 'rgba(132,204,22,0.1)' : 'transparent',
                  color: active ? 'var(--accent-green)' : 'var(--text-secondary)',
                }}
              >
                <Icon size={18} className={active ? '' : 'opacity-60'} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{label}</div>
                  {sub && (
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {sub}
                    </div>
                  )}
                </div>
                {active && <ChevronRight size={14} />}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Privates Investment-Tracking
          </div>
        </div>
      </aside>
    </>
  )
}
