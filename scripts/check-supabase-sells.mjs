import XLSX from 'xlsx'

const SUPABASE_URL = 'https://uladwlbvakpnlaxsmryy.supabase.co'
const SUPABASE_KEY = 'sb_publishable_VZTWm4CgW-PdwOhJc87UjA_448zkEJJ'

async function query(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  })
  return res.json()
}

// Alle Transaktionen aus Supabase holen
const txData = await query('transactions', 'select=id,date,type,shares,price,fees,taxes,amount,strategy,security_id&order=date&limit=200')
const securities = await query('securities', 'select=id,ticker,name')

const secMap = new Map(securities.map(s => [s.id, s]))

console.log(`Supabase: ${txData.length} Transaktionen, ${securities.length} Securities`)

const sells = txData.filter(t => t.type === 'Verkauf')
const buys = txData.filter(t => t.type === 'Kauf')
console.log(`Käufe: ${buys.length}, Verkäufe: ${sells.length}`)

console.log('\n=== ALLE VERKÄUFE in Supabase ===')
sells.forEach(tx => {
  const sec = secMap.get(tx.security_id)
  console.log(`${tx.date} | ${sec?.ticker ?? 'NULL-sec'} (id:${tx.security_id}) | ${tx.shares} Stk | ${tx.price} € | amount:${tx.amount}`)
})

// Excel Verkäufe laden
const wb = XLSX.readFile('C:/Users/mail/Desktop/investment-dashboard/Trade_Journal___Portfolio-Dashboard.xlsx')
const txSheet = wb.Sheets['Transaktionen']
const txRaw = XLSX.utils.sheet_to_json(txSheet, { header: 1, defval: '' })

function excelDate(serial) {
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
}

const excelSells = txRaw.slice(1).filter(r => r[0] !== '' && r[2] === 'Verkauf').map(r => ({
  date: typeof r[1] === 'number' ? excelDate(r[1]) : r[1],
  ticker: r[3],
  shares: parseFloat(r[7]) || 0,
  amount: parseFloat(r[11]) || 0,
  strategy: r[13],
}))

console.log(`\nExcel: ${excelSells.length} Verkäufe`)

// Fehlende Verkäufe in Supabase
console.log('\n=== IN EXCEL ABER NICHT IN SUPABASE (Verkäufe) ===')
const sbSellKeys = new Set(sells.map(t => {
  const sec = secMap.get(t.security_id)
  return `${t.date}::${sec?.ticker}::${t.shares}`
}))

for (const ex of excelSells) {
  const key = `${ex.date}::${ex.ticker}::${ex.shares}`
  if (!sbSellKeys.has(key)) {
    console.log(`FEHLT: ${ex.date} | ${ex.ticker} | ${ex.strategy} | ${ex.shares} Stk | ${ex.amount} €`)
  }
}

// Simuliere Positionen auf Basis von Supabase
console.log('\n=== POSITIONS-SIMULATION aus Supabase-Daten ===')
const sorted = [...txData].sort((a, b) => a.date.localeCompare(b.date))
const byKey = new Map()

for (const tx of sorted) {
  const sec = secMap.get(tx.security_id)
  if (!sec) { console.log(`WARNUNG: security_id ${tx.security_id} nicht gefunden für ${tx.type} am ${tx.date}`); continue }
  const key = `${sec.ticker}::${tx.strategy}`
  if (!byKey.has(key)) byKey.set(key, { ticker: sec.ticker, strategy: tx.strategy, shares: 0, totalCost: 0, realizedPnL: 0 })
  const pos = byKey.get(key)

  if (tx.type === 'Kauf') {
    pos.shares += tx.shares
    pos.totalCost += tx.shares * tx.price + tx.fees
  } else if (tx.type === 'Verkauf') {
    const avgCost = pos.shares > 0 ? pos.totalCost / pos.shares : 0
    const proceeds = tx.shares * tx.price - tx.fees - tx.taxes
    pos.realizedPnL += proceeds - tx.shares * avgCost
    pos.shares -= tx.shares
    pos.totalCost -= tx.shares * avgCost
    if (pos.shares < 0.0001) { pos.shares = 0; pos.totalCost = 0 }
  }
}

const openPos = [...byKey.values()].filter(p => p.shares > 0.0001)
const allPos = [...byKey.values()]
const totalInvested = openPos.reduce((s, p) => s + p.totalCost, 0)
const realizedPnL = allPos.reduce((s, p) => s + p.realizedPnL, 0)

console.log(`Investiert (offen): ${totalInvested.toFixed(2)} €`)
console.log(`Realisiertes G/V: ${realizedPnL.toFixed(2)} €`)
console.log(`Offene Positionen: ${openPos.length}`)
console.log('\nOpen positions:')
openPos.sort((a,b) => b.totalCost - a.totalCost).forEach(p => {
  console.log(`  ${p.ticker} | ${p.strategy} | ${p.shares.toFixed(4)} Stk | ${p.totalCost.toFixed(2)} €`)
})
