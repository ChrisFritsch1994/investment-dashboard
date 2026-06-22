/**
 * Setup + Migration in einem Schritt
 * Nutzt die Supabase Management API um Tabellen anzulegen, dann importiert Excel-Daten
 */

const path = require('path')
const fs = require('fs')

// Load env
const envPath = path.join(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const eq = line.indexOf('=')
    if (eq > 0) {
      const k = line.slice(0, eq).trim()
      const v = line.slice(eq + 1).trim()
      if (k) process.env[k] = v
    }
  }
}

const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { db: { schema: 'public' } }
)

function excelDateToISO(serial) {
  if (!serial || isNaN(serial)) return null
  const d = XLSX.SSF.parse_date_code(serial)
  if (!d) return null
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
}

async function checkTables() {
  // Try reading from each table to check existence
  const tables = ['securities', 'transactions', 'cashflows']
  const missing = []
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1)
    if (error && error.code === '42P01') missing.push(t)
  }
  return missing
}

async function migrate() {
  console.log('🔌 Verbinde mit Supabase…')
  console.log(`   URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)

  // Check tables
  console.log('\n📋 Prüfe Tabellen…')
  const missing = await checkTables()

  if (missing.length > 0) {
    console.log('\n⚠️  Folgende Tabellen fehlen noch:')
    missing.forEach(t => console.log(`   - ${t}`))
    console.log('\n📌 Bitte gehe in den Supabase SQL Editor (Dashboard → SQL Editor)')
    console.log('   und führe die Datei supabase/schema.sql aus.')
    console.log('\n   Datei: C:\\Users\\mail\\Desktop\\investment-app\\supabase\\schema.sql')
    console.log('\nDanach dieses Script erneut ausführen.')
    process.exit(1)
  }

  console.log('✓ Alle Tabellen vorhanden')

  // ─── Excel lesen ──────────────────────────────────────────────────────────
  const xlPath = path.join(__dirname, '../../investment-dashboard/Trade_Journal___Portfolio-Dashboard.xlsx')
  if (!fs.existsSync(xlPath)) {
    console.error('Excel-Datei nicht gefunden:', xlPath)
    process.exit(1)
  }

  console.log('\n📖 Lese Excel-Datei…')
  const wb = XLSX.readFile(xlPath)

  // ─── 1. WERTPAPIERE ───────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📦 WERTPAPIERE importieren…')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const wpRows = XLSX.utils.sheet_to_json(wb.Sheets['Wertpapiere'], { defval: null })
  const secResults = { inserted: 0, skipped: 0, errors: 0 }
  const tickerToId = {}

  for (const row of wpRows) {
    const ticker = row['Ticker']?.toString().trim()
    const name = row['Name']?.toString().trim()
    const strategy = row['Strategie']?.toString().trim()
    if (!ticker || !name || !strategy) { secResults.skipped++; continue }

    const { data: existing } = await supabase.from('securities').select('id').eq('ticker', ticker).maybeSingle()
    if (existing) {
      tickerToId[ticker] = existing.id
      secResults.skipped++
      continue
    }

    const { data, error } = await supabase.from('securities').insert({
      ticker,
      gf_ticker: row['GF-Ticker']?.toString().trim() || null,
      name,
      isin: row['ISIN']?.toString().trim() || null,
      currency: row['Währung']?.toString().trim() || 'EUR',
      strategy,
    }).select().single()

    if (error) {
      console.error(`  ✗ ${ticker}: ${error.message}`)
      secResults.errors++
    } else {
      tickerToId[ticker] = data.id
      secResults.inserted++
      process.stdout.write(`  ✓ ${ticker.padEnd(12)} ${name}\n`)
    }
  }

  // Lade alle vorhandenen Securities
  const { data: allSec } = await supabase.from('securities').select('id, ticker')
  for (const s of (allSec || [])) {
    if (!tickerToId[s.ticker]) tickerToId[s.ticker] = s.id
  }

  console.log(`\n  Neu: ${secResults.inserted} | Übersprungen: ${secResults.skipped} | Fehler: ${secResults.errors}`)

  // ─── 2. TRANSAKTIONEN ─────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📈 TRANSAKTIONEN importieren…')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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

    if (!dateISO || !ticker || !type || isNaN(shares) || isNaN(price) || isNaN(amount) || !strategy) {
      txResults.skipped++
      continue
    }

    const security_id = tickerToId[ticker] || null

    const { data: existing } = await supabase.from('transactions').select('id')
      .eq('date', dateISO)
      .eq('security_id', security_id)
      .eq('amount', amount)
      .maybeSingle()

    if (existing) { txResults.skipped++; continue }

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
      process.stdout.write(`  ✓ ${dateISO}  ${type.padEnd(8)} ${ticker.padEnd(12)} ${amount.toFixed(2)} €\n`)
    }
  }

  console.log(`\n  Neu: ${txResults.inserted} | Übersprungen: ${txResults.skipped} | Fehler: ${txResults.errors}`)

  // ─── 3. CASHFLOWS ─────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('💰 CASHFLOWS importieren…')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const cfRows = XLSX.utils.sheet_to_json(wb.Sheets['Cashflow'], { defval: null })
  const cfResults = { inserted: 0, skipped: 0, errors: 0 }

  for (const row of cfRows) {
    const dateISO = excelDateToISO(row['Datum'])
    const amount = parseFloat(row['Betrag'])
    const category = row['Kategorie']?.toString().trim()

    if (!dateISO || isNaN(amount) || !category) { cfResults.skipped++; continue }

    const { data: existing } = await supabase.from('cashflows').select('id')
      .eq('date', dateISO).eq('amount', amount).eq('category', category).maybeSingle()

    if (existing) { cfResults.skipped++; continue }

    const { error } = await supabase.from('cashflows').insert({
      date: dateISO,
      description: row['Beschreibung']?.toString().trim() || null,
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

  console.log(`\n  Neu: ${cfResults.inserted} | Übersprungen: ${cfResults.skipped} | Fehler: ${cfResults.errors}`)

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════')
  console.log('  IMPORT ABGESCHLOSSEN')
  console.log('═══════════════════════════════════════════')

  const [sc, tc, cc] = await Promise.all([
    supabase.from('securities').select('*', { count: 'exact', head: true }),
    supabase.from('transactions').select('*', { count: 'exact', head: true }),
    supabase.from('cashflows').select('*', { count: 'exact', head: true }),
  ])

  console.log(`  Wertpapiere in DB:  ${sc.count}`)
  console.log(`  Transaktionen in DB: ${tc.count}`)
  console.log(`  Cashflows in DB:    ${cc.count}`)
  console.log('═══════════════════════════════════════════')
  console.log('\n✅ Fertig! Starte die App mit: npm run dev')
}

migrate().catch(e => { console.error('\n❌ Fehler:', e.message); process.exit(1) })
