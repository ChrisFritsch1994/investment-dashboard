export type ExportFormat = 'pdf' | 'excel' | 'markdown'

function toMarkdown(headers: string[], rows: (string | number | null)[][]): string {
  const col = (v: string | number | null) => String(v ?? '').replace(/\|/g, '\\|')
  const header = '| ' + headers.map(col).join(' | ') + ' |'
  const sep = '| ' + headers.map(() => '---').join(' | ') + ' |'
  const body = rows.map(r => '| ' + r.map(col).join(' | ') + ' |').join('\n')
  return [header, sep, body].join('\n')
}

function toExcelCSV(headers: string[], rows: (string | number | null)[][]): string {
  // BOM + semicolon-separated for Excel German locale
  const escape = (v: string | number | null) => {
    const s = v == null ? '' : String(v)
    return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [headers, ...rows].map(r => r.map(escape).join(';')).join('\n')
}

async function toPDF(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFontSize(14)
  doc.text(filename, 14, 15)

  autoTable(doc, {
    head: [headers],
    body: rows.map(r => r.map(v => (v == null ? '' : String(v)))),
    startY: 22,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  })

  doc.save(`${filename}.pdf`)
}

export function downloadTable(
  filename: string,
  format: ExportFormat,
  headers: string[],
  rows: (string | number | null)[][]
) {
  if (format === 'pdf') {
    toPDF(filename, headers, rows)
    return
  }

  let content: string
  let mime: string
  let ext: string

  if (format === 'excel') {
    content = toExcelCSV(headers, rows)
    mime = 'text/csv;charset=utf-8;'
    ext = 'csv'
  } else {
    content = toMarkdown(headers, rows)
    mime = 'text/markdown;charset=utf-8;'
    ext = 'md'
  }

  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}
