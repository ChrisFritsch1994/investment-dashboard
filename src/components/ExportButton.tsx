'use client'

import { useState, useRef, useEffect } from 'react'
import { Download } from 'lucide-react'
import { downloadTable, type ExportFormat } from '@/lib/export'

interface Props {
  filename: string
  headers: string[]
  rows: (string | number | null)[][]
}

export default function ExportButton({ filename, headers, rows }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handle = (format: ExportFormat) => {
    downloadTable(filename, format, headers, rows)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
      >
        <Download size={14} />
        Export
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 w-40 rounded-lg shadow-xl z-50 overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {(['excel', 'csv', 'markdown'] as ExportFormat[]).map(f => (
            <button
              key={f}
              onClick={() => handle(f)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              {f === 'excel' ? '📊 Excel (.csv)' : f === 'csv' ? '📄 CSV' : '📝 Markdown'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
