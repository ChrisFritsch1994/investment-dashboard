import XLSX from 'xlsx'

const SUPABASE_URL = 'https://uladwlbvakpnlaxsmryy.supabase.co'
const SUPABASE_KEY = 'sb_publishable_VZTWm4CgW-PdwOhJc87UjA_448zkEJJ'

async function q(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  })
  return res.json()
}

const sbTx = await q('transactions', 'select=id,date,type,shares,price,fees,taxes,amount,strategy,security_id&order=date&limit=200')
const sbSec = await q('securities', 'select=id,ticker,name')
const secMap = new Map(sbSec.map(s => [s.id, s]))

// ── 1. AMOUNT-KONSISTENZ: Vergleich tx.amount vs shares*price+fees ──────────
console.log('=== 1. AMOUNT-KONSISTENZ (alle Transaktionen) ===')
let amountErrors = 0
for (const tx of sbTx) {
  const sec = secMap.get(tx.security_id)
  const expected = tx.shares * tx.price + tx.fees  // gilt für Kauf; für Verkauf ist amount = shares*price + fees (FALSCH - sollte price-fees sein)
  const diff = Math.abs(tx.amount - expected)
  if (diff > 0.10) {
    console.log(`  ${tx.date} | ${tx.type} | ${sec?.ticker} | amount=${tx.amount} | shares*price+fees=${expected.toFixed(2)} | diff=${diff.toFixed(2)}`)
    amountErrors++
  }
}
if (amountErrors === 0) console.log('  ✅ Alle amounts konsistent (shares*price+fees)')

// ── 2. XIRR CASHFLOWS: Wie werden Verkäufe behandelt? ────────────────────────
console.log('\n=== 2. XIRR-FEHLER: Verkauf-Cashflows ===')
console.log('Webapp nutzt +tx.amount für Verkäufe.')
console.log('Korrekt wäre: +(shares * price - fees - taxes) = tatsächlich erhaltenes Geld')
console.log('')
let xirrError = 0
for (const tx of sbTx.filter(t => t.type === 'Verkauf')) {
  const sec = secMap.get(tx.security_id)
  const correctProceeds = tx.shares * tx.price - tx.fees - tx.taxes
  const storedAmount = tx.amount
  const diff = storedAmount - correctProceeds  // wie viel zu viel in XIRR
  if (Math.abs(diff) > 0.01) {
    console.log(`  ${tx.date} | ${sec?.ticker} | tx.amount=${storedAmount.toFixed(2)} | korrekt=${correctProceeds.toFixed(2)} | XIRR-Fehler=+${diff.toFixed(2)}`)
    xirrError += diff
  }
}
console.log(`  Gesamt XIRR-Überzeichnung durch falsche Verkauf-Beträge: ${xirrError.toFixed(2)} €`)

// ── 3. GESAMTRENDITE %: Denominator-Fehler ────────────────────────────────────
console.log('\n=== 3. GESAMTRENDITE %: Denominator ===')
const totalKaufAmount = sbTx.filter(t => t.type === 'Kauf').reduce((s, t) => s + t.amount, 0)
console.log(`Summe aller Käufe (Excel-Methode als Basis): ${totalKaufAmount.toFixed(2)} €`)
console.log(`Investiert offen (aktuelle Webapp-Basis):    ~42965.68 €`)
console.log(``)
console.log(`Excel Gesamtrendite = Gesamt G/V / Summe Käufe = 6781.85 / 81786 = 8.29%`)
console.log(`Webapp Gesamtrendite = Gesamt G/V / Investiert-offen = 6781.85 / 42966 = 15.8% (falsch)`)

// ── 4. VOLLSTÄNDIGE POSITIONS-SIMULATION (mit Short-Fix) ──────────────────────
console.log('\n=== 4. POSITIONS-SIMULATION (aktueller Stand nach allen Fixes) ===')
const sorted = [...sbTx].sort((a, b) => a.date.localeCompare(b.date))
const byKey = new Map()

for (const tx of sorted) {
  const sec = secMap.get(tx.security_id)
  if (!sec) continue
  const key = `${sec.ticker}::${tx.strategy}`
  if (!byKey.has(key)) byKey.set(key, { ticker: sec.ticker, strategy: tx.strategy, shares: 0, totalCost: 0, realizedPnL: 0, shortProceeds: 0 })
  const pos = byKey.get(key)

  if (tx.type === 'Kauf') {
    if (pos.shares < -0.0001) {
      const cover = Math.min(tx.shares, -pos.shares)
      const feeRatio = tx.shares > 0 ? cover / tx.shares : 0
      const avgSP = pos.shortProceeds / (-pos.shares)
      pos.realizedPnL += avgSP * cover - (cover * tx.price + tx.fees * feeRatio)
      pos.shortProceeds -= avgSP * cover
      pos.shares += cover
      const rem = tx.shares - cover
      if (rem > 0.0001) { pos.shares += rem; pos.totalCost += rem * tx.price + tx.fees * (rem / tx.shares) }
    } else {
      pos.shares += tx.shares
      pos.totalCost += tx.shares * tx.price + tx.fees
    }
  } else if (tx.type === 'Verkauf') {
    if (pos.shares >= 0.0001) {
      const avg = pos.totalCost / pos.shares
      const proceeds = tx.shares * tx.price - tx.fees - tx.taxes
      pos.realizedPnL += proceeds - tx.shares * avg
      pos.shares -= tx.shares
      pos.totalCost -= tx.shares * avg
      if (pos.shares < 0.0001) { pos.shares = 0; pos.totalCost = 0 }
    } else {
      pos.shortProceeds += tx.shares * tx.price - tx.fees - tx.taxes
      pos.shares -= tx.shares
    }
  }
}

const open = [...byKey.values()].filter(p => p.shares > 0.0001)
const all = [...byKey.values()]
const totalInvested = open.reduce((s, p) => s + p.totalCost, 0)
const realizedPnL = all.reduce((s, p) => s + p.realizedPnL, 0)

console.log(`Investiert (offen):   ${totalInvested.toFixed(2)} €   [Excel: 42722.40]`)
console.log(`Realisiertes G/V:     ${realizedPnL.toFixed(2)} €  [Excel: -217.18]`)
console.log(`Gesamt Kauf-Volumen:  ${totalKaufAmount.toFixed(2)} €   [Excel: 81786.00]`)

// ── 5. EXCEL VERGLEICH ────────────────────────────────────────────────────────
const wb = XLSX.readFile('C:/Users/mail/Desktop/investment-dashboard/Trade_Journal___Portfolio-Dashboard.xlsx')
const posSheet = wb.Sheets['Positionen']
const posRaw = XLSX.utils.sheet_to_json(posSheet, { header: 1, defval: '' })
const posRows = posRaw.slice(1).filter(r => r[0] !== '')

const excelRealPnL = posRows.reduce((s, r) => s + (parseFloat(r[14]) || 0), 0)
const excelOpenInvested = posRows.filter(r => r[15] === 'offen').reduce((s, r) => s + (parseFloat(r[7]) || 0), 0)

console.log(`\n=== EXCEL Positionen-Quercheck ===`)
console.log(`Excel Real. G/V (Summe):         ${excelRealPnL.toFixed(2)} €`)
console.log(`Webapp Real. G/V:                 ${realizedPnL.toFixed(2)} €`)
console.log(`Diff Real. G/V:                   ${(realizedPnL - excelRealPnL).toFixed(2)} €`)
console.log(``)
console.log(`Excel Investiert (offen):         ${excelOpenInvested.toFixed(2)} €`)
console.log(`Webapp Investiert (offen):        ${totalInvested.toFixed(2)} €`)
console.log(`Diff Investiert:                  ${(totalInvested - excelOpenInvested).toFixed(2)} €`)

// Zeige alle Positionen wo Diff > 1€
console.log('\n=== POSITIONEN MIT ABWEICHUNG (> 1 €) ===')
for (const pos of open.sort((a,b)=>b.totalCost-a.totalCost)) {
  // Suche Excel-Position (nach Ticker, unabhängig von Strategie da Excel evtl. anders gruppiert)
  const exPos = posRows.find(r => r[0] === pos.ticker && r[15] === 'offen' && r[2] === pos.strategy)
  if (!exPos) continue
  const exCost = parseFloat(exPos[7]) || 0
  const diff = pos.totalCost - exCost
  if (Math.abs(diff) > 1) {
    console.log(`  ${pos.ticker} | ${pos.strategy}: Webapp=${pos.totalCost.toFixed(2)} | Excel=${exCost.toFixed(2)} | Diff=${diff.toFixed(2)}`)
  }
}
