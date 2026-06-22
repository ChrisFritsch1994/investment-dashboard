export type Strategy = 'Basis' | 'Saisonalitäten' | 'Aktien-Trading' | 'Krypto'
export type AssetClass = 'ETF' | 'Aktie' | 'Krypto'
export type TransactionType = 'Kauf' | 'Verkauf'
export type CashflowCategory = 'Einzahlung' | 'Auszahlung' | 'Zinsen' | 'Dividende' | 'Gebühr' | 'Steuererstattung'

export interface Security {
  id: string
  ticker: string
  gf_ticker: string | null
  name: string
  isin: string | null
  currency: string
  strategy: Strategy
  created_at: string
}

export interface Transaction {
  id: string
  date: string
  type: TransactionType
  security_id: string | null
  shares: number
  price: number
  fees: number
  taxes: number
  amount: number
  currency: string
  strategy: Strategy
  source: string | null
  notes: string | null
  limit_price: number | null
  stop_limit_price: number | null
  created_at: string
  security?: Security
}

export interface Cashflow {
  id: string
  date: string
  description: string | null
  amount: number
  category: CashflowCategory
  isin: string | null
  created_at: string
}

export interface Position {
  security: Security
  shares: number
  avgCost: number
  totalInvested: number
  currentPrice: number | null
  currentValue: number | null
  unrealizedPnL: number | null
  unrealizedPnLPct: number | null
  realizedPnL: number
  limitPrice: number | null
  stopLimitPrice: number | null
}

export interface PortfolioSummary {
  totalInvested: number
  currentValue: number
  unrealizedPnL: number
  realizedPnL: number
  totalReturn: number
  totalReturnPct: number
  xirr: number | null
  ytdReturn: number | null
  positions: Position[]
  byStrategy: Record<Strategy, { invested: number; value: number; pnl: number }>
  lastUpdated: Date | null
}

export interface Quote {
  ticker: string
  price: number
  currency: string
}
