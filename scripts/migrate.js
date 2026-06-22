/**
 * Migration script: Excel → Supabase
 * Run: node scripts/migrate.js
 *
 * Prerequisites:
 *   npm install @supabase/supabase-js xlsx dotenv
 *   Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 */

const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')

// Load env
const envPath = path.join(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8')
  for (const line of envFile.split('\n')) {
    const [k, ...vs] = line.split('=')
    if (k && vs.length) process.env[k.trim()] = vs.join('=').trim()
  }
}

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Helper: Excel serial date → ISO string
function excelDateToISO(serial) {
  if (!serial || isNaN(serial)) return null
  const d = XLSX.SSF.parse_date_code(serial)
  if (!d) return null
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
}

async function migrate() {
  const xlPath = path.join(__dirname, '../../investment-dashboard/Trade_Journal___Portfolio-Dashboard.xlsx')
  if (!fs.existsSync(xlPath)) {
    console.error('Excel file not found at:', xlPath)
    process.exit(1)
  }

  console.log('Reading Excel file…')
  const wb = XLSX.readFile(xlPath)

  // ─── 1. WERTPAPIERE ───────────────────────────────────────────────────────
  console.log('\n📦 Importing securities…')
  const wpRows = XLSX.utils.sheet_to_json(wb.Sheets['Wertpapiere'], { defval: null })

  const secResults = { inserted: 0, skipped: 0, errors: 0 }
  const tickerToId = {}

  for (const row of wpRows) {
    const ticker = row['Ticker']?.toString().trim()
    const name = row['Name']?.toString().trim()
    const strategy = row['Strategie']?.toString().trim()

    if (!ticker || !name || !strategy) {
      secResults.skipped++
      continue
    }

    // Check if already exists
    const { data: existing } = await supabase
      .from('securities')
      .select('id, ticker')
      .eq('ticker', ticker)
      .single()

    if (existing) {
      tickerToId[ticker] = existing.id
      secResults.skipped++
      continue
    }

    const { data, error } = await supabase
      .from('securities')
      .insert({
        ticker,
        gf_ticker: row['GF-Ticker']?.toString().trim() || null,
        name,
        isin: row['ISIN']?.toString().trim() || null,
        currency: row['Währung']?.toString().trim() || 'EUR',
        strategy,
      })
      .select()
      .single()

    if (error) {
      console.error(`  ✗ ${ticker}: ${error.message}`)
      secResults.errors++
    } else {
      tickerToId[ticker] = data.id
      secResults.inserted++
      console.log(`  ✓ ${ticker} — ${name}`)
    }
  }

  // Fetch all existing to fill tickerToId
  const { data: allSec } = await supabase.from('securities').select('id, ticker')
  for (const s of (allSec || [])) {
    if (!tickerToId[s.ticker]) tickerToId[s.ticker] = s.id
  }

  console.log(`\nSecurities: ${secResults.inserted} imported, ${secResults.skipped} skipped, ${secResults.errors} errors`)

  // ─── 2. TRANSAKTIONEN ─────────────────────────────────────────────────────
  console.log('\n📈 Importing transactions…')
  const txRows = XLSX.utils.sheet_to_json(wb.Sheets['Transaktionen'], { defval: null })

  const txResults = { inserted: 0, skipped: 0, errors: 0 }

  for (const row of txRows) {
    const dateISO = excelDateToISO(row['Datum'])
    const ticker = row['Ticker']?.toString().trim()
    const type = row['Typ']?.toString().trim()
    const shares = parseFloat(row['Anzahl'])
    const price = parseFloat(row['Preis'])
    const amount = parseFloat(row['Betrag'])
    const strategy = row['Strategie']?.toString().trim()

    if (!dateISO || !ticker || !type || isNaN(shares) || isNaN(price) || isNaN(amount)) {
      txResults.skipped++
      continue
    }

    const security_id = tickerToId[ticker] || null

    // Duplicate check: same date + ticker + amount
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('date', dateISO)
      .eq('security_id', security_id)
      .eq('amount', amount)
      .maybeSingle()

    if (existing) {
      txResults.skipped++
      continue
    }

    const { error } = await supabase.from('transactions').insert({
      date: dateISO,
      type,
      security_id,
      shares,
      price,
      fees: parseFloat(row['Gebühren']) || 0,
      taxes: parseFloat(row['Steuern']) || 0,
      amount,
      currency: row['Währung']?.toString().trim() || 'EUR',
      strategy,
      source: row['Quelle']?.toString().trim() || null,
      notes: row['Notiz']?.toString().trim() || null,
    })

    if (error) {
      console.error(`  ✗ ${dateISO} ${ticker}: ${error.message}`)
      txResults.errors++
    } else {
      txResults.inserted++
    }
  }

  console.log(`\nTransactions: ${txResults.inserted} imported, ${txResults.skipped} skipped, ${txResults.errors} errors`)

  // ─── 3. CASHFLOWS ─────────────────────────────────────────────────────────
  console.log('\n💰 Importing cashflows…')
  const cfRows = XLSX.utils.sheet_to_json(wb.Sheets['Cashflow'], { defval: null })

  const cfResults = { inserted: 0, skipped: 0, errors: 0 }

  for (const row of cfRows) {
    const dateISO = excelDateToISO(row['Datum'])
    const amount = parseFloat(row['Betrag'])
    const category = row['Kategorie']?.toString().trim()

    if (!dateISO || isNaN(amount) || !category) {
      cfResults.skipped++
      continue
    }

    // Duplicate check
    const description = row['Beschreibung']?.toString().trim() || null
    const { data: existing } = await supabase
      .from('cashflows')
      .select('id')
      .eq('date', dateISO)
      .eq('amount', amount)
      .eq('category', category)
      .maybeSingle()

    if (existing) {
      cfResults.skipped++
      continue
    }

    const { error } = await supabase.from('cashflows').insert({
      date: dateISO,
      description,
      amount,
      category,
      isin: row['ISIN']?.toString().trim() || null,
    })

    if (error) {
      console.error(`  ✗ ${dateISO} ${category}: ${error.message}`)
      cfResults.errors++
    } else {
      cfResults.inserted++
    }
  }

  console.log(`\nCashflows: ${cfResults.inserted} imported, ${cfResults.skipped} skipped, ${cfResults.errors} errors`)

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════')
  console.log('IMPORT SUMMARY')
  console.log('═══════════════════════════════════════')

  const { count: secCount } = await supabase.from('securities').select('*', { count: 'exact', head: true })
  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true })
  const { count: cfCount } = await supabase.from('cashflows').select('*', { count: 'exact', head: true })

  console.log(`Securities in DB:    ${secCount}`)
  console.log(`Transactions in DB:  ${txCount}`)
  console.log(`Cashflows in DB:     ${cfCount}`)
  console.log('═══════════════════════════════════════')
}

migrate().catch(console.error)
