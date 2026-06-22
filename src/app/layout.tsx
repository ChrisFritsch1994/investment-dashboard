import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Investment Dashboard',
  description: 'Privates Investment-Tracking Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <body className="h-full flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
