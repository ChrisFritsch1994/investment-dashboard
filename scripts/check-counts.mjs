import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://uladwlbvakpnlaxsmryy.supabase.co', 'sb_publishable_VZTWm4CgW-PdwOhJc87UjA_448zkEJJ')
const EXCEL_PATH = 'C:\\Users\\mail\\Desktop\\investment-dashboard\\Trade_Journal___Portfolio-Dashboard.xlsx'
const wb = XLSX.readFile(EXCEL_PATH)

function excelDateToISO(serial) {
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
}

// ── TRANSAKTIONEN ──
const txRows = XLSX.utils.sheet_to_json(wb.Sheets['Transaktionen'], { defval: null })
const validTx = txRows.filter(r => r['Datum'] && r['Ticker'])
const invalidTx = txRows.filter(r => !r['Datum'] || !r['Ticker'])
console.log(`Excel TX: ${txRows.length} total, ${validTx.length} mit Datum+Ticker, ${invalidTx.length} ohne:`)
invalidTx.forEach(r => console.log('  Übersprungen:', JSON.stringify(r)))

// Check for duplicates in Excel
const txKeyCount = {}
for (const row of validTx) {
  const date = typeof row['Datum'] === 'number' ? excelDateToISO(row['Datum']) : String(row['Datum']).slice(0,10)
  const key = `${date}|${row['Ticker']}|${row['Typ']}|${Number(row['Anzahl']).toFixed(4)}`
  txKeyCount[key] = (txKeyCount[key] || 0) + 1
}
const dupesTx = Object.entries(txKeyCount).filter(([,v]) => v > 1)
if (dupesTx.length) { console.log('Duplikate in Excel TX:', dupesTx) }

// ── CASHFLOW ──
const cfRows = XLSX.utils.sheet_to_json(wb.Sheets['Cashflow'], { defval: null })
const validCf = cfRows.filter(r => r['Datum'])
const invalidCf = cfRows.filter(r => !r['Datum'])
console.log(`\nExcel CF: ${cfRows.length} total, ${validCf.length} mit Datum, ${invalidCf.length} ohne`)

// Check for duplicates
const cfKeyCount = {}
for (const row of validCf) {
  const date = typeof row['Datum'] === 'number' ? excelDateToISO(row['Datum']) : String(row['Datum']).slice(0,10)
  const key = `${date}|${Math.abs(Number(row['Betrag'])).toFixed(2)}|${row['Kategorie']}`
  cfKeyCount[key] = (cfKeyCount[key] || 0) + 1
}
const dupesCf = Object.entries(cfKeyCount).filter(([,v]) => v > 1)
if (dupesCf.length) {
  console.log(`\nDuplikate in Excel CF (${dupesCf.length}):`)
  dupesCf.forEach(([k,v]) => console.log(`  ${k} → ${v}x`))
}

const { data: dbCf } = await supabase.from('cashflows').select('*').order('date')
const dbCfKeyCount = {}
for (const c of dbCf) {
  const key = `${c.date}|${Math.abs(Number(c.amount)).toFixed(2)}|${c.category}`
  dbCfKeyCount[key] = (dbCfKeyCount[key] || 0) + 1
}
const dupesDbCf = Object.entries(dbCfKeyCount).filter(([,v]) => v > 1)
if (dupesDbCf.length) {
  console.log(`\nDuplikate in Supabase CF (${dupesDbCf.length}):`)
  dupesDbCf.forEach(([k,v]) => console.log(`  ${k} → ${v}x`))
}
console.log(`\nSupabase CF: ${dbCf.length} Einträge, ${Object.keys(dbCfKeyCount).length} unique Keys`)
console.log(`Excel CF unique Keys: ${Object.keys(cfKeyCount).length}`)
