import React from 'react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const outcomeConfig = {
  booked:              { label: 'Booked',              color: '#059669' },
  no_match:            { label: 'No Match',            color: '#a8a29e' },
  declined_by_carrier: { label: 'Declined',            color: '#d97706' },
  failed_verification: { label: 'Failed Verification', color: '#e11d48' },
  escalated:           { label: 'Escalated',           color: '#7c3aed' },
  dropped:             { label: 'Dropped',             color: '#78716c' },
  unknown:             { label: 'Unknown',             color: '#d6d3d1' },
}

export default function OutcomeChart({ breakdown }) {
  if (!breakdown) return null

  const entries = Object.entries(breakdown).filter(([, v]) => v > 0)
  const labels = entries.map(([k]) => outcomeConfig[k]?.label || k)
  const values = entries.map(([, v]) => v)
  const colors = entries.map(([k]) => outcomeConfig[k]?.color || '#8b949e')
  const total = values.reduce((a, b) => a + b, 0)

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderWidth: 0,
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '82%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#ffffff',
        borderColor: '#e8e8e6',
        borderWidth: 1,
        titleColor: '#1f2328',
        bodyColor: '#656d76',
        cornerRadius: 6,
        padding: 10,
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.raw} (${((ctx.raw / total) * 100).toFixed(0)}%)`,
        },
      },
    },
  }

  return (
    <div className="border border-border rounded-xl bg-surface-0 p-5 shadow-[var(--shadow-card)]">
      <h3 className="text-[13px] font-semibold text-text-primary mb-1">Outcome Breakdown</h3>
      <p className="text-[11px] text-text-muted mb-4">Share of calls by result</p>

      <div className="flex items-center gap-5">
        <div className="relative w-40 h-40 shrink-0">
          <Doughnut data={data} options={options} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-semibold text-text-primary">{total}</span>
            <span className="text-[11px] text-text-muted">total</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {entries.map(([key, val]) => {
            const cfg = outcomeConfig[key] || { label: key, color: '#8b949e' }
            const pct = ((val / total) * 100).toFixed(0)
            return (
              <div key={key} className="flex items-center gap-2.5 text-[13px]">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                <span className="text-text-secondary flex-1">{cfg.label}</span>
                <span className="font-medium text-text-primary tabular-nums">{val}</span>
                <span className="text-text-muted w-8 text-right tabular-nums text-[11px]">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
