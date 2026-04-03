import React from 'react'

const stages = [
  { key: 'total_calls', label: 'Inbound' },
  { key: 'verified_carriers', label: 'Verified' },
  { key: 'matched_loads', label: 'Matched' },
  { key: 'entered_negotiation', label: 'Negotiated' },
  { key: 'booked', label: 'Booked' },
]

/* Cohesive indigo → violet → amber → teal → emerald (muted fills) */
const COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#14b8a6', '#10b981']

export default function ConversionFunnel({ metrics }) {
  if (!metrics) return null

  const maxVal = metrics.total_calls || 1

  return (
    <div className="border border-border rounded-xl bg-surface-0 p-5 shadow-[var(--shadow-card)]">
      <h3 className="text-[13px] font-semibold text-text-primary mb-1">Conversion Funnel</h3>
      <p className="text-[11px] text-text-muted mb-4">Inbound → booked pipeline</p>

      <div className="space-y-2.5">
        {stages.map((stage, i) => {
          const value = metrics[stage.key] ?? 0
          const pct = ((value / maxVal) * 100).toFixed(0)
          const prevValue = i > 0 ? (metrics[stages[i - 1].key] ?? 0) : null
          const dropOff = prevValue && prevValue > 0
            ? (((prevValue - value) / prevValue) * 100).toFixed(0)
            : null

          return (
            <div key={stage.key}>
              {dropOff && (
                <div className="ml-20 mb-0.5 text-[11px] text-text-muted">
                  ↓ {dropOff}% drop
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-20 flex items-center justify-end gap-2 shrink-0">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[i] }}
                    aria-hidden
                  />
                  <div className="text-[13px] text-text-secondary font-medium text-right">
                    {stage.label}
                  </div>
                </div>
                <div className="flex-1 relative h-7 bg-surface-2 rounded-md overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-md transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.max(Number(pct), 3)}%`,
                      backgroundColor: `${COLORS[i]}22`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center px-3">
                    <span className="text-[13px] font-semibold text-text-primary">{value}</span>
                    <span className="text-[11px] text-text-muted ml-1.5">{pct}%</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
