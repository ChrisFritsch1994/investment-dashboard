'use client'

import { useEffect, useState, useMemo } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
import { usePortfolio, computeSummary } from '@/hooks/usePortfolio'
import { useQuotes } from '@/hooks/useQuotes'
import { useHistory, type Period } from '@/hooks/useHistory'
import { formatCurrency, formatPercent } from '@/lib/format'
import { buildTWRRSeries, buildPortfolioSeries, calculateTWRR, normalizeSeries, historyToSeries, downsample } from '@/lib/twrr'
import { calculateXIRR } from '@/lib/calculations'
import KpiCard from '@/components/KpiCard'
import DonutChart from '@/components/DonutChart'
import StrategyBarChart from '@/components/StrategyBarChart'
import PositionsTable from '@/components/PositionsTable'
import PerformanceChart from '@/components/PerformanceChart'

const PERIODS: { label: string; value: Period }[] = [
  { label: 'YTD', value: 'ytd' },
  { label: '1 Jahr', value: '1y' },
  { label: '3 Jahre', value: '3y' },
  { label: '5 Jahre', value: '5y' },
  { label: 'Alltime', value: 'alltime' },
]

const MSCI_TICKER = 'EUNL.DE'

function getPeriodDates(period: Period, firstTxDate?: string): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()
  switch (period) {
    case 'ytd':
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      break
    case '1y':
      start.setFullYear(start.getFullYear() - 1)
      break
    case '3y':
      start.setFullYear(start.getFullYear() - 3)
      break
    case '5y':
      start.setFullYear(start.getFullYear() - 5)
      break
    case 'alltime':
      // Start from first transaction date, or 10 years ago as fallback
      if (firstTxDate) {
        return { start: new Date(firstTxDate), end }
      }
      start.setFullYear(start.getFullYear() - 10)
      break
  }
  return { start, end }
}

export default function DashboardPage() {
  const { transactions, securities, cashflows, loading, error, reload } = usePortfolio()
  const { quotes, lastUpdated, loading: quotesLoading, fetchQuotes } = useQuotes()
  const { history, loading: historyLoading, fetchHistory } = useHistory()
  const [summary, setSummary] = useState<ReturnType<typeof computeSummary> | null>(null)
  const [period, setPeriod] = useState<Period>('1y')
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)

  useEffect(() => {
    if (securities.length === 0) return
    const tickers = securities.map(s => s.gf_ticker ?? s.ticker).filter(Boolean)
    fetchQuotes(tickers)
  }, [securities, fetchQuotes])

  useEffect(() => {
    if (securities.length === 0) return
    const tickers = [
      ...securities.map(s => s.gf_ticker ?? s.ticker).filter(Boolean),
      MSCI_TICKER,
    ]
    fetchHistory(tickers, period)
  }, [securities, period, fetchHistory])

  useEffect(() => {
    if (transactions.length === 0 && !loading) {
      setSummary(computeSummary([], securities, cashflows, quotes))
      return
    }
    if (transactions.length > 0) {
      setSummary(computeSummary(transactions, securities, cashflows, quotes))
    }
  }, [transactions, securities, cashflows, quotes, loading])


  const periodXirr = useMemo(() => {
    if (!summary || summary.currentValue <= 0) return null

    const firstTxDate = transactions.length > 0
      ? [...transactions].sort((a, b) => a.date.localeCompare(b.date))[0].date
      : undefined
    const { start } = getPeriodDates(period, firstTxDate)

    const flows: { date: Date; amount: number }[] = []

    if (period === 'alltime') {
      // All Einzahlungen/Auszahlungen — single sign change, no spurious roots
      for (const cf of cashflows) {
        if (cf.category === 'Einzahlung') flows.push({ date: new Date(cf.date), amount: -Math.abs(Number(cf.amount)) })
        else if (cf.category === 'Auszahlung') flows.push({ date: new Date(cf.date), amount: Math.abs(Number(cf.amount)) })
      }
      // No cashflow records → only Kauf as outflows (keeps single sign change)
      if (flows.length === 0) {
        for (const tx of transactions.filter(t => t.type === 'Kauf')) {
          flows.push({ date: new Date(tx.date), amount: -tx.amount })
        }
      }
    } else {
      // Sub-period: find portfolio value at the FIRST available date at/after period start
      // within the loaded history (avoids the out-of-range issue with dayBefore).
      // That date becomes the "opening entry cost"; cashflows strictly AFTER it are added.
      if (Object.keys(history).length === 0) return null

      const lookAheadEnd = new Date(start.getTime() + 7 * 24 * 3600 * 1000)
      const series = buildPortfolioSeries(transactions, securities, history, start, lookAheadEnd)
      const startEntry = series[0]

      if (!startEntry) return null // no priceable holdings in this period

      const openingDateStr = startEntry.date
      flows.push({ date: new Date(openingDateStr), amount: -startEntry.value })

      // Cashflows strictly AFTER the opening date (that date's value already captures them)
      for (const cf of cashflows) {
        const cfDate = cf.date.slice(0, 10)
        if (cfDate <= openingDateStr) continue
        if (cf.category === 'Einzahlung') flows.push({ date: new Date(cfDate), amount: -Math.abs(Number(cf.amount)) })
        else if (cf.category === 'Auszahlung') flows.push({ date: new Date(cfDate), amount: Math.abs(Number(cf.amount)) })
      }
    }

    if (flows.length === 0) return null
    flows.push({ date: new Date(), amount: summary.currentValue })
    flows.sort((a, b) => a.date.getTime() - b.date.getTime())
    if (flows.length < 2) return null

    const totalOutflows = flows.filter(f => f.amount < 0).reduce((s, f) => s + Math.abs(f.amount), 0)
    const totalInflows  = flows.filter(f => f.amount > 0).reduce((s, f) => s + f.amount, 0)

    const raw = calculateXIRR(flows)
    if (raw == null) return null
    // Reject spurious negative root when portfolio is net positive
    if (raw < 0 && totalInflows > totalOutflows) return null

    return raw * 100
  }, [summary, cashflows, transactions, securities, history, period])

  const handleRefresh = () => {
    const tickers = securities.map(s => s.gf_ticker ?? s.ticker).filter(Boolean)
    fetchQuotes(tickers)
    reload()
  }

  const { portfolioSeries, msciSeries, twrr, msciTwrr } = useMemo(() => {
    if (transactions.length === 0 || Object.keys(history).length === 0) {
      return { portfolioSeries: [], msciSeries: [], twrr: null, msciTwrr: null }
    }

    const firstTxDate = [...transactions].sort((a, b) => a.date.localeCompare(b.date))[0]?.date
    const { start, end } = getPeriodDates(period, firstTxDate)

    const rawPortfolio = buildTWRRSeries(transactions, securities, history, start, end)
    const rawMsci = historyToSeries(history[MSCI_TICKER] ?? [], start, end)

    const twrrValue = calculateTWRR(transactions, securities, history, start, end)

    // Align both series to the same start date for fair comparison
    const firstPortDate = rawPortfolio[0]?.date ?? ''
    const firstMsciDate = rawMsci[0]?.date ?? ''
    const commonStart = firstPortDate > firstMsciDate ? firstPortDate : firstMsciDate

    const portFiltered = rawPortfolio.filter(p => p.date >= commonStart)
    const msciFiltered = rawMsci.filter(p => p.date >= commonStart)

    // MSCI World TWROR over the same aligned period = its price return.
    // An ETF without cash flows has TWRR = (endPrice / startPrice - 1).
    const msciTwrrValue = msciFiltered.length >= 2
      ? (msciFiltered[msciFiltered.length - 1].value / msciFiltered[0].value - 1) * 100
      : null

    return {
      portfolioSeries: normalizeSeries(downsample(portFiltered, 300)),
      msciSeries: normalizeSeries(downsample(msciFiltered, 300)),
      twrr: twrrValue,
      msciTwrr: msciTwrrValue,
    }
  }, [transactions, securities, history, period])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Lade Portfolio…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          Fehler: {error}
        </div>
      </div>
    )
  }

  const s = summary
  const returnPct = s?.totalReturnPct ?? 0
  const isPositive = returnPct >= 0

  const strategyDonut = s
    ? Object.entries(s.byStrategy).map(([name, v]) => ({ name, value: v.value }))
    : []

  const assetClassData = s
    ? (() => {
        const byClass: Record<string, number> = { ETF: 0, Aktie: 0, Krypto: 0 }
        for (const p of s.positions.filter(p => p.shares > 0.0001)) {
          const strat = p.security.strategy
          if (strat === 'Krypto') byClass['Krypto'] += p.currentValue ?? p.totalInvested
          else if (strat === 'Basis') byClass['ETF'] += p.currentValue ?? p.totalInvested
          else byClass['Aktie'] += p.currentValue ?? p.totalInvested
        }
        return Object.entries(byClass).map(([name, value]) => ({ name, value }))
      })()
    : []

  const barData = s
    ? Object.entries(s.byStrategy).map(([name, v]) => ({ name, invested: v.invested, value: v.value }))
    : []

  const periodLabel = PERIODS.find(p => p.value === period)?.label ?? '1 Jahr'

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Portfolio-Übersicht
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {lastUpdated
              ? `Kurse: ${lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
              : 'Kurse werden geladen…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPeriodMenu(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: 'rgba(132,204,22,0.1)',
                color: 'var(--accent-green)',
                border: '1px solid rgba(132,204,22,0.3)',
              }}
            >
              {periodLabel}
              <ChevronDown size={14} />
            </button>
            {showPeriodMenu && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowPeriodMenu(false)}
                />
                <div
                  className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden shadow-2xl z-20"
                  style={{ background: '#111827', border: '1px solid var(--border)', minWidth: '130px' }}
                >
                  {PERIODS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => { setPeriod(p.value); setShowPeriodMenu(false) }}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors"
                      style={{ color: period === p.value ? 'var(--accent-green)' : 'var(--text-secondary)' }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium min-h-[40px]"
            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            title="Kurse aktualisieren"
          >
            <RefreshCw size={14} className={quotesLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Aktualisieren</span>
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Aktueller Depotwert
        </div>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="text-3xl sm:text-5xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(s?.currentValue ?? 0, 0)}
          </div>
          <div
            className="px-3 py-1 rounded-full text-sm font-semibold mb-1"
            style={{
              background: isPositive ? 'rgba(132,204,22,0.15)' : 'rgba(239,68,68,0.15)',
              color: isPositive ? 'var(--accent-green)' : 'var(--accent-red)',
            }}
          >
            {formatPercent(returnPct)}
          </div>
        </div>
        <div className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Investiert: {formatCurrency(s?.totalInvested ?? 0, 0)}
          &nbsp;·&nbsp;Gesamt G/V: {formatCurrency(s?.totalReturn ?? 0, 0)}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Unrealisiert G/V"
          value={formatCurrency(s?.unrealizedPnL ?? 0)}
          positive={s ? s.unrealizedPnL >= 0 : null}
          sub={s && s.totalInvested > 0
            ? formatPercent((s.unrealizedPnL / s.totalInvested) * 100)
            : undefined}
        />
        <KpiCard
          label="Realisiert G/V"
          value={formatCurrency(s?.realizedPnL ?? 0)}
          positive={s ? s.realizedPnL >= 0 : null}
        />
        <KpiCard
          label={`XIRR p.a. (${periodLabel})`}
          value={periodXirr != null ? formatPercent(periodXirr) : '—'}
          positive={periodXirr != null ? periodXirr >= 0 : null}
          sub="Interner Zinsfuß"
        />
        <KpiCard
          label={`TWRR (${periodLabel})`}
          value={twrr != null ? formatPercent(twrr) : historyLoading ? 'Lädt…' : '—'}
          positive={twrr != null ? twrr >= 0 : null}
          sub="Zeitgewichtete Rendite"
        />
      </div>

      {/* MSCI Comparison */}
      {(twrr != null || msciTwrr != null) && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
            Vergleich: Mein Portfolio vs. MSCI World ETF
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Zeitgewichtete Rendite (TWROR) über {periodLabel} — bereinigt um Zu-/Abflüsse, daher fair vergleichbar mit der reinen Kursrendite des MSCI World im selben Zeitraum
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg p-4" style={{ background: '#0d1117', border: '1px solid var(--border)' }}>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Mein Portfolio (TWROR)</div>
              <div className="text-3xl font-bold" style={{ color: twrr != null && twrr >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {twrr != null ? formatPercent(twrr) : '—'}
              </div>
            </div>
            <div className="rounded-lg p-4" style={{ background: '#0d1117', border: '1px solid var(--border)' }}>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>MSCI World ETF (TWROR)</div>
              <div className="text-3xl font-bold" style={{ color: msciTwrr != null && msciTwrr >= 0 ? '#3b82f6' : 'var(--accent-red)' }}>
                {msciTwrr != null ? formatPercent(msciTwrr) : '—'}
              </div>
            </div>
          </div>
          {twrr != null && msciTwrr != null && (
            <div className="mt-3 rounded-lg px-4 py-3 text-sm" style={{
              background: twrr >= msciTwrr ? 'rgba(132,204,22,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${twrr >= msciTwrr ? 'rgba(132,204,22,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {twrr >= msciTwrr
                  ? `✓ Du schlägst den MSCI World um ${formatPercent(twrr - msciTwrr)} (TWROR, ${periodLabel})`
                  : `✗ Der MSCI World schlägt dich um ${formatPercent(msciTwrr - twrr)} (TWROR, ${periodLabel}) — eine reine ETF-Strategie wäre in diesem Zeitraum besser gewesen.`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Performance Chart */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Performance-Vergleich · {periodLabel} · Basis 100
          </h3>
          {historyLoading && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Lade Kursdaten…</span>
          )}
        </div>
        <PerformanceChart portfolioSeries={portfolioSeries} msciSeries={msciSeries} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DonutChart title="Portfolio nach Strategie" data={strategyDonut} />
        <DonutChart title="Portfolio nach Anlageklasse" data={assetClassData} />
        <StrategyBarChart data={barData} />
      </div>

      {/* Positions */}
      {s && <PositionsTable positions={s.positions.filter(p => p.shares > 0.0001)} />}
    </div>
  )
}
