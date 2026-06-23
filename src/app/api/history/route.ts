import { NextRequest, NextResponse } from 'next/server'

const cache = new Map<string, { data: { date: string; close: number }[]; ts: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

const COINGECKO_MAP: Record<string, string> = {
  BTCEUR: 'bitcoin', ETHEUR: 'ethereum', LTCEUR: 'litecoin',
  XRPEUR: 'ripple', BNBEUR: 'binancecoin', SOLANEUR: 'solana',
  ADAEUR: 'cardano', DOTEUR: 'polkadot', LINKEUR: 'chainlink',
  MATICEUR: 'matic-network', AVAXEUR: 'avalanche-2', UNIEUR: 'uniswap',
}

const PERIOD_CONFIG: Record<string, { yahooRange: string; days: number }> = {
  ytd: { yahooRange: 'ytd', days: 365 },
  '1y': { yahooRange: '1y', days: 365 },
  '3y': { yahooRange: '3y', days: 1095 },
  '5y': { yahooRange: '5y', days: 1825 },
  alltime: { yahooRange: 'max', days: 3650 },
}

async function fetchYahooHistory(ticker: string, range: string): Promise<{ date: string; close: number }[] | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const result = json.chart?.result?.[0]
    if (!result) return null
    const timestamps: number[] = result.timestamp ?? []
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? []
    return timestamps
      .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), close: closes[i] }))
      .filter(d => d.close != null && !isNaN(d.close))
  } catch {
    return null
  }
}

async function fetchCoinGeckoHistory(coinId: string, days: number): Promise<{ date: string; close: number }[] | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=eur&days=${days}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const json = await res.json()
    const prices: [number, number][] = json.prices ?? []
    // Deduplicate by date (CoinGecko returns multiple per day for short ranges)
    const byDate = new Map<string, number>()
    for (const [ts, price] of prices) {
      const date = new Date(ts).toISOString().slice(0, 10)
      byDate.set(date, price)
    }
    return [...byDate.entries()].map(([date, close]) => ({ date, close })).sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const tickers = req.nextUrl.searchParams.get('tickers')?.split(',').filter(Boolean) ?? []
  const period = req.nextUrl.searchParams.get('period') ?? '1y'
  const config = PERIOD_CONFIG[period] ?? PERIOD_CONFIG['1y']

  const results: Record<string, { date: string; close: number }[]> = {}

  await Promise.all(tickers.map(async (ticker) => {
    const key = `${ticker}:${period}`
    const cached = cache.get(key)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      results[ticker] = cached.data
      return
    }

    const coinId = COINGECKO_MAP[ticker]
    const data = coinId
      ? await fetchCoinGeckoHistory(coinId, config.days)
      : await fetchYahooHistory(ticker, config.yahooRange)

    if (data && data.length > 0) {
      cache.set(key, { data, ts: Date.now() })
      results[ticker] = data
    }
  }))

  return NextResponse.json(results)
}
