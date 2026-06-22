import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Investment Dashboard',
  description: 'Privates Investment-Tracking Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <body className="h-full" style={{ background: 'var(--bg-base)' }}>
        {children}
      </body>
    </html>
  )
}
