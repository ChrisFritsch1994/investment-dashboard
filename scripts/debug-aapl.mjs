import XLSX from 'xlsx'

const wb = XLSX.readFile('C:/Users/mail/Desktop/investment-dashboard/Trade_Journal___Portfolio-Dashboard.xlsx')
const txSheet = wb.Sheets['Transaktionen']
const txRaw = XLSX.utils.sheet_to_json(txSheet, { header: 1, defval: '' })

function excelDate(serial) {
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
}

// Alle AAPL Transaktionen
console.log('=== AAPL Transaktionen in Excel ===')
txRaw.slice(1).filter(r => r[0] !== '' && r[3] === 'AAPL').forEach(r => {
  const date = typeof r[1] === 'number' ? excelDate(r[1]) : r[1]
  console.log(`ID:${r[0]} | ${date} | ${r[2]} | ${r[7]} Stk | ${r[8]} € | Fees:${r[9]} | Amount:${r[11]} | Strategy:${r[13]}`)
})

// Alle Transaktionen mit ID und Datum anzeigen um falsche Daten zu finden
console.log('\n=== ALLE TRANSAKTIONEN mit Datum (Excel IDs) ===')
txRaw.slice(1).filter(r => r[0] !== '').forEach(r => {
  const date = typeof r[1] === 'number' ? excelDate(r[1]) : r[1]
  console.log(`ID:${r[0]} | ${date} | ${r[2]} | ${r[3]} | Strategy:${r[13]}`)
})
