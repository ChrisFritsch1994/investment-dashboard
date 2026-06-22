'use client'

import { useEffect, useState, useMemo } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
import { usePortfolio, computeSummary } from '@/hooks/usePortfolio'
import { useQuotes } from '@/hooks/useQuotes'
import { useHistory, type Period, type PriceHistory } from '@/hooks/useHistory'
import { formatCurrency, formatPercent } from '@/lib/format'
import { buildTWRRSeries, calculateTWRR, normalizeSeries, historyToSeries, downsample } from '@/lib/twrr'
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
]

const MSCI_TICKER = 'EUNL.DE'

function getPeriodDates(period: Period): { start: Date; end: Date } {
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
  }
  return { start, end }
}

function getMsciPrice(priceMap: Record<string, number>, date: string): number | null {
  for (let i = 0; i <= 5; i++) {
    const d = new Date(date)
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().slice(0, 10)
    if (priceMap[ds] != null) return priceMap[ds]
  }
  return null
}

export default function DashboardPage() {
  const { transactions, securities, cashflows, loading, error, reload } = usePortfolio()
  const { quotes, lastUpdated, loading: quotesLoading, fetchQuotes } = useQuotes()
  const { history, loading: historyLoading, fetchHistory } = useHistory()
  const [summary, setSummary] = useState<ReturnType<typeof computeSummary> | null>(null)
  const [period, setPeriod] = useState<Period>('1y')
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const [msciFullHistory, setMsciFullHistory] = useState<PriceHistory>({})

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

  // Fetch MSCI World history once with 5y to cover all cashflow dates
  useEffect(() => {
    fetch(`/api/history?tickers=${MSCI_TICKER}&period=5y`)
      .then(r => r.json())
      .then(setMsciFullHistory)
      .catch(() => {})
  }, [])

  // Hypothetical MSCI XIRR: simulate investing each Einzahlung into MSCI World
  const msciXirr = useMemo(() => {
    const prices = msciFullHistory[MSCI_TICKER] ?? []
    if (prices.length === 0 || cashflows.length === 0) return null

    const priceMap: Record<string, number> = {}
    for (const p of prices) priceMap[p.date] = p.close

    const todayStr = new Date().toISOString().slice(0, 10)
    const currentPrice = getMsciPrice(priceMap, todayStr)
    if (!currentPrice) return null

    let totalUnits = 0
    const flows: { date: Date; amount: number }[] = []

    for (const cf of cashflows) {
      if (cf.category !== 'Einzahlung') continue
      const price = getMsciPrice(priceMap, cf.date)
      if (!price) continue
      const amount = Math.abs(Number(cf.amount))
      totalUnits += amount / price
      flows.push({ date: new Date(cf.date), amount: -amount })
    }

    if (totalUnits === 0 || flows.length === 0) return null

    const hypotheticalValue = totalUnits * currentPrice
    flows.push({ date: new Date(), amount: hypotheticalValue })
    flows.sort((a, b) => a.date.getTime() - b.date.getTime())

    const raw = calculateXIRR(flows)
    return raw != null ? raw * 100 : null
  }, [msciFullHistory, cashflows])

  const handleRefresh = () => {
    const tickers = securities.map(s => s.gf_ticker ?? s.ticker).filter(Boolean)
    fetchQuotes(tickers)
    reload()
  }

  const { portfolioSeries, msciSeries, twrr } = useMemo(() => {
    if (transactions.length === 0 || Object.keys(history).length === 0) {
      return { portfolioSeries: [], msciSeries: [], twrr: null }
    }

    const { start, end } = getPeriodDates(period)

    const rawPortfolio = buildTWRRSeries(transactions, securities, history, start, end)
    const rawMsci = historyToSeries(history[MSCI_TICKER] ?? [], start, end)

    const twrrValue = calculateTWRR(transactions, securities, history, start, end)

    // Align both series to the same start date for fair comparison
    const firstPortDate = rawPortfolio[0]?.date ?? ''
    const firstMsciDate = rawMsci[0]?.date ?? ''
    const commonStart = firstPortDate > firstMsciDate ? firstPortDate : firstMsciDate

    const portFiltered = rawPortfolio.filter(p => p.date >= commonStart)
    const msciFiltered = rawMsci.filter(p => p.date >= commonStart)

    return {
      portfolioSeries: normalizeSeries(downsample(portFiltered, 300)),
      msciSeries: normalizeSeries(downsample(msciFiltered, 300)),
      twrr: twrrValue,
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
          label="XIRR p.a."
          value={s?.xirr != null ? formatPercent(s.xirr) : '—'}
          positive={s?.xirr != null ? s.xirr >= 0 : null}
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
      {(s?.xirr != null || msciXirr != null) && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
            Vergleich: Mein Portfolio vs. MSCI World ETF
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            XIRR p.a. auf Basis deiner tatsächlichen Einzahlungen — hypothetisch: selbe Beträge, selbe Zeitpunkte, aber in MSCI World angelegt
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg p-4" style={{ background: '#0d1117', border: '1px solid var(--border)' }}>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Mein Portfolio (XIRR p.a.)</div>
              <div className="text-3xl font-bold" style={{ color: s?.xirr != null && s.xirr >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {s?.xirr != null ? formatPercent(s.xirr) : '—'}
              </div>
            </div>
            <div className="rounded-lg p-4" style={{ background: '#0d1117', border: '1px solid var(--border)' }}>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>MSCI World ETF (hypothetisch)</div>
              <div className="text-3xl font-bold" style={{ color: msciXirr != null && msciXirr >= 0 ? '#3b82f6' : 'var(--accent-red)' }}>
                {msciXirr != null ? formatPercent(msciXirr) : '—'}
              </div>
            </div>
          </div>
          {s?.xirr != null && msciXirr != null && (
            <div className="mt-3 rounded-lg px-4 py-3 text-sm" style={{
              background: s.xirr >= msciXirr ? 'rgba(132,204,22,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${s.xirr >= msciXirr ? 'rgba(132,204,22,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {s.xirr >= msciXirr
                  ? `✓ Du schlägst den MSCI World um ${formatPercent(s.xirr - msciXirr)} p.a.`
                  : `✗ Der MSCI World schlägt dich um ${formatPercent(msciXirr - s.xirr)} p.a. — eine reine ETF-Strategie wäre bisher besser gewesen.`}
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
