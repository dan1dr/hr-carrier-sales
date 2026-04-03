import React from 'react'

export default function PerformanceCards({ metrics }) {
  if (!metrics) return null

  const margin = metrics.avg_margin_pct
  const rounds = metrics.avg_negotiation_rounds
  const bookingRate = metrics.total_calls
    ? ((metrics.booked / metrics.total_calls) * 100).toFixed(1)
    : null

  const cards = [
    { label: 'Avg Margin', value: margin != null ? `${margin.toFixed(1)}%` : '—', sub: 'Retained per load' },
    { label: 'Avg Rounds', value: rounds != null ? rounds.toFixed(1) : '—', sub: 'Negotiation cycles' },
    { label: 'Booking Rate', value: bookingRate != null ? `${bookingRate}%` : '—', sub: 'Calls → booked' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="border border-border rounded-lg px-5 py-4">
          <div className="text-2xl font-semibold text-text-primary tracking-tight">
            {card.value}
          </div>
          <div className="text-[13px] text-text-muted mt-0.5">{card.label}</div>
          <div className="text-[11px] text-text-muted mt-1">{card.sub}</div>
        </div>
      ))}
    </div>
  )
}
