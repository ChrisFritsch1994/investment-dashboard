'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { calculatePositions } from '@/lib/calculations'
import type { Transaction, Security, Cashflow, Position, PortfolioSummary, Strategy } from '@/lib/types'

export function usePortfolio() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [securities, setSecurities] = useState<Security[]>([])
  const [cashflows, setCashflows] = useState<Cashflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [txRes, secRes, cfRes] = await Promise.all([
        supabase.from('transactions').select('*, security:securities(*)').order('date'),
        supabase.from('securities').select('*'),
        supabase.from('cashflows').select('*').order('date'),
      ])
      if (txRes.error) throw txRes.error
      if (secRes.error) throw secRes.error
      if (cfRes.error) throw cfRes.error
      setTransactions((txRes.data ?? []) as unknown as Transaction[])
      setSecurities(secRes.data ?? [])
      setCashflows((cfRes.data ?? []) as unknown as Cashflow[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { transactions, securities, cashflows, loading, error, reload: load }
}

export function computeSummary(
  transactions: Transaction[],
  securities: Security[],
  cashflows: Cashflow[],
  quotes: Record<string, number>
): PortfolioSummary {
  const positions = calculatePositions(transactions, securities, quotes)

  const openPositions = positions.filter(p => p.shares > 0.0001)
  const totalInvested = openPositions.reduce((s, p) => s + p.totalInvested, 0)
  const currentValue = openPositions.reduce((s, p) => s + (p.currentValue ?? p.totalInvested), 0)
  const unrealizedPnL = currentValue - totalInvested
  const realizedPnL = positions.reduce((s, p) => s + p.realizedPnL, 0)
  const totalReturn = unrealizedPnL + realizedPnL
  // Denominator: Summe aller jemals investierten Kaufbeträge (wie Excel: Gesamtrendite = G/V / Summe Käufe)
  const totalEverInvested = transactions
    .filter(tx => tx.type === 'Kauf')
    .reduce((s, tx) => s + tx.amount, 0)
  const totalReturnPct = totalEverInvested > 0 ? (totalReturn / totalEverInvested) * 100 : 0

  const ytdReturn: number | null = null

  // By strategy
  const strategies: Strategy[] = ['Basis', 'Saisonalitäten', 'Aktien-Trading', 'Krypto']
  const byStrategy = Object.fromEntries(
    strategies.map(s => [s, { invested: 0, value: 0, pnl: 0 }])
  ) as Record<Strategy, { invested: number; value: number; pnl: number }>

  for (const p of openPositions) {
    const s = p.security.strategy
    if (byStrategy[s]) {
      byStrategy[s].invested += p.totalInvested
      byStrategy[s].value += p.currentValue ?? p.totalInvested
      byStrategy[s].pnl += p.unrealizedPnL ?? 0
    }
  }
  // Add realized P&L per strategy
  for (const p of positions) {
    const s = p.security.strategy
    if (byStrategy[s]) byStrategy[s].pnl += p.realizedPnL
  }

  return {
    totalInvested,
    currentValue,
    unrealizedPnL,
    realizedPnL,
    totalReturn,
    totalReturnPct,
    xirr: null,
    ytdReturn,
    positions,
    byStrategy,
    lastUpdated: null,
  }
}
