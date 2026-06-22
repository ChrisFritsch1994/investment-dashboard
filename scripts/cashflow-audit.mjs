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

const cfSheet = wb.Sheets['Cashflow']
const cfRaw = XLSX.utils.sheet_to_json(cfSheet, { header: 1, defval: '' })

// Excel: Spalten = Datum, Beschreibung, Betrag, Kategorie
const excelCF = cfRaw.slice(1).filter(r => r[0] !== '' && r[2] !== '').map(r => ({
  date: excelDate(r[0]),
  description: String(r[1] || ''),
  amount: parseFloat(r[2]) || 0,
  category: String(r[3] || ''),
}))

const sbCF = await q('cashflows', 'select=date,category,amount,description&order=date&limit=500')

// Normalisiere: Kategorie einheitlich, Betrag als absoluter Wert mit Vorzeichen
// Excel: Betrag kann positiv (Einzahlung) oder negativ (Auszahlung) sein
// Supabase: Auszahlung gespeichert als negativ

const excelNet = excelCF.reduce((s, c) => s + c.amount, 0)
const sbNet = sbCF.reduce((s, c) => s + parseFloat(c.amount), 0)

console.log(`Excel Netto-Zufluss: ${excelNet.toFixed(2)} €`)
console.log(`Supabase Netto-Zufluss: ${sbNet.toFixed(2)} €`)
console.log(`Differenz: ${(excelNet - sbNet).toFixed(2)} €`)

// Vergleich anhand Datum + Betrag (unabhängig von Kategorie/Beschreibung)
// Key: date + rounded amount (Vorzeichen beachten)
function makeKey(date, amount) {
  return `${date}|${Math.round(amount * 100)}`
}

const sbKeys = new Map()
for (const c of sbCF) {
  const k = makeKey(c.date, parseFloat(c.amount))
  sbKeys.set(k, (sbKeys.get(k) || 0) + 1)
}

const excelKeys = new Map()
for (const c of excelCF) {
  const k = makeKey(c.date, c.amount)
  excelKeys.set(k, (excelKeys.get(k) || 0) + 1)
}

// In Excel aber nicht (genug) in Supabase
const missingInSB = []
const tmpSB = new Map(sbKeys)
for (const c of excelCF) {
  const k = makeKey(c.date, c.amount)
  const avail = tmpSB.get(k) || 0
  if (avail > 0) {
    tmpSB.set(k, avail - 1)
  } else {
    missingInSB.push(c)
  }
}

// In Supabase aber nicht in Excel
const extraInSB = []
const tmpExcel = new Map(excelKeys)
for (const c of sbCF) {
  const k = makeKey(c.date, parseFloat(c.amount))
  const avail = tmpExcel.get(k) || 0
  if (avail > 0) {
    tmpExcel.set(k, avail - 1)
  } else {
    extraInSB.push(c)
  }
}

console.log(`\n=== IN EXCEL ABER NICHT IN SUPABASE (${missingInSB.length} Einträge) ===`)
missingInSB.forEach(c => console.log(`  ❌ ${c.date} | ${c.amount.toFixed(2).padStart(10)} € | ${c.description} | Kat: ${c.category}`))

console.log(`\n=== IN SUPABASE ABER NICHT IN EXCEL (${extraInSB.length} Einträge) ===`)
extraInSB.forEach(c => console.log(`  ⚠️  ${c.date} | ${parseFloat(c.amount).toFixed(2).padStart(10)} € | ${c.description} | Kat: ${c.category}`))

// Summen nach Kategorie
console.log('\n=== SUMMEN NACH KATEGORIE ===')
const cats = ['Einzahlung', 'Auszahlung', 'Dividende', 'Zinsen', 'Gebühr', 'Sonstiges']
for (const cat of cats) {
  const exSum = excelCF.filter(c => c.category === cat).reduce((s, c) => s + c.amount, 0)
  const sbSum = sbCF.filter(c => c.category === cat).reduce((s, c) => s + parseFloat(c.amount), 0)
  if (Math.abs(exSum) > 0.01 || Math.abs(sbSum) > 0.01) {
    console.log(`  ${cat.padEnd(12)}: Excel ${exSum.toFixed(2).padStart(12)} | Supabase ${sbSum.toFixed(2).padStart(12)} | Diff ${(exSum - sbSum).toFixed(2).padStart(10)}`)
  }
}

// SQL für fehlende Einträge
if (missingInSB.length > 0) {
  console.log('\n=== SQL FIX: Fehlende Cashflows einfügen ===')
  for (const c of missingInSB) {
    const cat = c.category || (c.amount < 0 ? 'Auszahlung' : 'Einzahlung')
    const desc = c.description || ''
    console.log(`INSERT INTO cashflows (date, category, amount, description) VALUES ('${c.date}', '${cat}', ${c.amount}, '${desc.replace(/'/g, "''")}');`)
  }
}
