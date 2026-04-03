import React from 'react'

const NAV_SECTIONS = [
  {
    label: 'Monitor',
    items: [
      { id: 'overview', label: 'Overview', icon: 'grid' },
      { id: 'calls', label: 'Calls', icon: 'phone' },
      { id: 'analytics', label: 'Analytics', icon: 'chart' },
    ],
  },
  {
    label: 'Configure',
    items: [
      { id: 'policy', label: 'Negotiation policy', icon: 'sliders' },
      { id: 'integrations', label: 'Integrations', icon: 'plug' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { id: 'reports', label: 'Reports & exports', icon: 'file' },
      {
        id: 'docs',
        label: 'Documentation',
        icon: 'book',
        external: 'https://www.happyrobot.ai/',
      },
      {
        id: 'careers',
        label: 'HappyRobot careers',
        icon: 'briefcase',
        external: 'https://www.happyrobot.ai/careers',
      },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'settings', label: 'Settings', icon: 'gear' },
    ],
  },
]

const icons = {
  grid: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  phone: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 2.5a1 1 0 011-1h1.72a1 1 0 01.99.84l.53 3.17a1 1 0 01-.54 1.06l-1.1.55a8.8 8.8 0 004.88 4.88l.55-1.1a1 1 0 011.06-.54l3.17.53a1 1 0 01.84.99v1.72a1 1 0 01-1 1C6.4 14.5 1.5 9.6 1.5 4v-1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  chart: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 12h12M4 10V6M8 12V4M12 10V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  sliders: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="5" cy="4" r="1.5" fill="currentColor"/>
      <circle cx="10" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="7" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  ),
  plug: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M6 2v4M10 2v4M4 6h8v2a4 4 0 01-4 4v3M8 12v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  file: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M4 2h6l3 3v9H4V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M10 2v4h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  ),
  book: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M3 3h10v11H3a1 1 0 00-1 1V4a1 1 0 011-1zM13 3h0a1 1 0 011 1v11a1 1 0 01-1-1V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  ),
  briefcase: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M3 6h10v8a1 1 0 01-1 1H4a1 1 0 01-1-1V6zM5 6V4a2 2 0 012-2h2a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  ),
  gear: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8 1v2M8 13v2M15 8h-2M3 8H1M13.2 2.8l-1.4 1.4M4.2 11.8l-1.4 1.4M13.2 13.2l-1.4-1.4M4.2 4.2L2.8 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
}

function NavButton({ item, active, onNavigate }) {
  const activeCls = active
    ? 'bg-surface-2 text-text-primary shadow-[var(--shadow-card)]'
    : 'text-text-secondary hover:bg-surface-2/80 hover:text-text-primary'

  const icon = (
    <span className={active ? 'text-accent' : 'text-text-muted'}>
      {icons[item.icon]}
    </span>
  )

  if (item.external) {
    return (
      <a
        href={item.external}
        target="_blank"
        rel="noopener noreferrer"
        className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors ${activeCls}`}
      >
        {icon}
        {item.label}
        <span className="ml-auto text-[10px] text-text-muted opacity-70">↗</span>
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors cursor-pointer text-left ${activeCls}`}
    >
      {icon}
      {item.label}
    </button>
  )
}

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="w-56 h-screen border-r border-border bg-surface-0 flex flex-col shrink-0">
      <div className="px-3 pt-4 pb-3 border-b border-border">
        <div className="flex items-start gap-3 px-1">
          <img
            src="/acme-brand.png"
            alt=""
            className="w-10 h-10 rounded-lg object-cover ring-1 ring-border shrink-0"
          />
          <div className="min-w-0 pt-0.5">
            <div className="text-[14px] font-semibold text-text-primary leading-tight tracking-tight">
              ACME Logistics
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">Client workspace</div>
          </div>
        </div>
        <p className="text-[10px] text-text-muted mt-3 px-1 leading-snug">
          Signed in as <span className="text-text-secondary font-medium">broker operations</span>
        </p>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = !item.external && activePage === item.id
                return (
                  <NavButton
                    key={item.id}
                    item={item}
                    active={active}
                    onNavigate={onNavigate}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-border">
        <p className="text-[10px] text-text-muted">Metrics refresh every 30s</p>
      </div>
    </aside>
  )
}
