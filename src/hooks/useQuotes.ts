'use client'

import { useState, useCallback } from 'react'

export function useQuotes() {
  const [quotes, setQuotes] = useState<Record<string, number>>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchQuotes = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return
    setLoading(true)
    try {
      const res = await fetch(`/api/quotes?tickers=${tickers.join(',')}`)
      const data = await res.json()
      setQuotes(data.quotes ?? {})
      if (data.lastUpdated) setLastUpdated(new Date(data.lastUpdated))
    } catch {
      // keep stale data
    } finally {
      setLoading(false)
    }
  }, [])

  return { quotes, lastUpdated, loading, fetchQuotes }
}
