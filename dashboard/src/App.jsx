import React, { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useMetrics } from './hooks/useMetrics'
import { useConfig } from './hooks/useConfig'
import Sidebar from './components/Sidebar'
import Footer from './components/Footer'
import OverviewPage from './components/OverviewPage'
import CallsPage from './components/CallsPage'
import PolicyPage from './components/PolicyPage'
import PlaceholderPage from './components/PlaceholderPage'

export default function App() {
  const [page, setPage] = useState('overview')
  const { metrics, loading, error, refetch } = useMetrics()
  const { configs, refetch: refetchConfig } = useConfig()

  return (
    <div className="flex min-h-screen bg-page">
      <Toaster position="bottom-right" />
      <Sidebar activePage={page} onNavigate={setPage} />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Header
          page={page}
          loading={loading}
          error={error}
          onRefresh={() => { refetch(); refetchConfig() }}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-8 py-6">
            {page === 'overview' && <OverviewPage metrics={metrics} />}
            {page === 'calls' && <CallsPage metrics={metrics} />}
            {page === 'policy' && <PolicyPage configs={configs} onSaved={refetchConfig} />}
            {page === 'analytics' && (
              <PlaceholderPage
                title="Analytics"
                subtitle="Time-series views, cohort trends, and CSV exports will appear here. Connect your data warehouse or use the metrics API for custom reporting."
              />
            )}
            {page === 'integrations' && (
              <PlaceholderPage
                title="Integrations"
                subtitle="Connect TMS, load boards, and CRM webhooks. Configure API keys and event subscriptions when your brokerage is ready to go live."
              />
            )}
            {page === 'reports' && (
              <PlaceholderPage
                title="Reports & exports"
                subtitle="Scheduled PDF summaries and spreadsheet exports for leadership — coming in a future release."
              />
            )}
            {page === 'settings' && (
              <PlaceholderPage
                title="Workspace settings"
                subtitle="User roles, notification preferences, and environment URLs. Enterprise SSO can be enabled when you move beyond API key access."
              />
            )}
          </div>
        </main>
        <Footer onNavigate={setPage} />
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
    integrations: 'Integrations',
    reports: 'Reports & exports',
    settings: 'Settings',
  }

  return (
    <header className="h-13 border-b border-border bg-surface-0 px-8 flex items-center justify-between shrink-0">
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
