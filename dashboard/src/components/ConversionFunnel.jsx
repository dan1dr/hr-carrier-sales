import React from 'react'

const stages = [
  { key: 'total_calls', label: 'Inbound' },
  { key: 'verified_carriers', label: 'Verified' },
  { key: 'matched_loads', label: 'Matched' },
  { key: 'entered_negotiation', label: 'Negotiated' },
  { key: 'booked', label: 'Booked' },
]

const COLORS = ['#57534e', '#78716c', '#a8a29e', '#0d9488', '#10b981']

export default function ConversionFunnel({ metrics }) {
  if (!metrics) return null

  const maxVal = metrics.total_calls || 1

  return (
    <div className="border border-border rounded-xl bg-surface-0 p-5 shadow-[var(--shadow-card)]">
      <h3 className="text-[13px] font-semibold text-text-primary mb-1">Conversion Funnel</h3>
      <p className="text-[11px] text-text-muted mb-5">Inbound → booked pipeline</p>

      <div className="relative">
        {/* Vertical connector line */}
        <div
          className="absolute left-[88px] top-3 bottom-3 w-px bg-border"
          aria-hidden
        />

        <div className="space-y-4">
          {stages.map((stage, i) => {
            const value = metrics[stage.key] ?? 0
            const pct = ((value / maxVal) * 100).toFixed(0)
            const prevValue = i > 0 ? (metrics[stages[i - 1].key] ?? 0) : null
            const dropOff = prevValue && prevValue > 0
              ? (((prevValue - value) / prevValue) * 100).toFixed(0)
              : null

            return (
              <div key={stage.key} className="relative flex items-center gap-4">
                {/* Node circle on the connector line */}
                <div className="w-20 flex items-center justify-end shrink-0 relative z-10">
                  <div className="text-[12px] text-text-muted font-medium text-right pr-3">
                    {stage.label}
                  </div>
                  <div
                    className="w-3 h-3 rounded-full border-2 bg-surface-0 shrink-0"
                    style={{ borderColor: COLORS[i] }}
                  />
                </div>

                {/* Value + bar */}
                <div className="flex-1 flex items-center gap-3">
                  <div className="flex items-baseline gap-1.5 w-16 shrink-0">
                    <span className="text-[16px] font-bold text-text-primary tabular-nums">{value}</span>
                    <span className="text-[11px] text-text-muted">{pct}%</span>
                  </div>
                  <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.max(Number(pct), 4)}%`,
                        backgroundColor: COLORS[i],
                      }}
                    />
                  </div>
                  {dropOff && (
                    <span className="text-[10px] text-text-muted shrink-0 w-12 text-right">↓{dropOff}%</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
