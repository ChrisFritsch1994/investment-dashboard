'use client'

import { useState, useCallback } from 'react'

export type Period = 'ytd' | '1y' | '3y' | '5y' | 'alltime'
export type PriceHistory = Record<string, { date: string; close: number }[]>

export function useHistory() {
  const [history, setHistory] = useState<PriceHistory>({})
  const [loading, setLoading] = useState(false)

  const fetchHistory = useCallback(async (tickers: string[], period: Period) => {
    if (tickers.length === 0) return
    setLoading(true)
    try {
      const res = await fetch(`/api/history?tickers=${tickers.join(',')}&period=${period}`)
      const data: PriceHistory = await res.json()
      setHistory(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  return { history, loading, fetchHistory }
}
