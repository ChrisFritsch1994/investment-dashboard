interface KpiCardProps {
  label: string
  value: string
  sub?: string
  positive?: boolean | null
  large?: boolean
  badge?: string
}

export default function KpiCard({ label, value, sub, positive, large, badge }: KpiCardProps) {
  const color = positive === true ? 'var(--accent-green)' : positive === false ? 'var(--accent-red)' : 'var(--text-primary)'

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className={`font-bold ${large ? 'text-4xl' : 'text-2xl'}`} style={{ color }}>
        {value}
        {badge && (
          <span
            className="ml-2 text-sm font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: positive === false ? 'rgba(239,68,68,0.15)' : 'rgba(132,204,22,0.15)',
              color: positive === false ? 'var(--accent-red)' : 'var(--accent-green)',
              fontSize: '0.75rem',
              verticalAlign: 'middle',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {sub && (
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}
