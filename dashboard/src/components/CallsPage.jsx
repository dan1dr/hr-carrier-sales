import React from 'react'

function formatDuration(seconds) {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function CallsPage({ metrics }) {
  const totalCalls = metrics?.total_calls ?? null
  const totalMinutes = metrics?.total_call_minutes ?? null
  const avgDuration = metrics?.avg_call_duration_seconds ?? null

  const stats = [
    {
      value: totalCalls ?? '—',
      label: 'Total calls',
    },
    {
      value: totalMinutes != null ? Math.round(totalMinutes) : '—',
      label: 'Total call minutes',
    },
    {
      value: formatDuration(avgDuration),
      label: 'Avg call duration',
    },
  ]

  const outcomeBreakdown = metrics?.outcome_breakdown || {}
  const sentimentBreakdown = metrics?.sentiment_breakdown || {}

  return (
    <div className="space-y-6">
      {/* Call Stats */}
      <div>
        <h2 className="text-[13px] font-medium text-text-secondary mb-3">Calls</h2>
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="border border-border rounded-lg px-5 py-4"
            >
              <div className="text-2xl font-semibold text-text-primary tracking-tight">
                {stat.value}
              </div>
              <div className="text-[13px] text-text-muted mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Outcomes Table */}
      <div>
        <h2 className="text-[13px] font-medium text-text-secondary mb-3">Outcomes</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-2">
                <th className="text-left px-4 py-2.5 font-medium text-text-secondary">Outcome</th>
                <th className="text-right px-4 py-2.5 font-medium text-text-secondary">Count</th>
                <th className="text-right px-4 py-2.5 font-medium text-text-secondary">Share</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(outcomeBreakdown).length > 0 ? (
                Object.entries(outcomeBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, count]) => {
                    const total = Object.values(outcomeBreakdown).reduce((a, b) => a + b, 0)
                    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={key} className="border-t border-border">
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            <StatusPill status={key} />
                            <span className="text-text-primary capitalize">
                              {key.replace(/_/g, ' ')}
                            </span>
                          </span>
                        </td>
                        <td className="text-right px-4 py-2.5 text-text-primary tabular-nums font-medium">{count}</td>
                        <td className="text-right px-4 py-2.5 text-text-muted tabular-nums">{pct}%</td>
                      </tr>
                    )
                  })
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-text-muted">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sentiment Table */}
      <div>
        <h2 className="text-[13px] font-medium text-text-secondary mb-3">Sentiment</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-2">
                <th className="text-left px-4 py-2.5 font-medium text-text-secondary">Sentiment</th>
                <th className="text-right px-4 py-2.5 font-medium text-text-secondary">Count</th>
                <th className="text-right px-4 py-2.5 font-medium text-text-secondary">Share</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(sentimentBreakdown).length > 0 ? (
                Object.entries(sentimentBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, count]) => {
                    const total = Object.values(sentimentBreakdown).reduce((a, b) => a + b, 0)
                    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={key} className="border-t border-border">
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            <SentimentPill sentiment={key} />
                            <span className="text-text-primary capitalize">{key}</span>
                          </span>
                        </td>
                        <td className="text-right px-4 py-2.5 text-text-primary tabular-nums font-medium">{count}</td>
                        <td className="text-right px-4 py-2.5 text-text-muted tabular-nums">{pct}%</td>
                      </tr>
                    )
                  })
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-text-muted">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Call Log Placeholder */}
      <div>
        <h2 className="text-[13px] font-medium text-text-secondary mb-3">Call Log</h2>
        <div className="border border-border rounded-lg px-4 py-10 text-center">
          <p className="text-[13px] text-text-muted">
            Detailed call log with drill-down — coming soon
          </p>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    booked:              'bg-green-bg text-green-text',
    no_match:            'bg-gray-bg text-gray-text',
    declined_by_carrier: 'bg-amber-bg text-amber-text',
    failed_verification: 'bg-red-bg text-red-text',
    escalated:           'bg-purple-bg text-purple-text',
    dropped:             'bg-gray-bg text-gray-text',
    unknown:             'bg-gray-bg text-gray-text',
  }
  const cls = map[status] || 'bg-gray-bg text-gray-text'
  return <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${cls}`}>{status.replace(/_/g, ' ')}</span>
}

function SentimentPill({ sentiment }) {
  const map = {
    positive:   'bg-green-bg text-green-text',
    neutral:    'bg-blue-bg text-blue-text',
    negative:   'bg-amber-bg text-amber-text',
    frustrated: 'bg-red-bg text-red-text',
  }
  const cls = map[sentiment] || 'bg-gray-bg text-gray-text'
  return <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${cls}`}>{sentiment}</span>
}
