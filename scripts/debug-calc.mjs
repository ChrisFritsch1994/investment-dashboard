import XLSX from 'xlsx'

const wb = XLSX.readFile('C:/Users/mail/Desktop/investment-dashboard/Trade_Journal___Portfolio-Dashboard.xlsx')

// --- Transaktionen einlesen ---
const txSheet = wb.Sheets['Transaktionen']
const txRaw = XLSX.utils.sheet_to_json(txSheet, { header: 1, defval: '' })
const txHeaders = txRaw[0]
const txRows = txRaw.slice(1).filter(r => r[0] !== '')

function excelDate(serial) {
  return new Date(Math.round((serial - 25569) * 86400 * 1000))
}

const transactions = txRows.map(r => ({
  id: r[0],
  date: typeof r[1] === 'number' ? excelDate(r[1]) : new Date(r[1]),
  type: r[2],       // Kauf / Verkauf
  ticker: r[3],
  name: r[5],
  shares: parseFloat(r[7]) || 0,
  price: parseFloat(r[8]) || 0,
  fees: parseFloat(r[9]) || 0,
  taxes: parseFloat(r[10]) || 0,
  amount: parseFloat(r[11]) || 0,   // Betrag in Excel
  strategy: r[13],
}))

console.log(`Total Transaktionen: ${transactions.length}`)
console.log(`Käufe: ${transactions.filter(t => t.type === 'Kauf').length}`)
console.log(`Verkäufe: ${transactions.filter(t => t.type === 'Verkauf').length}`)

// --- Gleiche Logik wie Webapp: calculatePositions ---
const byKey = new Map()

const sorted = [...transactions].sort((a, b) => a.date - b.date)

for (const tx of sorted) {
  const key = `${tx.ticker}::${tx.strategy}`
  if (!byKey.has(key)) {
    byKey.set(key, { ticker: tx.ticker, strategy: tx.strategy, shares: 0, totalCost: 0, realizedPnL: 0 })
  }
  const pos = byKey.get(key)

  if (tx.type === 'Kauf') {
    pos.shares += tx.shares
    pos.totalCost += tx.shares * tx.price + tx.fees   // WEBAPP Logik
  } else if (tx.type === 'Verkauf') {
    const avgCost = pos.shares > 0 ? pos.totalCost / pos.shares : 0
    const proceeds = tx.shares * tx.price - tx.fees - tx.taxes
    const costBasis = tx.shares * avgCost
    pos.realizedPnL += proceeds - costBasis
    pos.shares -= tx.shares
    pos.totalCost -= tx.shares * avgCost
    if (pos.shares < 0.0001) { pos.shares = 0; pos.totalCost = 0 }
  }
}

const positions = [...byKey.values()]
const openPositions = positions.filter(p => p.shares > 0.0001)

const totalInvested_webapp = openPositions.reduce((s, p) => s + p.totalCost, 0)
const realizedPnL_webapp = positions.reduce((s, p) => s + p.realizedPnL, 0)

console.log('\n=== WEBAPP Berechnungslogik (ohne Live-Kurse) ===')
console.log('Investiert (offen, cost basis):', totalInvested_webapp.toFixed(2))
console.log('Realisiertes G/V:', realizedPnL_webapp.toFixed(2))
console.log('Offene Positionen:', openPositions.length)
console.log()

// --- Excel Positionen zum Vergleich ---
const posSheet = wb.Sheets['Positionen']
const posRaw = XLSX.utils.sheet_to_json(posSheet, { header: 1, defval: '' })
const posRows = posRaw.slice(1).filter(r => r[0] !== '')

const excelInvested = posRows.filter(r => r[15] === 'offen').reduce((s, r) => s + (parseFloat(r[7]) || 0), 0)
const excelRealizedPnL = posRows.reduce((s, r) => s + (parseFloat(r[14]) || 0), 0)

console.log('=== EXCEL Dashboard Werte ===')
console.log('Investiert (offen):', excelInvested.toFixed(2))
console.log('Real. G/V:', excelRealizedPnL.toFixed(2))
console.log('Gesamtrendite %:', '8.29%')
console.log('XIRR:', '8.89%')

console.log('\n=== VERGLEICH je Position ===')
console.log('Ticker | Strategy | Webapp-Shares | Webapp-Cost | Excel-Shares | Excel-Cost | Diff')
for (const pos of openPositions.sort((a,b) => b.totalCost - a.totalCost)) {
  const excelPos = posRows.find(r => r[0] === pos.ticker && r[15] === 'offen')
  const excelShares = excelPos ? parseFloat(excelPos[5]) || 0 : 0
  const excelCost = excelPos ? parseFloat(excelPos[7]) || 0 : 0
  const diff = pos.totalCost - excelCost
  console.log(`${pos.ticker} | ${pos.strategy} | ${pos.shares.toFixed(4)} | ${pos.totalCost.toFixed(2)} | ${excelShares.toFixed(4)} | ${excelCost.toFixed(2)} | ${diff.toFixed(2)}`)
}

// --- tx.amount vs shares*price+fees Vergleich ---
console.log('\n=== BETRAG-Vergleich: tx.amount vs shares*price+fees (erste 10 Käufe) ===')
transactions.filter(t => t.type === 'Kauf').slice(0, 10).forEach(tx => {
  const calc = tx.shares * tx.price + tx.fees
  const diff = tx.amount - calc
  console.log(`${tx.ticker} | amount=${tx.amount.toFixed(2)} | calc=${calc.toFixed(2)} | diff=${diff.toFixed(2)}`)
})
