import type { Transaction, Security } from './types'

export type PriceHistory = Record<string, { date: string; close: number }[]>

// Get closest available price on or before a date (up to 5 days back for weekends/holidays)
function getPrice(priceMap: Record<string, number>, dateStr: string): number | null {
  for (let i = 0; i <= 5; i++) {
    const d = new Date(dateStr)
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().slice(0, 10)
    if (priceMap[ds] != null) return priceMap[ds]
  }
  return null
}

function buildPriceMaps(history: PriceHistory): Record<string, Record<string, number>> {
  const maps: Record<string, Record<string, number>> = {}
  for (const [ticker, prices] of Object.entries(history)) {
    maps[ticker] = {}
    for (const p of prices) maps[ticker][p.date] = p.close
  }
  return maps
}

// Holdings map: ticker -> { shares, avgCost }
// avgCost is used as a fallback when no historical price is available
type Holding = { shares: number; avgCost: number }

function applyTransaction(
  holdings: Map<string, Holding>,
  ticker: string,
  type: 'Kauf' | 'Verkauf',
  shares: number,
  price: number,
) {
  const h = holdings.get(ticker) ?? { shares: 0, avgCost: price }
  if (type === 'Kauf') {
    const totalCost = h.shares * h.avgCost + shares * price
    const newShares = h.shares + shares
    holdings.set(ticker, { shares: newShares, avgCost: newShares > 0 ? totalCost / newShares : price })
  } else {
    const newShares = Math.max(0, h.shares - shares)
    holdings.set(ticker, { shares: newShares, avgCost: h.avgCost })
  }
}

// Price a portfolio — falls back to avgCost when no historical price is available
function pricedValue(holdings: Map<string, Holding>, priceMaps: Record<string, Record<string, number>>, dateStr: string): number {
  let total = 0
  for (const [ticker, h] of holdings) {
    if (h.shares <= 0.0001) continue
    const price = priceMaps[ticker] ? getPrice(priceMaps[ticker], dateStr) : null
    total += h.shares * (price ?? h.avgCost)
  }
  return total
}

// Build daily portfolio value series for the given date range.
export function buildPortfolioSeries(
  transactions: Transaction[],
  securities: Security[],
  history: PriceHistory,
  startDate: Date,
  endDate: Date,
): { date: string; value: number }[] {
  const secById = new Map(securities.map(s => [s.id, s]))
  const priceMaps = buildPriceMaps(history)
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  const startStr = startDate.toISOString().slice(0, 10)

  // Build holdings from all transactions before startDate
  const holdings = new Map<string, Holding>()
  let txIdx = 0
  while (txIdx < sorted.length && sorted[txIdx].date < startStr) {
    const tx = sorted[txIdx]
    const sec = tx.security_id ? secById.get(tx.security_id) : null
    if (sec) {
      applyTransaction(holdings, sec.gf_ticker ?? sec.ticker, tx.type, tx.shares, tx.price)
    }
    txIdx++
  }

  const result: { date: string; value: number }[] = []
  const endStr = endDate.toISOString().slice(0, 10)
  const cur = new Date(startDate)

  while (cur.toISOString().slice(0, 10) <= endStr) {
    const dateStr = cur.toISOString().slice(0, 10)

    // Apply all transactions on this date
    while (txIdx < sorted.length && sorted[txIdx].date === dateStr) {
      const tx = sorted[txIdx]
      const sec = tx.security_id ? secById.get(tx.security_id) : null
      if (sec) {
        applyTransaction(holdings, sec.gf_ticker ?? sec.ticker, tx.type, tx.shares, tx.price)
      }
      txIdx++
    }

    const value = pricedValue(holdings, priceMaps, dateStr)
    // Only add days where at least one holding can be priced with real data
    const hasRealPrice = [...holdings.entries()].some(([ticker, h]) => {
      if (h.shares <= 0.0001) return false
      return priceMaps[ticker] ? getPrice(priceMaps[ticker], dateStr) != null : false
    })

    if (value > 0 && hasRealPrice) {
      result.push({ date: dateStr, value })
    }

    cur.setDate(cur.getDate() + 1)
  }

  return result
}

// Calculate TWRR (Time-Weighted Rate of Return).
// Sub-periods defined by transaction dates. Falls back to avgCost for unpriceable holdings.
export function calculateTWRR(
  transactions: Transaction[],
  securities: Security[],
  history: PriceHistory,
  startDate: Date,
  endDate: Date,
): number | null {
  const secById = new Map(securities.map(s => [s.id, s]))
  const priceMaps = buildPriceMaps(history)
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  const startStr = startDate.toISOString().slice(0, 10)
  const endStr = endDate.toISOString().slice(0, 10)

  // Build initial holdings at startDate
  const holdings = new Map<string, Holding>()
  let txIdx = 0
  while (txIdx < sorted.length && sorted[txIdx].date < startStr) {
    const tx = sorted[txIdx]
    const sec = tx.security_id ? secById.get(tx.security_id) : null
    if (sec) {
      applyTransaction(holdings, sec.gf_ticker ?? sec.ticker, tx.type, tx.shares, tx.price)
    }
    txIdx++
  }

  // Collect unique transaction dates within the period
  const cfDates = [
    ...new Set(
      sorted
        .filter(tx => tx.date >= startStr && tx.date < endStr)
        .map(tx => tx.date)
    ),
  ].sort()

  const boundaries = [startStr, ...cfDates, endStr]

  let twrr = 1.0
  const currentHoldings = new Map(holdings)
  let periodTxIdx = txIdx
  let validSubPeriods = 0

  for (let i = 0; i < boundaries.length - 1; i++) {
    const pStart = boundaries[i]
    const pEnd = boundaries[i + 1]

    const vStart = pricedValue(currentHoldings, priceMaps, pStart)
    const vEnd = pricedValue(currentHoldings, priceMaps, pEnd)

    if (vStart > 0 && vEnd > 0) {
      twrr *= vEnd / vStart
      validSubPeriods++
    }

    // Apply transactions at pEnd before next sub-period
    while (periodTxIdx < sorted.length && sorted[periodTxIdx].date === pEnd) {
      const tx = sorted[periodTxIdx]
      const sec = tx.security_id ? secById.get(tx.security_id) : null
      if (sec) {
        applyTransaction(currentHoldings, sec.gf_ticker ?? sec.ticker, tx.type, tx.shares, tx.price)
      }
      periodTxIdx++
    }
  }

  if (validSubPeriods === 0) return null
  const result = (twrr - 1) * 100
  return isFinite(result) ? result : null
}

// Build a time-weighted return series (Basis 100), excluding the effect of
// new cash flows (Käufe/Verkäufe). Each day's return = price change of
// holdings BEFORE applying that day's transactions.
export function buildTWRRSeries(
  transactions: Transaction[],
  securities: Security[],
  history: PriceHistory,
  startDate: Date,
  endDate: Date,
): { date: string; value: number }[] {
  const secById = new Map(securities.map(s => [s.id, s]))
  const priceMaps = buildPriceMaps(history)
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  const startStr = startDate.toISOString().slice(0, 10)
  const endStr = endDate.toISOString().slice(0, 10)

  // Build holdings from transactions BEFORE the period
  const holdings = new Map<string, Holding>()
  let txIdx = 0
  while (txIdx < sorted.length && sorted[txIdx].date < startStr) {
    const tx = sorted[txIdx]
    const sec = tx.security_id ? secById.get(tx.security_id) : null
    if (sec) applyTransaction(holdings, sec.gf_ticker ?? sec.ticker, tx.type, tx.shares, tx.price)
    txIdx++
  }

  const result: { date: string; value: number }[] = []
  let twrrValue = 100
  let prevValue: number | null = null  // portfolio value AFTER previous day's transactions

  const cur = new Date(startDate)
  while (cur.toISOString().slice(0, 10) <= endStr) {
    const dateStr = cur.toISOString().slice(0, 10)

    const hasReal = [...holdings.entries()].some(([ticker, h]) =>
      h.shares > 0.0001 && priceMaps[ticker] != null && getPrice(priceMaps[ticker], dateStr) != null
    )

    // Price BEFORE today's transactions → pure market movement
    const valueBeforeTx = hasReal ? pricedValue(holdings, priceMaps, dateStr) : 0

    // Compound the market return (excludes new cash flows)
    if (prevValue !== null && prevValue > 0 && valueBeforeTx > 0) {
      twrrValue *= valueBeforeTx / prevValue
    }

    // Apply today's transactions
    while (txIdx < sorted.length && sorted[txIdx].date === dateStr) {
      const tx = sorted[txIdx]
      const sec = tx.security_id ? secById.get(tx.security_id) : null
      if (sec) applyTransaction(holdings, sec.gf_ticker ?? sec.ticker, tx.type, tx.shares, tx.price)
      txIdx++
    }

    // Value AFTER transactions = base for next day's return calculation
    const hasRealAfter = [...holdings.entries()].some(([ticker, h]) =>
      h.shares > 0.0001 && priceMaps[ticker] != null && getPrice(priceMaps[ticker], dateStr) != null
    )
    const valueAfterTx = hasRealAfter ? pricedValue(holdings, priceMaps, dateStr) : 0

    if (valueAfterTx > 0) {
      result.push({ date: dateStr, value: Math.round(twrrValue * 100) / 100 })
      prevValue = valueAfterTx
    }

    cur.setDate(cur.getDate() + 1)
  }

  return result
}

// Normalize a value series so the first point = 100
export function normalizeSeries(series: { date: string; value: number }[]): { date: string; value: number }[] {
  if (series.length === 0) return []
  const base = series[0].value
  if (base === 0) return series
  return series.map(p => ({ date: p.date, value: Math.round((p.value / base) * 10000) / 100 }))
}

// Extract a raw price history array into a date-range filtered value series
export function historyToSeries(
  prices: { date: string; close: number }[],
  startDate: Date,
  endDate: Date,
): { date: string; value: number }[] {
  const startStr = startDate.toISOString().slice(0, 10)
  const endStr = endDate.toISOString().slice(0, 10)
  return prices
    .filter(p => p.date >= startStr && p.date <= endStr)
    .map(p => ({ date: p.date, value: p.close }))
}

// Downsample to at most maxPoints, always keeping the last point
export function downsample<T>(series: T[], maxPoints: number): T[] {
  if (series.length <= maxPoints) return series
  const step = Math.ceil(series.length / maxPoints)
  return series.filter((_, i) => i % step === 0 || i === series.length - 1)
}
