// Simulate the fixed calculatePositions logic for AAPL short-sell scenario
const transactions = [
  { date: '2024-08-05', type: 'Verkauf', ticker: 'AAPL', strategy: 'Aktien-Trading', shares: 20, price: 188.0615, fees: 1.02, taxes: 0 },
  { date: '2024-08-13', type: 'Kauf',    ticker: 'AAPL', strategy: 'Aktien-Trading', shares: 20, price: 202.7445, fees: 0.91, taxes: 0 },
]

const pos = { shares: 0, totalCost: 0, realizedPnL: 0, shortProceeds: 0 }

for (const tx of transactions.sort((a, b) => a.date.localeCompare(b.date))) {
  if (tx.type === 'Kauf') {
    if (pos.shares < -0.0001) {
      const sharesToCover = Math.min(tx.shares, -pos.shares)
      const feeForCover = tx.shares > 0 ? tx.fees * (sharesToCover / tx.shares) : 0
      const avgShortProceeds = -pos.shares > 0 ? pos.shortProceeds / (-pos.shares) : 0
      const coverCost = sharesToCover * tx.price + feeForCover
      pos.realizedPnL += avgShortProceeds * sharesToCover - coverCost
      pos.shortProceeds -= avgShortProceeds * sharesToCover
      pos.shares += sharesToCover
    } else {
      pos.shares += tx.shares
      pos.totalCost += tx.shares * tx.price + tx.fees
    }
  } else if (tx.type === 'Verkauf') {
    if (pos.shares >= 0.0001) {
      const avgCost = pos.totalCost / pos.shares
      const proceeds = tx.shares * tx.price - tx.fees - tx.taxes
      pos.realizedPnL += proceeds - tx.shares * avgCost
      pos.shares -= tx.shares
      pos.totalCost -= tx.shares * avgCost
      if (pos.shares < 0.0001) { pos.shares = 0; pos.totalCost = 0 }
    } else {
      const proceeds = tx.shares * tx.price - tx.fees - tx.taxes
      pos.shortProceeds += proceeds
      pos.shares -= tx.shares
    }
  }
  console.log(`After ${tx.type} ${tx.ticker}: shares=${pos.shares.toFixed(4)}, totalCost=${pos.totalCost.toFixed(2)}, shortProceeds=${pos.shortProceeds.toFixed(2)}, realPnL=${pos.realizedPnL.toFixed(2)}`)
}

console.log('\n=== ERGEBNIS ===')
console.log(`Offene Shares: ${pos.shares} (soll: 0)`)
console.log(`Real. G/V: ${pos.realizedPnL.toFixed(2)} € (Excel zeigt: -293.55 €)`)
console.log(`Erklärung: Leerverkauf bei 188.06 €, Eindeckung bei 202.74 € → Verlust`)
