import { NextRequest, NextResponse } from 'next/server'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const cache = new Map<string, { price: number; ts: number }>()

async function fetchYahooPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const data = await res.json()
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    return typeof price === 'number' ? price : null
  } catch {
    return null
  }
}

async function fetchCoinGeckoPrice(coinId: string): Promise<number | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=eur`
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) return null
    const data = await res.json()
    return data?.[coinId]?.eur ?? null
  } catch {
    return null
  }
}

// Map GF-Ticker to CoinGecko ID
const COINGECKO_MAP: Record<string, string> = {
  BTCEUR: 'bitcoin',
  ETHEUR: 'ethereum',
  LTCEUR: 'litecoin',
  XRPEUR: 'ripple',
  BNBEUR: 'binancecoin',
  SOLANEUR: 'solana',
  ADAEUR: 'cardano',
  DOTEUR: 'polkadot',
  LINKEUR: 'chainlink',
  MATICEUR: 'matic-network',
  AVAXEUR: 'avalanche-2',
  UNIEUR: 'uniswap',
}

const CRYPTO_TICKERS = new Set(Object.keys(COINGECKO_MAP))

export async function GET(req: NextRequest) {
  const tickers = req.nextUrl.searchParams.get('tickers')?.split(',').filter(Boolean) ?? []
  if (tickers.length === 0) return NextResponse.json({ quotes: {}, lastUpdated: null })

  const quotes: Record<string, number> = {}
  let anyFresh = false

  await Promise.all(
    tickers.map(async (ticker) => {
      const cached = cache.get(ticker)
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        quotes[ticker] = cached.price
        return
      }

      let price: number | null = null
      if (CRYPTO_TICKERS.has(ticker)) {
        const coinId = COINGECKO_MAP[ticker]
        price = await fetchCoinGeckoPrice(coinId)
      } else {
        // Try Yahoo Finance with .DE suffix first, then raw
        price = await fetchYahooPrice(ticker)
      }

      if (price != null) {
        cache.set(ticker, { price, ts: Date.now() })
        quotes[ticker] = price
        anyFresh = true
      } else if (cached) {
        quotes[ticker] = cached.price
      }
    })
  )

  return NextResponse.json({
    quotes,
    lastUpdated: new Date().toISOString(),
    fresh: anyFresh,
  })
}
