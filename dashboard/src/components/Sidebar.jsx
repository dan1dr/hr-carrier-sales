import React from 'react'

const NAV_SECTIONS = [
  {
    label: 'Dashboard',
    items: [
      { id: 'overview', label: 'Overview', icon: 'grid' },
      { id: 'calls', label: 'Calls', icon: 'phone' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { id: 'policy', label: 'Policy', icon: 'sliders' },
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
  sliders: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="5" cy="4" r="1.5" fill="currentColor"/>
      <circle cx="10" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="7" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  ),
}

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="w-52 h-screen border-r border-border bg-surface-0 flex flex-col shrink-0">
      <div className="h-13 px-4 flex items-center gap-2.5 border-b border-border">
        <div className="w-6 h-6 rounded bg-text-primary flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M2 4l6-2 6 2v6l-6 4-6-4V4z" fill="white"/>
          </svg>
        </div>
        <span className="text-[13px] font-semibold text-text-primary truncate">Carrier Sales</span>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2 mb-1 text-[11px] font-medium text-text-muted uppercase tracking-wide">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = activePage === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors cursor-pointer
                      ${active
                        ? 'bg-surface-2 text-text-primary'
                        : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                      }`}
                  >
                    <span className={active ? 'text-text-primary' : 'text-text-muted'}>
                      {icons[item.icon]}
                    </span>
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-[11px] text-text-muted">Auto-refresh 30s</p>
      </div>
    </aside>
  )
}
