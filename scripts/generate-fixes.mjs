import XLSX from 'xlsx'

const SUPABASE_URL = 'https://uladwlbvakpnlaxsmryy.supabase.co'
const SUPABASE_KEY = 'sb_publishable_VZTWm4CgW-PdwOhJc87UjA_448zkEJJ'

async function q(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  })
  return res.json()
}

const wb = XLSX.readFile('C:/Users/mail/Desktop/investment-dashboard/Trade_Journal___Portfolio-Dashboard.xlsx')

function excelDate(serial) {
  if (typeof serial === 'number') return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
  return String(serial).slice(0, 10)
}

// Excel Transaktionen
const txSheet = wb.Sheets['Transaktionen']
const txRaw = XLSX.utils.sheet_to_json(txSheet, { header: 1, defval: '' })
const excelTx = txRaw.slice(1).filter(r => r[0] !== '').map(r => ({
  excelId: Number(r[0]),
  date: excelDate(r[1]),
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
  currency: r[12] || 'EUR',
  strategy: r[13],
}))

// Supabase
const sbSec = await q('securities', 'select=id,ticker,name,gf_ticker')
const secMap = new Map(sbSec.map(s => [s.ticker, s]))
const sbTx = await q('transactions', 'select=id,date,type,shares,price,fees,taxes,amount,strategy,security_id&order=date&limit=200')
const sbCF = await q('cashflows', 'select=date,category,amount,description&order=date&limit=500')

// ── 1. FEHLENDE TRANSAKTION: DBXW Kauf 2024-01-01 ────────────────────────────
console.log('=== PROBLEM 1: Fehlende DBXW-Transaktion ===')
const dbxwTx = excelTx.filter(t => t.ticker === 'DBXW')
console.log('Excel DBXW Transaktionen:')
dbxwTx.forEach(t => console.log(`  Excel ID:${t.excelId} | ${t.date} | ${t.type} | ${t.shares} Stk | ${t.price} € | Fees:${t.fees} | Amount:${t.amount}`))

const dbxwSec = sbSec.find(s => s.ticker === 'DBXW')
console.log(`\nDBXW security_id: ${dbxwSec?.id}`)

const sbDbxwTx = sbTx.filter(t => t.security_id === dbxwSec?.id)
console.log('Supabase DBXW Transaktionen:')
sbDbxwTx.forEach(t => console.log(`  ${t.date} | ${t.type} | ${t.shares} Stk | ${t.price} € | Fees:${t.fees} | Amount:${t.amount}`))

// Die fehlende DBXW Transaktion: ID:15 in Excel (9 Stk, 2024-01-01)
const missingDbxw = dbxwTx.find(t => t.excelId === 15)
if (missingDbxw && dbxwSec) {
  console.log('\n📝 SQL FIX 1:')
  console.log(`INSERT INTO transactions (date, type, shares, price, fees, taxes, amount, strategy, security_id)
VALUES ('${missingDbxw.date}', '${missingDbxw.type}', ${missingDbxw.shares}, ${missingDbxw.price}, ${missingDbxw.fees}, ${missingDbxw.taxes}, ${missingDbxw.amount}, '${missingDbxw.strategy}', '${dbxwSec.id}');`)
}

// ── 2. FEHLENDE CASHFLOWS ─────────────────────────────────────────────────────
console.log('\n=== PROBLEM 2: Fehlende Cashflows (500 € Einzahlungen) ===')
const cfSheet = wb.Sheets['Cashflow']
const cfRaw = XLSX.utils.sheet_to_json(cfSheet, { header: 1, defval: '' })

// Rohausgabe der Excel Cashflow Struktur
console.log('Excel Cashflow Spalten (erste 5 Zeilen):')
cfRaw.slice(0, 5).forEach((r, i) => console.log(`  Zeile ${i}: ${JSON.stringify(r)}`))

// Alle Einzahlungen Oct2024-Apr2025
const cfData = cfRaw.slice(1).filter(r => r[0] !== '').map(r => ({
  date: excelDate(r[0]),
  category: String(r[1]),
  amount: parseFloat(r[2]) || 0,
  description: String(r[3] || ''),
}))

const missingSbCFKeys = new Set(sbCF.map(c => `${c.date}|${Math.round(Math.abs(parseFloat(c.amount))*100)}`))

console.log('\nEinzahlungen 500€ Okt 2024 - Apr 2025 (Excel):')
const target500 = cfData.filter(c => Math.abs(c.amount) === 500 && c.date >= '2024-10-01' && c.date <= '2025-05-01')
target500.forEach(c => {
  const key = `${c.date}|${Math.round(Math.abs(c.amount)*100)}`
  const inSB = missingSbCFKeys.has(key)
  console.log(`  ${c.date} | ${c.category} | ${c.amount} € | ${c.description} → In Supabase: ${inSB ? '✅' : '❌ FEHLT'}`)
})

// ── 3. SXRV.DE Saisonalitäten Detail ─────────────────────────────────────────
console.log('\n=== PROBLEM 3: SXRV.DE Saisonalitäten Kostenbasis ===')
const sxrvSec = sbSec.find(s => s.ticker === 'SXRV.DE')
const sxrvTx = sbTx.filter(t => t.security_id === sxrvSec?.id && t.strategy === 'Saisonalitäten')
console.log('SXRV.DE Saisonalitäten in Supabase:')
sxrvTx.forEach(t => console.log(`  ${t.date} | ${t.type} | ${t.shares} Stk | ${t.price} € | Fees:${t.fees} | Amount:${t.amount}`))

const sxrvExcel = excelTx.filter(t => t.ticker === 'SXRV.DE' && t.strategy === 'Saisonalitäten')
console.log('\nSXRV.DE Saisonalitäten in Excel:')
sxrvExcel.forEach(t => console.log(`  Excel ID:${t.excelId} | ${t.date} | ${t.type} | ${t.shares} Stk | ${t.price} € | Fees:${t.fees} | Amount:${t.amount}`))

// Simulation SXRV.DE Saisonalitäten
let shares = 0, totalCost = 0, realPnL = 0, shortProceeds = 0
for (const tx of [...sxrvTx].sort((a,b)=>a.date.localeCompare(b.date))) {
  if (tx.type === 'Kauf') {
    shares += tx.shares
    totalCost += tx.shares * tx.price + tx.fees
  } else if (tx.type === 'Verkauf') {
    if (shares >= 0.0001) {
      const avg = totalCost / shares
      const proc = tx.shares * tx.price - tx.fees - tx.taxes
      realPnL += proc - tx.shares * avg
      shares -= tx.shares; totalCost -= tx.shares * avg
      if (shares < 0.0001) { shares = 0; totalCost = 0 }
    } else {
      shortProceeds += tx.shares * tx.price - tx.fees - tx.taxes
      shares -= tx.shares
    }
  }
}
console.log(`\nErgebnis Webapp: ${shares.toFixed(4)} Stk, Kostenbasis ${totalCost.toFixed(2)} €, realPnL ${realPnL.toFixed(2)} €`)

// Excel Positionen für Saisonalitäten
const posSheet = wb.Sheets['Positionen']
const posRaw = XLSX.utils.sheet_to_json(posSheet, { header: 1, defval: '' })
const sxrvPos = posRaw.slice(1).filter(r => r[0] === 'SXRV.DE' && r[2] === 'Saisonalitäten')[0]
if (sxrvPos) console.log(`Excel Positionen: ${sxrvPos[5]} Stk offen, Investiert=${sxrvPos[7]}, realPnL=${sxrvPos[14]}`)

// ── 4. GESAMTE DIFFERENZ-ANALYSE ──────────────────────────────────────────────
console.log('\n=== ZUSAMMENFASSUNG aller Differenzen ===')
console.log('Nach AAPL-Short-Fix:')
console.log('  Investiert (Webapp): 42965.68 €')
console.log('  Investiert (Excel):  42722.40 €')
console.log('  Diff:                  243.28 €')
console.log('')
console.log('Bekannte Pos-Differenzen (Webapp vs Excel):')
const knownDiffs = [
  { ticker: 'NOV.DE', webapp: 1001.12, excel: 1033.99 },
  { ticker: 'MCD', webapp: 1306.75, excel: 1305.85 },
  { ticker: 'EUNL', webapp: 8211.47, excel: 8209.64 },
  { ticker: 'SXRV.DE Saison.', webapp: 5439.62, excel: 5166.20 },  // from Excel Dashboard
]
let sumDiff = 0
knownDiffs.forEach(d => {
  const diff = d.webapp - d.excel
  sumDiff += diff
  console.log(`  ${d.ticker.padEnd(14)}: Webapp ${d.webapp.toFixed(2)} | Excel ${d.excel.toFixed(2)} | Diff ${diff.toFixed(2)}`)
})
console.log(`  Summe bekannte Diffs: ${sumDiff.toFixed(2)} €`)
