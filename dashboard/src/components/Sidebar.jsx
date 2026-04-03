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
    ],
  },
  {
    label: 'Resources',
    items: [
      {
        id: 'docs',
        label: 'Documentation',
        icon: 'book',
        external: 'https://www.happyrobot.ai/',
      },
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
  book: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M3 3h10v11H3a1 1 0 00-1 1V4a1 1 0 011-1zM13 3h0a1 1 0 011 1v11a1 1 0 01-1-1V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  ),
}

function NavButton({ item, active, onNavigate }) {
  const activeCls = active
    ? 'bg-surface-2 text-text-primary shadow-[var(--shadow-card)]'
    : 'text-text-secondary hover:bg-surface-2/80 hover:text-text-primary'

  const icon = (
    <span className={active ? 'text-text-primary' : 'text-text-muted'}>
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

export default function Sidebar({ activePage, onNavigate, darkMode, onToggleDark, collapsed, onToggleCollapse }) {
  if (collapsed) {
    return (
      <aside className="w-14 h-screen sticky top-0 border-r border-border bg-surface-0 flex flex-col shrink-0 items-center transition-all duration-200">
        <div className="h-13 border-b border-border w-full flex items-center justify-center">
          <img src="/logo.png" alt="AL" className="w-7 h-7 rounded-md object-cover" />
        </div>

        <nav className="flex-1 py-3 flex flex-col items-center gap-1 overflow-y-auto">
          {NAV_SECTIONS.flatMap((s) => s.items).filter((item) => !item.external).map((item) => {
            const active = activePage === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                title={item.label}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  active
                    ? 'bg-surface-2 text-text-primary shadow-[var(--shadow-card)]'
                    : 'text-text-muted hover:bg-surface-2/80 hover:text-text-primary'
                }`}
              >
                {icons[item.icon]}
              </button>
            )
          })}
        </nav>

        <div className="py-3 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onToggleDark}
            title={darkMode ? 'Light mode' : 'Dark mode'}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text-primary transition-colors cursor-pointer"
          >
            {darkMode ? (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M14 9.6A6.5 6.5 0 016.4 2 6 6 0 1014 9.6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
            )}
          </button>
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text-primary transition-colors cursor-pointer"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-56 h-screen sticky top-0 border-r border-border bg-surface-0 flex flex-col shrink-0 transition-all duration-200">
      <div className="h-13 px-3 border-b border-border flex items-center">
        <div className="flex items-center gap-2.5 px-1">
          <img src="/logo.png" alt="AL" className="w-7 h-7 rounded-md object-cover shrink-0" />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-text-primary leading-tight tracking-tight">
              ACME Logistics
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">Operations</div>
          </div>
        </div>
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

      <div className="px-3 py-3 space-y-2">
        <button
          type="button"
          onClick={onToggleDark}
          className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors cursor-pointer"
        >
          <span className="text-text-muted">
            {darkMode ? (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M14 9.6A6.5 6.5 0 016.4 2 6 6 0 1014 9.6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
            )}
          </span>
          {darkMode ? 'Light mode' : 'Dark mode'}
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium text-text-muted hover:bg-surface-2 hover:text-text-secondary transition-colors cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Collapse
        </button>
      </div>
    </aside>
  )
}
