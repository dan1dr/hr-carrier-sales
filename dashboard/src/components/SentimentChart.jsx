import React from 'react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const sentimentConfig = {
  positive:   { label: 'Positive',   color: '#1a7f37' },
  neutral:    { label: 'Neutral',    color: '#0969da' },
  negative:   { label: 'Negative',   color: '#9a6700' },
  frustrated: { label: 'Frustrated', color: '#cf222e' },
}

export default function SentimentChart({ breakdown }) {
  if (!breakdown) return null

  const entries = Object.entries(breakdown).filter(([, v]) => v > 0)
  const labels = entries.map(([k]) => sentimentConfig[k]?.label || k)
  const values = entries.map(([, v]) => v)
  const colors = entries.map(([k]) => sentimentConfig[k]?.color || '#8b949e')
  const total = values.reduce((a, b) => a + b, 0)

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors.map(c => c + '22'),
      borderColor: colors,
      borderWidth: 1.5,
      hoverBackgroundColor: colors.map(c => c + '44'),
      spacing: 1,
      borderRadius: 2,
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
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
    <div className="border border-border rounded-lg p-5">
      <h3 className="text-[13px] font-medium text-text-secondary mb-4">Caller Sentiment</h3>

      <div className="flex items-center gap-5">
        <div className="relative w-40 h-40 shrink-0">
          <Doughnut data={data} options={options} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-semibold text-text-primary">{total}</span>
            <span className="text-[11px] text-text-muted">calls</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {entries.map(([key, val]) => {
            const cfg = sentimentConfig[key] || { label: key, color: '#8b949e' }
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
