'use client'

import { useEffect, useState } from 'react'
import { usePortfolio, computeSummary } from '@/hooks/usePortfolio'
import { useQuotes } from '@/hooks/useQuotes'
import { formatCurrency, formatPercent, formatDate, formatNumber } from '@/lib/format'
import { calculateTradeStats } from '@/lib/calculations'
import KpiCard from '@/components/KpiCard'
import type { Strategy } from '@/lib/types'

const STRATEGY_COLORS: Record<Strategy, string> = {
  'Basis': '#84cc16',
  'Saisonalitäten': '#3b82f6',
  'Aktien-Trading': '#f59e0b',
  'Krypto': '#a855f7',
}

export default function StrategyPage({ strategy }: { strategy: Strategy }) {
  const { transactions, securities, cashflows, loading } = usePortfolio()
  const { quotes, fetchQuotes } = useQuotes()
  const [summary, setSummary] = useState<ReturnType<typeof computeSummary> | null>(null)

  const filteredTx = transactions.filter(tx => tx.strategy === strategy)
  const filteredSec = securities.filter(s => s.strategy === strategy)

  useEffect(() => {
    if (filteredTx.length === 0) return
    // Derive tickers from transactions, not securities — a security can be traded
    // under a different strategy than its default (e.g. SXRV.DE as Saisonalitäten)
    const secMap = new Map(securities.map(s => [s.id, s]))
    const tickers = [
      ...new Set(
        filteredTx
          .map(tx => tx.security_id ? secMap.get(tx.security_id) : null)
          .filter(Boolean)
          .map(s => s!.gf_ticker ?? s!.ticker)
      )
    ]
    if (tickers.length > 0) fetchQuotes(tickers)
  }, [filteredTx.length, securities.length, fetchQuotes])

  useEffect(() => {
    if (transactions.length > 0) {
      setSummary(computeSummary(filteredTx, securities, cashflows, quotes))
    }
  }, [transactions, securities, quotes])

  const stratData = summary?.byStrategy[strategy]
  const openPositions = summary?.positions.filter(p => p.shares > 0.0001 && p.security.strategy === strategy) ?? []
  const pnlPct = stratData && stratData.invested > 0 ? ((stratData.value - stratData.invested) / stratData.invested) * 100 : 0

  const stats = filteredTx.length > 0
    ? calculateTradeStats(filteredTx, summary?.positions ?? [])
    : null

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: 'var(--text-muted)' }}>Lade…</div></div>
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ background: STRATEGY_COLORS[strategy] }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{strategy}</h1>
        </div>
        <p className="text-sm mt-0.5 ml-6" style={{ color: 'var(--text-muted)' }}>
          {filteredTx.length} Transaktionen · {filteredSec.length} Wertpapiere
        </p>
      </div>

      {/* Hero */}
      <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Aktueller Wert
        </div>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(stratData?.value ?? 0, 0)}
          </div>
          <div
            className="px-3 py-1 rounded-full text-sm font-semibold mb-0.5"
            style={{
              background: pnlPct >= 0 ? 'rgba(132,204,22,0.15)' : 'rgba(239,68,68,0.15)',
              color: pnlPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            }}
          >
            {formatPercent(pnlPct)}
          </div>
        </div>
        <div className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Investiert: {formatCurrency(stratData?.invested ?? 0, 0)}
          &nbsp;·&nbsp;G/V: {formatCurrency(stratData?.pnl ?? 0, 0)}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Investiert" value={formatCurrency(stratData?.invested ?? 0, 0)} />
        <KpiCard label="Unrealisiert G/V" value={formatCurrency(stratData?.pnl ?? 0)}
          positive={stratData ? stratData.pnl >= 0 : null} />
        <KpiCard label="Offene Positionen" value={String(openPositions.length)} />
        <KpiCard label="Trades gesamt" value={String(filteredTx.length)} />
      </div>

      {/* Trade Stats (only if closed trades exist) */}
      {stats && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
            Performance-Qualität (realisierte Trades)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Trefferquote</div>
              <div className="text-xl font-bold mt-1" style={{ color: 'var(--accent-green)' }}>
                {stats.winRate.toFixed(1)} %
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {stats.winners}/{stats.total} Trades
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Profit Factor</div>
              <div className="text-xl font-bold mt-1" style={{ color: stats.profitFactor && stats.profitFactor >= 1 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {stats.profitFactor?.toFixed(2) ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Ø Gewinner</div>
              <div className="text-xl font-bold mt-1" style={{ color: 'var(--accent-green)' }}>
                {formatCurrency(stats.avgWinner)}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Ø Verlierer</div>
              <div className="text-xl font-bold mt-1" style={{ color: 'var(--accent-red)' }}>
                {formatCurrency(-stats.avgLoser)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Bester Trade</div>
              <div className="text-lg font-bold" style={{ color: 'var(--accent-green)' }}>
                {formatCurrency(stats.bestTrade)}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Schlechtester Trade</div>
              <div className="text-lg font-bold" style={{ color: 'var(--accent-red)' }}>
                {formatCurrency(stats.worstTrade)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Open positions */}
      {openPositions.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Offene Positionen</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Wertpapier', 'Stück', 'Ø Kauf', 'Akt. Kurs', 'Investiert', 'Akt. Wert', 'G/V', 'G/V %'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {openPositions.map((p, i) => {
                  const isPos = (p.unrealizedPnL ?? 0) >= 0
                  return (
                    <tr key={p.security.id} style={{ borderBottom: i < openPositions.length - 1 ? '1px solid #111827' : 'none' }}
                      className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.security.ticker}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.security.name}</div>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatNumber(p.shares, 4)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(p.avgCost)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.currentPrice != null ? formatCurrency(p.currentPrice) : '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(p.totalInvested, 0)}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{p.currentValue != null ? formatCurrency(p.currentValue, 0) : '—'}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: isPos ? 'var(--accent-green)' : 'var(--accent-red)' }}>{p.unrealizedPnL != null ? formatCurrency(p.unrealizedPnL) : '—'}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: isPos ? 'var(--accent-green)' : 'var(--accent-red)' }}>{p.unrealizedPnLPct != null ? formatPercent(p.unrealizedPnLPct) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade list */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Alle Transaktionen</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Datum', 'Typ', 'Ticker', 'Stück', 'Preis', 'Betrag'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filteredTx].reverse().map((tx, i) => (
                <tr key={tx.id} style={{ borderBottom: i < filteredTx.length - 1 ? '1px solid #111827' : 'none' }}
                  className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatDate(tx.date)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: tx.type === 'Kauf' ? 'rgba(132,204,22,0.15)' : 'rgba(239,68,68,0.15)', color: tx.type === 'Kauf' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div style={{ color: 'var(--text-primary)' }}>{tx.security?.ticker ?? '—'}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{tx.security?.name}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatNumber(tx.shares, 4)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(tx.price)}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(tx.amount, 0)}</td>
                </tr>
              ))}
              {filteredTx.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Keine Transaktionen</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
