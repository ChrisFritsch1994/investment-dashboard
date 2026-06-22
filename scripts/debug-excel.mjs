import XLSX from 'xlsx'

const wb = XLSX.readFile('C:/Users/mail/Desktop/investment-dashboard/Trade_Journal___Portfolio-Dashboard.xlsx')

// Dashboard
console.log('\n=== DASHBOARD ===')
const dash = wb.Sheets['Dashboard']
const dashData = XLSX.utils.sheet_to_json(dash, { header: 1, defval: '' })
dashData.slice(0, 50).forEach((row, i) => {
  const filtered = row.map((v, j) => v !== '' ? `[${XLSX.utils.encode_col(j)}]: ${v}` : null).filter(Boolean)
  if (filtered.length) console.log(`Row ${i+1}:`, filtered.join(' | '))
})

// Transaktionen - first 5 rows to understand structure
console.log('\n=== TRANSAKTIONEN (first 3 data rows) ===')
const tx = wb.Sheets['Transaktionen']
const txData = XLSX.utils.sheet_to_json(tx, { header: 1, defval: '' })
txData.slice(0, 4).forEach((row, i) => {
  console.log(`Row ${i+1}:`, row.map((v, j) => `[${XLSX.utils.encode_col(j)}]: ${v}`).filter((_,j) => row[j] !== '').join(' | '))
})

// Positionen
console.log('\n=== POSITIONEN ===')
const pos = wb.Sheets['Positionen']
const posData = XLSX.utils.sheet_to_json(pos, { header: 1, defval: '' })
posData.slice(0, 20).forEach((row, i) => {
  const filtered = row.map((v, j) => v !== '' ? `[${XLSX.utils.encode_col(j)}]: ${v}` : null).filter(Boolean)
  if (filtered.length) console.log(`Row ${i+1}:`, filtered.join(' | '))
})
