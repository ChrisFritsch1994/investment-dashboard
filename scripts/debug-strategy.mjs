const SUPABASE_URL = 'https://uladwlbvakpnlaxsmryy.supabase.co'
const SUPABASE_KEY = 'sb_publishable_VZTWm4CgW-PdwOhJc87UjA_448zkEJJ'

async function query(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  })
  return res.json()
}

const txData = await query('transactions', 'select=id,date,type,shares,price,fees,taxes,strategy,security_id&order=date&limit=200')
const securities = await query('securities', 'select=id,ticker,name')
const secMap = new Map(securities.map(s => [s.id, s]))

// Zeige alle Transaktionen mit ihrem Ticker und Strategy
console.log('=== ALLE TRANSAKTIONEN (Ticker | Typ | Strategy) ===')
for (const tx of txData) {
  const sec = secMap.get(tx.security_id)
  const ticker = sec?.ticker ?? `NULL(${tx.security_id})`
  console.log(`${tx.date} | ${tx.type.padEnd(7)} | ${ticker.padEnd(12)} | strategy="${tx.strategy}"`)
}

// Finde Tickers wo Kauf und Verkauf unterschiedliche Strategien haben
console.log('\n=== STRATEGIE-MISMATCH (Käufe vs. Verkäufe) ===')
const byTicker = new Map()
for (const tx of txData) {
  const sec = secMap.get(tx.security_id)
  if (!sec) continue
  const ticker = sec.ticker
  if (!byTicker.has(ticker)) byTicker.set(ticker, { buys: [], sells: [] })
  if (tx.type === 'Kauf') byTicker.get(ticker).buys.push(tx.strategy)
  else if (tx.type === 'Verkauf') byTicker.get(ticker).sells.push(tx.strategy)
}

for (const [ticker, { buys, sells }] of byTicker) {
  if (sells.length === 0) continue
  const buyStrats = [...new Set(buys)]
  const sellStrats = [...new Set(sells)]
  const mismatch = !buyStrats.some(b => sellStrats.includes(b))
  if (mismatch || JSON.stringify(buyStrats) !== JSON.stringify(sellStrats)) {
    console.log(`${ticker}: Kauf-Strategien=[${buyStrats}] | Verkauf-Strategien=[${sellStrats}] ${mismatch ? '⚠️ MISMATCH' : ''}`)
  }
}
