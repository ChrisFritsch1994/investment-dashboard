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

// ── TRANSAKTIONEN ─────────────────────────────────────────────────────────────
const txSheet = wb.Sheets['Transaktionen']
const txRaw = XLSX.utils.sheet_to_json(txSheet, { header: 1, defval: '' })
const excelTx = txRaw.slice(1).filter(r => r[0] !== '').map(r => ({
  id: Number(r[0]),
  date: excelDate(r[1]),
  type: r[2],
  ticker: r[3],
  gf_ticker: r[4],
  name: r[5],
  shares: Math.round(parseFloat(r[7]) * 1e8) / 1e8 || 0,
  price: parseFloat(r[8]) || 0,
  fees: parseFloat(r[9]) || 0,
  taxes: parseFloat(r[10]) || 0,
  amount: parseFloat(r[11]) || 0,
  strategy: r[13],
}))

const sbTx = await q('transactions', 'select=id,date,type,shares,price,fees,taxes,amount,strategy,security_id&order=date&limit=200')
const sbSec = await q('securities', 'select=id,ticker,name')
const secMap = new Map(sbSec.map(s => [s.id, s]))

// Supabase Transaktionen anreichern
const sbTxEnriched = sbTx.map(t => ({
  ...t,
  ticker: secMap.get(t.security_id)?.ticker ?? 'UNKNOWN',
}))

console.log(`Excel: ${excelTx.length} Transaktionen | Supabase: ${sbTxEnriched.length} Transaktionen`)

// ── TX VERGLEICH: Zähle nach Typ+Ticker+Datum ─────────────────────────────────
function txKey(t) { return `${t.date}|${t.type}|${t.ticker}|${Math.round(t.shares*10000)}` }

const excelTxKeys = new Map()
for (const t of excelTx) {
  const k = txKey(t)
  excelTxKeys.set(k, (excelTxKeys.get(k) || 0) + 1)
}
const sbTxKeys = new Map()
for (const t of sbTxEnriched) {
  const k = txKey(t)
  sbTxKeys.set(k, (sbTxKeys.get(k) || 0) + 1)
}

const inExcelNotSB = []
const inSBNotExcel = []
const tmpExcel = new Map(excelTxKeys)
const tmpSB = new Map(sbTxKeys)

for (const [k, cnt] of tmpExcel) {
  const sbCnt = tmpSB.get(k) || 0
  const diff = cnt - sbCnt
  if (diff > 0) {
    const t = excelTx.find(x => txKey(x) === k)
    for (let i = 0; i < diff; i++) inExcelNotSB.push(t)
  }
}
for (const [k, cnt] of tmpSB) {
  const exCnt = tmpExcel.get(k) || 0
  const diff = cnt - exCnt
  if (diff > 0) {
    const t = sbTxEnriched.find(x => txKey(x) === k)
    for (let i = 0; i < diff; i++) inSBNotExcel.push(t)
  }
}

console.log('\n=== TRANSAKTIONEN: In Excel aber NICHT in Supabase ===')
if (inExcelNotSB.length === 0) console.log('✅ Keine fehlenden')
else inExcelNotSB.forEach(t => console.log(`  ❌ ${t.date} | ${t.type} | ${t.ticker} | ${t.shares} Stk | ${t.price} € | ${t.strategy} | amount:${t.amount}`))

console.log('\n=== TRANSAKTIONEN: In Supabase aber NICHT in Excel ===')
if (inSBNotExcel.length === 0) console.log('✅ Keine Extras')
else inSBNotExcel.forEach(t => console.log(`  ⚠️  ${t.date} | ${t.type} | ${t.ticker} | ${t.shares} Stk | ${t.price} € | ${t.strategy} | amount:${t.amount}`))

// ── TX DETAILVERGLEICH: Beträge ───────────────────────────────────────────────
console.log('\n=== TRANSAKTIONEN: Betrag-Differenzen (> 0.05 €) ===')
let amountDiffs = 0
for (const ex of excelTx) {
  const sb = sbTxEnriched.find(s => s.date === ex.date && s.ticker === ex.ticker && s.type === ex.type && Math.abs(s.shares - ex.shares) < 0.001)
  if (!sb) continue
  const diff = Math.abs((sb.amount || 0) - ex.amount)
  if (diff > 0.05) {
    console.log(`  ${ex.date} ${ex.ticker} ${ex.type}: Excel=${ex.amount.toFixed(2)} | Supabase=${(sb.amount||0).toFixed(2)} | Diff=${diff.toFixed(2)}`)
    amountDiffs++
  }
}
if (amountDiffs === 0) console.log('✅ Alle Beträge stimmen überein')

// ── CASHFLOW ──────────────────────────────────────────────────────────────────
const cfSheet = wb.Sheets['Cashflow']
const cfRaw = XLSX.utils.sheet_to_json(cfSheet, { header: 1, defval: '' })
const excelCF = cfRaw.slice(1).filter(r => r[0] !== '' && r[1] !== '').map(r => ({
  date: excelDate(r[0]),
  category: r[1],
  amount: Math.abs(parseFloat(r[2]) || 0),
  description: r[3] || '',
}))

const sbCF = await q('cashflows', 'select=date,category,amount,description&order=date&limit=500')
const sbCFnorm = sbCF.map(c => ({ ...c, amount: Math.abs(parseFloat(c.amount) || 0) }))

console.log(`\nExcel Cashflows: ${excelCF.length} | Supabase Cashflows: ${sbCFnorm.length}`)

function cfKey(c) { return `${c.date}|${c.category}|${Math.round(c.amount*100)}` }
const excelCFKeys = new Map()
for (const c of excelCF) { const k = cfKey(c); excelCFKeys.set(k, (excelCFKeys.get(k)||0)+1) }
const sbCFKeys = new Map()
for (const c of sbCFnorm) { const k = cfKey(c); sbCFKeys.set(k, (sbCFKeys.get(k)||0)+1) }

const cfInExcelNotSB = [], cfInSBNotExcel = []
for (const [k, cnt] of excelCFKeys) {
  const diff = cnt - (sbCFKeys.get(k)||0)
  if (diff > 0) { const c = excelCF.find(x => cfKey(x) === k); for (let i=0;i<diff;i++) cfInExcelNotSB.push(c) }
}
for (const [k, cnt] of sbCFKeys) {
  const diff = cnt - (excelCFKeys.get(k)||0)
  if (diff > 0) { const c = sbCFnorm.find(x => cfKey(x) === k); for (let i=0;i<diff;i++) cfInSBNotExcel.push(c) }
}

console.log('\n=== CASHFLOW: In Excel aber NICHT in Supabase ===')
if (cfInExcelNotSB.length === 0) console.log('✅ Keine fehlenden')
else cfInExcelNotSB.forEach(c => console.log(`  ❌ ${c.date} | ${c.category} | ${c.amount.toFixed(2)} € | ${c.description}`))

console.log('\n=== CASHFLOW: In Supabase aber NICHT in Excel ===')
if (cfInSBNotExcel.length === 0) console.log('✅ Keine Extras')
else cfInSBNotExcel.forEach(c => console.log(`  ⚠️  ${c.date} | ${c.category} | ${c.amount.toFixed(2)} € | ${c.description}`))

// ── SUMMEN-QUERCHECK ──────────────────────────────────────────────────────────
const exKaufs = excelTx.filter(t=>t.type==='Kauf').reduce((s,t)=>s+t.amount,0)
const exVerkaufs = excelTx.filter(t=>t.type==='Verkauf').reduce((s,t)=>s+t.amount,0)
const exEinz = excelCF.filter(c=>c.category==='Einzahlung').reduce((s,c)=>s+c.amount,0)
const exAusz = excelCF.filter(c=>c.category==='Auszahlung').reduce((s,c)=>s+c.amount,0)

const sbKaufs = sbTxEnriched.filter(t=>t.type==='Kauf').reduce((s,t)=>s+(t.amount||0),0)
const sbVerkaufs = sbTxEnriched.filter(t=>t.type==='Verkauf').reduce((s,t)=>s+(t.amount||0),0)
const sbEinz = sbCFnorm.filter(c=>c.category==='Einzahlung').reduce((s,c)=>s+c.amount,0)
const sbAusz = sbCFnorm.filter(c=>c.category==='Auszahlung').reduce((s,c)=>s+c.amount,0)

console.log('\n=== SUMMEN-QUERCHECK ===')
console.log(`                     Excel        Supabase     Diff`)
console.log(`Käufe (Summe):    ${exKaufs.toFixed(2).padStart(12)} ${sbKaufs.toFixed(2).padStart(12)} ${(sbKaufs-exKaufs).toFixed(2).padStart(8)}`)
console.log(`Verkäufe (Summe): ${exVerkaufs.toFixed(2).padStart(12)} ${sbVerkaufs.toFixed(2).padStart(12)} ${(sbVerkaufs-exVerkaufs).toFixed(2).padStart(8)}`)
console.log(`Einzahlungen:     ${exEinz.toFixed(2).padStart(12)} ${sbEinz.toFixed(2).padStart(12)} ${(sbEinz-exEinz).toFixed(2).padStart(8)}`)
console.log(`Auszahlungen:     ${exAusz.toFixed(2).padStart(12)} ${sbAusz.toFixed(2).padStart(12)} ${(sbAusz-exAusz).toFixed(2).padStart(8)}`)

// ── INVESTIERTES KAPITAL (nach Webapp-Logik) ──────────────────────────────────
console.log('\n=== INVESTIERT-BERECHNUNG (Webapp-Logik mit Short-Fix) ===')
const sorted = [...sbTxEnriched].sort((a,b)=>a.date.localeCompare(b.date))
const byKey = new Map()

for (const tx of sorted) {
  const key = `${tx.ticker}::${tx.strategy}`
  if (!byKey.has(key)) byKey.set(key, { ticker: tx.ticker, strategy: tx.strategy, shares: 0, totalCost: 0, realizedPnL: 0, shortProceeds: 0 })
  const pos = byKey.get(key)

  if (tx.type === 'Kauf') {
    if (pos.shares < -0.0001) {
      const sharesToCover = Math.min(tx.shares, -pos.shares)
      const feeForCover = tx.shares > 0 ? tx.fees * (sharesToCover / tx.shares) : 0
      const avgShortProceeds = -pos.shares > 0 ? pos.shortProceeds / (-pos.shares) : 0
      pos.realizedPnL += avgShortProceeds * sharesToCover - (sharesToCover * tx.price + feeForCover)
      pos.shortProceeds -= avgShortProceeds * sharesToCover
      pos.shares += sharesToCover
      const rem = tx.shares - sharesToCover
      if (rem > 0.0001) { pos.shares += rem; pos.totalCost += rem * tx.price + tx.fees * (rem/tx.shares) }
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
      pos.shortProceeds += tx.shares * tx.price - tx.fees - tx.taxes
      pos.shares -= tx.shares
    }
  }
}

const open = [...byKey.values()].filter(p=>p.shares>0.0001)
const all = [...byKey.values()]
const totalInvested = open.reduce((s,p)=>s+p.totalCost,0)
const realizedPnL = all.reduce((s,p)=>s+p.realizedPnL,0)

console.log(`Investiert (offen):   ${totalInvested.toFixed(2)} €`)
console.log(`Realisiertes G/V:     ${realizedPnL.toFixed(2)} €`)
console.log(`Offene Positionen:    ${open.length}`)
console.log(`\nExcel Dashboard zeigt:`)
console.log(`Investiert (offen):   42722.40 €`)
console.log(`Real. G/V:            -217.18 €`)
console.log(`Diff Investiert:      ${(totalInvested - 42722.40).toFixed(2)} €`)
console.log(`Diff Real. G/V:       ${(realizedPnL - (-217.18)).toFixed(2)} €`)

console.log('\n=== OFFENE POSITIONEN (Webapp nach Fix) ===')
open.sort((a,b)=>b.totalCost-a.totalCost).forEach(p => {
  console.log(`  ${p.ticker.padEnd(12)} | ${p.strategy.padEnd(18)} | ${p.shares.toFixed(4).padStart(10)} Stk | ${p.totalCost.toFixed(2).padStart(9)} €`)
})
