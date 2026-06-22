import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uladwlbvakpnlaxsmryy.supabase.co'
const SUPABASE_KEY = 'sb_publishable_VZTWm4CgW-PdwOhJc87UjA_448zkEJJ'
const EXCEL_PATH = 'C:\\Users\\mail\\Desktop\\investment-dashboard\\Trade_Journal___Portfolio-Dashboard.xlsx'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function excelDateToISO(serial) {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000))
  return d.toISOString().slice(0, 10)
}

const wb = XLSX.readFile(EXCEL_PATH)

// ── TRANSAKTIONEN ──────────────────────────────────────────────
const txRows = XLSX.utils.sheet_to_json(wb.Sheets['Transaktionen'], { defval: null })
const { data: dbTx } = await supabase
  .from('transactions')
  .select('*, security:securities(ticker, name)')
  .order('date')

console.log(`\n${'='.repeat(60)}`)
console.log(`TRANSAKTIONEN: Excel=${txRows.length}  Supabase=${dbTx.length}`)
console.log('='.repeat(60))

const dbTxKeys = new Set(dbTx.map(t =>
  `${t.date}|${t.security?.ticker ?? ''}|${t.type}|${Number(t.shares).toFixed(4)}`
))
const excelTxKeys = new Set()
const missingTx = []

for (const row of txRows) {
  if (!row['Datum'] || !row['Ticker']) continue
  const date = typeof row['Datum'] === 'number' ? excelDateToISO(row['Datum']) : String(row['Datum']).slice(0, 10)
  const key = `${date}|${row['Ticker']}|${row['Typ']}|${Number(row['Anzahl']).toFixed(4)}`
  excelTxKeys.add(key)
  if (!dbTxKeys.has(key)) {
    missingTx.push({ date, ticker: row['Ticker'], type: row['Typ'], shares: row['Anzahl'], price: row['Preis'], fees: row['Gebühren'], taxes: row['Steuern'], amount: row['Betrag'], strategy: row['Strategie'], currency: row['Währung'], name: row['Name'], isin: row['ISIN'], gfTicker: row['GF-Ticker'] })
  }
}

const extraTx = dbTx.filter(t => {
  const key = `${t.date}|${t.security?.ticker ?? ''}|${t.type}|${Number(t.shares).toFixed(4)}`
  return !excelTxKeys.has(key)
})

if (missingTx.length === 0 && extraTx.length === 0) {
  console.log('✅ Alle Transaktionen stimmen überein!')
} else {
  if (missingTx.length > 0) {
    console.log(`\n❌ In Excel aber NICHT in Supabase (${missingTx.length}):`)
    missingTx.forEach(t => console.log(`  ${t.date} | ${t.type} | ${t.ticker} | ${t.shares} Stk @ ${t.price} | ${t.strategy}`))
  }
  if (extraTx.length > 0) {
    console.log(`\n⚠️  In Supabase aber NICHT in Excel (${extraTx.length}):`)
    extraTx.forEach(t => console.log(`  ${t.date} | ${t.type} | ${t.security?.ticker} | ${t.shares} Stk @ ${t.price}`))
  }
}

// ── CASHFLOW (mit abs() auf beiden Seiten) ────────────────────
const cfRows = XLSX.utils.sheet_to_json(wb.Sheets['Cashflow'], { defval: null })
const { data: dbCf } = await supabase.from('cashflows').select('*').order('date')

console.log(`\n${'='.repeat(60)}`)
console.log(`CASHFLOW: Excel=${cfRows.length}  Supabase=${dbCf.length}`)
console.log('='.repeat(60))

// Use abs() on BOTH sides to normalize sign convention
const dbCfKeys = new Set(dbCf.map(c => `${c.date}|${Math.abs(Number(c.amount)).toFixed(2)}|${c.category}`))
const excelCfKeys = new Set()
const missingCf = []

for (const row of cfRows) {
  if (!row['Datum']) continue
  const date = typeof row['Datum'] === 'number' ? excelDateToISO(row['Datum']) : String(row['Datum']).slice(0, 10)
  const amount = Math.abs(Number(row['Betrag'])).toFixed(2)
  const key = `${date}|${amount}|${row['Kategorie']}`
  excelCfKeys.add(key)
  if (!dbCfKeys.has(key)) {
    missingCf.push({ date, amount, category: row['Kategorie'], description: row['Beschreibung'] })
  }
}

const extraCf = dbCf.filter(c => {
  const key = `${c.date}|${Math.abs(Number(c.amount)).toFixed(2)}|${c.category}`
  return !excelCfKeys.has(key)
})

if (missingCf.length === 0 && extraCf.length === 0) {
  console.log('✅ Alle Cashflows stimmen überein!')
} else {
  if (missingCf.length > 0) {
    console.log(`\n❌ In Excel aber NICHT in Supabase (${missingCf.length}):`)
    missingCf.forEach(c => console.log(`  ${c.date} | ${c.category} | ${c.amount} € | "${c.description}"`))
  }
  if (extraCf.length > 0) {
    console.log(`\n⚠️  In Supabase aber NICHT in Excel (${extraCf.length}):`)
    extraCf.forEach(c => console.log(`  ${c.date} | ${c.category} | ${Math.abs(c.amount)} € | "${c.description}"`))
  }
}
