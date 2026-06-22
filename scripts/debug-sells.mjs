import XLSX from 'xlsx'

const wb = XLSX.readFile('C:/Users/mail/Desktop/investment-dashboard/Trade_Journal___Portfolio-Dashboard.xlsx')

const txSheet = wb.Sheets['Transaktionen']
const txRaw = XLSX.utils.sheet_to_json(txSheet, { header: 1, defval: '' })

function excelDate(serial) {
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
}

const transactions = txRaw.slice(1).filter(r => r[0] !== '').map(r => ({
  id: r[0],
  date: typeof r[1] === 'number' ? excelDate(r[1]) : r[1],
  type: r[2],
  ticker: r[3],
  gf_ticker: r[4],
  name: r[5],
  isin: r[6],
  shares: parseFloat(r[7]) || 0,
  price: parseFloat(r[8]) || 0,
  fees: parseFloat(r[9]) || 0,
  taxes: parseFloat(r[10]) || 0,
  amount: parseFloat(r[11]) || 0,
  strategy: r[13],
}))

console.log('=== ALLE VERKÄUFE in Excel ===')
const sells = transactions.filter(t => t.type === 'Verkauf')
sells.forEach(tx => {
  console.log(`ID:${tx.id} | ${tx.date} | ${tx.ticker} | ${tx.strategy} | ${tx.shares} Stk | ${tx.price} € | Fees:${tx.fees} | Taxes:${tx.taxes} | Amount:${tx.amount}`)
})

console.log(`\nTotal Verkäufe: ${sells.length}`)
console.log('\n=== KÄUFE die kein entsprechendes Verkauf haben (per Ticker+Strategie) ===')

// Simulate positions
const byKey = new Map()
for (const tx of [...transactions].sort((a, b) => a.date.localeCompare(b.date))) {
  const key = `${tx.ticker}::${tx.strategy}`
  if (!byKey.has(key)) byKey.set(key, { ticker: tx.ticker, strategy: tx.strategy, shares: 0, totalCost: 0, realizedPnL: 0, buys: [], sells: [] })
  const pos = byKey.get(key)
  if (tx.type === 'Kauf') {
    pos.shares += tx.shares
    pos.totalCost += tx.shares * tx.price + tx.fees
    pos.buys.push(tx)
  } else if (tx.type === 'Verkauf') {
    const avgCost = pos.shares > 0 ? pos.totalCost / pos.shares : 0
    const proceeds = tx.shares * tx.price - tx.fees - tx.taxes
    pos.realizedPnL += proceeds - tx.shares * avgCost
    pos.shares -= tx.shares
    pos.totalCost -= tx.shares * avgCost
    if (pos.shares < 0.0001) { pos.shares = 0; pos.totalCost = 0 }
    pos.sells.push(tx)
  }
}

// Compare Excel Positionen with calculated
const posSheet = wb.Sheets['Positionen']
const posRaw = XLSX.utils.sheet_to_json(posSheet, { header: 1, defval: '' })
const posRows = posRaw.slice(1).filter(r => r[0] !== '')

console.log('\n=== ALLE EXCEL-Positionen mit Status ===')
posRows.forEach(r => {
  const ticker = r[0]
  const strategy = r[2]
  const openShares = parseFloat(r[5]) || 0
  const status = r[15]
  const realizedPnL = parseFloat(r[14]) || 0
  console.log(`${ticker} | ${strategy} | open:${openShares} | status:${status} | realPnL:${realizedPnL.toFixed(2)}`)
})

console.log('\n=== WEBAPP-Berechnung (aus Excel-Transaktionen) ===')
for (const [key, pos] of byKey) {
  if (pos.shares > 0.0001 || pos.realizedPnL !== 0) {
    console.log(`${pos.ticker} | ${pos.strategy} | shares:${pos.shares.toFixed(4)} | cost:${pos.totalCost.toFixed(2)} | realPnL:${pos.realizedPnL.toFixed(2)}`)
  }
}
