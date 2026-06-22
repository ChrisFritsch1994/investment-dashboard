'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, TrendingUp, Calendar, BarChart2, Bitcoin,
  ArrowLeftRight, Wallet, Menu, X, ChevronRight,
  Layers, Home, Briefcase, Gem, Banknote, AlertTriangle,
  ReceiptText,
} from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Übersicht',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Buchführung',
    items: [
      { href: '/transaktionen', label: 'Transaktionen', icon: ArrowLeftRight },
      { href: '/cashflow', label: 'Cashflow', icon: ReceiptText },
    ],
  },
  {
    label: 'Wertpapiere & Krypto',
    items: [
      { href: '/basis', label: 'Basis', icon: TrendingUp, sub: 'ETF Buy & Hold' },
      { href: '/saisonalitaeten', label: 'Saisonalitäten', icon: Calendar },
      { href: '/aktien-trading', label: 'Aktien-Trading', icon: BarChart2 },
      { href: '/krypto', label: 'Krypto', icon: Bitcoin },
      { href: '/optionen', label: 'Optionen', icon: Layers },
    ],
  },
  {
    label: 'Weitere Assets',
    items: [
      { href: '/immobilien', label: 'Immobilien', icon: Home },
      { href: '/firmenbeteiligungen', label: 'Firmenbeteiligungen', icon: Briefcase },
      { href: '/sachwerte', label: 'Sachwerte', icon: Gem },
      { href: '/cash', label: 'Cash & Liquidität', icon: Banknote },
    ],
  },
  {
    label: 'Verbindlichkeiten',
    items: [
      { href: '/verbindlichkeiten', label: 'Verbindlichkeiten', icon: AlertTriangle },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-4 lg:hidden"
        style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-lg"
          style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}
          aria-label="Menü öffnen"
        >
          <Menu size={20} />
        </button>
        <span className="ml-3 text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>
          PORTFOLIO
        </span>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          w-64 flex flex-col h-full overflow-y-auto
          transform transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>PORTFOLIO</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Dashboard</div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 px-3 pb-4 space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, sub }) => {
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
                      <Icon size={16} className={active ? '' : 'opacity-60'} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{label}</div>
                        {sub && <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
                      </div>
                      {active && <ChevronRight size={14} />}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Privates Investment-Tracking</div>
        </div>
      </aside>
    </>
  )
}
