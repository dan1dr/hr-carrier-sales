import React from 'react'

const cards = [
  { label: 'Total Calls', key: 'total_calls' },
  { label: 'Verified', key: 'verified_carriers', showConversion: true },
  { label: 'Matched', key: 'matched_loads' },
  { label: 'Negotiated', key: 'entered_negotiation' },
  { label: 'Booked', key: 'booked', showConversion: true },
]

export default function MetricCards({ metrics }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const value = metrics?.[card.key]
        const total = metrics?.total_calls
        const convPct = card.showConversion && total
          ? ((value / total) * 100).toFixed(1)
          : null

        return (
          <div key={card.key} className="border border-border rounded-xl bg-surface-0 px-5 py-4 shadow-[var(--shadow-card)]">
            <div className="text-2xl font-semibold text-text-primary tracking-tight">
              {value ?? '—'}
            </div>
            <div className="text-[13px] text-text-muted mt-0.5">{card.label}</div>
            {convPct && (
              <div className="mt-1.5">
                <span className="inline-block px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-green-bg text-green-text">
                  {convPct}%
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
