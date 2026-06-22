import Sidebar from '@/components/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex overflow-hidden">
      <Sidebar />
      <main
        className="flex-1 overflow-y-auto pt-14 lg:pt-0"
        style={{ background: 'var(--bg-base)' }}
      >
        {children}
      </main>
    </div>
  )
}
