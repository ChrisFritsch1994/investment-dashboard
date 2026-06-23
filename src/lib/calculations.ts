import type { Transaction, Position, Security } from './types'

// Excel serial date to JS Date
export function excelDateToDate(serial: number): Date {
  const utc_days = Math.floor(serial - 25569)
  return new Date(utc_days * 86400 * 1000)
}

// Calculate positions using average cost method.
// Grouped by ticker+strategy so a security traded in multiple strategies
// (e.g. SXRV.DE in both Basis and Saisonalitäten) is tracked separately per strategy.
export function calculatePositions(
  transactions: Transaction[],
  securities: Security[],
  quotes: Record<string, number>
): Position[] {
  const byKey = new Map<string, {
    security: Security
    strategy: string
    shares: number
    totalCost: number
    realizedPnL: number
    // shortProceeds tracks proceeds received from short sells (shares < 0)
    shortProceeds: number
    limitPrice: number | null
    stopLimitPrice: number | null
  }>()

  const secMap = new Map(securities.map(s => [s.id, s]))

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  for (const tx of sorted) {
    const sec = tx.security_id ? secMap.get(tx.security_id) : null
    if (!sec) continue

    // Use transaction strategy (not security strategy) as the grouping key
    // so the same ticker traded in different strategies is tracked separately
    const key = `${sec.ticker}::${tx.strategy}`
    if (!byKey.has(key)) {
      // Clone security with strategy overridden to the transaction's strategy
      const secWithStrategy: Security = { ...sec, strategy: tx.strategy as Security['strategy'] }
      byKey.set(key, { security: secWithStrategy, strategy: tx.strategy, shares: 0, totalCost: 0, realizedPnL: 0, shortProceeds: 0, limitPrice: null, stopLimitPrice: null })
    }
    const pos = byKey.get(key)!

    if (tx.type === 'Kauf') {
      if (pos.shares < -0.0001) {
        // Covering a short position: buy to close short
        const sharesToCover = Math.min(tx.shares, -pos.shares)
        const feeForCover = tx.shares > 0 ? tx.fees * (sharesToCover / tx.shares) : 0
        const avgShortProceeds = -pos.shares > 0 ? pos.shortProceeds / (-pos.shares) : 0
        const coverCost = sharesToCover * tx.price + feeForCover
        pos.realizedPnL += avgShortProceeds * sharesToCover - coverCost
        pos.shortProceeds -= avgShortProceeds * sharesToCover
        pos.shares += sharesToCover
        // If more shares bought than needed to cover, open a long position with the remainder
        const remainingBuy = tx.shares - sharesToCover
        if (remainingBuy > 0.0001) {
          const remainingFees = tx.fees * (remainingBuy / tx.shares)
          pos.shares += remainingBuy
          pos.totalCost += remainingBuy * tx.price + remainingFees
        }
        pos.limitPrice = tx.limit_price ?? null
        pos.stopLimitPrice = tx.stop_limit_price ?? null
      } else {
        pos.shares += tx.shares
        pos.totalCost += tx.shares * tx.price + tx.fees
        // Track limit/stop from most recent Kauf
        pos.limitPrice = tx.limit_price ?? null
        pos.stopLimitPrice = tx.stop_limit_price ?? null
      }
    } else if (tx.type === 'Verkauf') {
      if (pos.shares >= 0.0001) {
        // Normal long sell
        const avgCost = pos.totalCost / pos.shares
        const proceeds = tx.shares * tx.price - tx.fees - tx.taxes
        const costBasis = tx.shares * avgCost
        pos.realizedPnL += proceeds - costBasis
        pos.shares -= tx.shares
        pos.totalCost -= tx.shares * avgCost
        if (pos.shares < 0.0001) {
          pos.shares = 0
          pos.totalCost = 0
        }
      } else {
        // Opening or adding to short position (Leerverkauf)
        const proceeds = tx.shares * tx.price - tx.fees - tx.taxes
        pos.shortProceeds += proceeds
        pos.shares -= tx.shares  // becomes (more) negative
      }
    }
  }

  const positions: Position[] = []
  for (const [, pos] of byKey) {
    if (pos.shares < 0.0001 && pos.realizedPnL === 0) continue
    const avgCost = pos.shares > 0 ? pos.totalCost / pos.shares : 0
    const currentPrice = quotes[pos.security.gf_ticker ?? pos.security.ticker] ?? null
    const currentValue = currentPrice != null ? pos.shares * currentPrice : null
    const unrealizedPnL = currentValue != null ? currentValue - pos.totalCost : null
    const unrealizedPnLPct = unrealizedPnL != null && pos.totalCost > 0
      ? (unrealizedPnL / pos.totalCost) * 100
      : null

    positions.push({
      security: pos.security,
      shares: pos.shares,
      avgCost,
      totalInvested: pos.totalCost,
      currentPrice,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPct,
      realizedPnL: pos.realizedPnL,
      limitPrice: pos.limitPrice,
      stopLimitPrice: pos.stopLimitPrice,
    })
  }

  return positions.sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))
}

// XIRR calculation — Newton-Raphson with multiple starting guesses for robustness
export function calculateXIRR(
  cashflows: { date: Date; amount: number }[]
): number | null {
  if (cashflows.length < 2) return null

  const t0 = cashflows[0].date.getTime()
  const times = cashflows.map(cf => (cf.date.getTime() - t0) / (365.25 * 24 * 3600 * 1000))

  function npv(rate: number): number {
    return cashflows.reduce((sum, cf, i) => sum + cf.amount / Math.pow(1 + rate, times[i]), 0)
  }

  function npvD(rate: number): number {
    return cashflows.reduce((sum, cf, i) =>
      sum - times[i] * cf.amount / Math.pow(1 + rate, times[i] + 1), 0)
  }

  function newtonSolve(guess: number): number | null {
    let rate = guess
    for (let i = 0; i < 200; i++) {
      const n = npv(rate)
      const d = npvD(rate)
      if (!isFinite(n) || !isFinite(d) || Math.abs(d) < 1e-12) return null
      const next = rate - n / d
      if (!isFinite(next) || next <= -1) return null
      if (Math.abs(next - rate) < 1e-8) return next
      rate = next
    }
    return null
  }

  const totalOut = cashflows.filter(cf => cf.amount < 0).reduce((s, cf) => s + Math.abs(cf.amount), 0)
  const totalIn  = cashflows.filter(cf => cf.amount > 0).reduce((s, cf) => s + cf.amount, 0)
  const netPositive = totalIn > totalOut

  // Try positive guesses first when portfolio is net positive to avoid spurious negative roots
  const guesses = netPositive
    ? [0.1, 0.5, 0.01, 2.0, -0.1, -0.5]
    : [0.1, 0.5, -0.1, 0.01, 2.0, -0.5]

  for (const guess of guesses) {
    const result = newtonSolve(guess)
    if (result !== null && result > -1 && isFinite(result)) {
      if (Math.abs(npv(result)) < 1.0) return result
    }
  }
  return null
}

// Build XIRR cashflows from deposits/withdrawals + current portfolio value
// Convention: outflow (Einzahlung = money you put in) = negative
//             inflow  (Auszahlung = money you take out) = positive
// Amounts in DB may be stored with any sign, so we use Math.abs() for safety.
export function buildXIRRCashflows(
  cashflows: { date: string; amount: number; category: string }[],
  currentValue: number
): { date: Date; amount: number }[] {
  const flows: { date: Date; amount: number }[] = []

  for (const cf of cashflows) {
    if (cf.category === 'Einzahlung') {
      flows.push({ date: new Date(cf.date), amount: -Math.abs(cf.amount) })
    } else if (cf.category === 'Auszahlung') {
      flows.push({ date: new Date(cf.date), amount: +Math.abs(cf.amount) })
    }
  }

  flows.push({ date: new Date(), amount: currentValue })
  flows.sort((a, b) => a.date.getTime() - b.date.getTime())
  return flows
}

// CAGR
export function calculateCAGR(startValue: number, endValue: number, years: number): number | null {
  if (startValue <= 0 || years <= 0) return null
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100
}

// Performance stats from closed trades
export function calculateTradeStats(transactions: Transaction[], positions: Position[]) {
  // Find closed trades (Verkauf transactions with realized P&L)
  const closedTrades: { pnl: number; pnlPct: number }[] = []

  const byTicker = new Map<string, { shares: number; totalCost: number }>()

  for (const pos of positions) {
    byTicker.set(pos.security.ticker, { shares: 0, totalCost: 0 })
  }

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  for (const tx of sorted) {
    if (!tx.security) continue
    const key = tx.security.ticker
    if (!byTicker.has(key)) byTicker.set(key, { shares: 0, totalCost: 0 })
    const pos = byTicker.get(key)!

    if (tx.type === 'Kauf') {
      pos.shares += tx.shares
      pos.totalCost += tx.shares * tx.price + tx.fees
    } else if (tx.type === 'Verkauf') {
      const avgCost = pos.shares > 0 ? pos.totalCost / pos.shares : 0
      const proceeds = tx.shares * tx.price - tx.fees - tx.taxes
      const costBasis = tx.shares * avgCost
      const pnl = proceeds - costBasis
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0
      closedTrades.push({ pnl, pnlPct })
      pos.shares -= tx.shares
      pos.totalCost -= tx.shares * avgCost
    }
  }

  if (closedTrades.length === 0) return null

  const winners = closedTrades.filter(t => t.pnl > 0)
  const losers = closedTrades.filter(t => t.pnl <= 0)
  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0))

  return {
    total: closedTrades.length,
    winners: winners.length,
    losers: losers.length,
    winRate: (winners.length / closedTrades.length) * 100,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    avgWinner: winners.length > 0 ? grossProfit / winners.length : 0,
    avgLoser: losers.length > 0 ? grossLoss / losers.length : 0,
    bestTrade: Math.max(...closedTrades.map(t => t.pnl)),
    worstTrade: Math.min(...closedTrades.map(t => t.pnl)),
  }
}
