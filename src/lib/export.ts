export type ExportFormat = 'csv' | 'excel' | 'markdown'

function toCSV(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (v: string | number | null) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
}

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

export function downloadTable(
  filename: string,
  format: ExportFormat,
  headers: string[],
  rows: (string | number | null)[][]
) {
  let content: string
  let mime: string
  let ext: string

  if (format === 'csv') {
    content = toCSV(headers, rows)
    mime = 'text/csv;charset=utf-8;'
    ext = 'csv'
  } else if (format === 'excel') {
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
