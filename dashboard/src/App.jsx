import React, { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useMetrics } from './hooks/useMetrics'
import { useConfig } from './hooks/useConfig'
import Sidebar from './components/Sidebar'
import Footer from './components/Footer'
import OverviewPage from './components/OverviewPage'
import CallsPage from './components/CallsPage'
import PolicyPage from './components/PolicyPage'
import AnalyticsPage from './components/AnalyticsPage'

export default function App() {
  const [page, setPage] = useState('overview')
  const { metrics, loading, error, refetch } = useMetrics()
  const { configs, refetch: refetchConfig } = useConfig()
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark'
    }
    return false
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar') === 'collapsed'
    }
    return false
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem('sidebar', sidebarCollapsed ? 'collapsed' : 'expanded')
  }, [sidebarCollapsed])

  return (
    <div className="flex min-h-screen bg-page">
      <Toaster position="bottom-right" />
      <Sidebar
        activePage={page}
        onNavigate={setPage}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="flex-1 min-w-0 overflow-y-auto h-screen">
        <Header
          page={page}
          loading={loading}
          error={error}
          onRefresh={() => { refetch(); refetchConfig() }}
        />
        <main className="min-h-[calc(100vh-3.25rem)]">
          <div className="max-w-6xl mx-auto px-8 py-6">
            {page === 'overview' && <OverviewPage metrics={metrics} />}
            {page === 'calls' && <CallsPage metrics={metrics} />}
            {page === 'policy' && <PolicyPage configs={configs} onSaved={refetchConfig} />}
            {page === 'analytics' && <AnalyticsPage />}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}

function Header({ page, loading, error, onRefresh }) {
  const titles = {
    overview: 'Overview',
    calls: 'Calls',
    policy: 'Negotiation policy',
    analytics: 'Analytics',
    docs: 'Documentation',
  }

  return (
    <header className="h-13 border-b border-border bg-surface-0 px-8 flex items-center justify-between shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <h1 className="text-[15px] font-semibold text-text-primary tracking-tight">
          {titles[page] || 'Operations'}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        {error ? (
          <StatusPill color="red" label="Disconnected" pulse />
        ) : loading ? (
          <StatusPill color="amber" label="Loading" pulse />
        ) : (
          <StatusPill color="green" label="Live" />
        )}
        <button
          type="button"
          onClick={onRefresh}
          className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer"
          title="Refresh"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2.5 2.5v4h4M13.5 13.5v-4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.1 6a5.5 5.5 0 00-9.3-1.5L2.5 6.5M3.9 10a5.5 5.5 0 009.3 1.5l.3-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </header>
  )
}

function StatusPill({ color, label, pulse }) {
  const colors = {
    green: 'bg-green-bg text-green-text',
    red: 'bg-red-bg text-red-text',
    amber: 'bg-amber-bg text-amber-text',
  }
  const dotColors = {
    green: 'bg-green-text',
    red: 'bg-red-text',
    amber: 'bg-amber-text',
  }
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${colors[color]}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dotColors[color]} ${pulse ? 'animate-pulse' : ''}`} />
      {label}
    </div>
  )
}
