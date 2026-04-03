import React from 'react'

const SENTIMENT_ORDER = ['positive', 'neutral', 'negative', 'frustrated']

const sentimentConfig = {
  positive:   { label: 'Positive',   color: '#1a7f37' },
  neutral:    { label: 'Neutral',    color: '#0969da' },
  negative:   { label: 'Negative',   color: '#9a6700' },
  frustrated: { label: 'Frustrated', color: '#cf222e' },
}

export default function SentimentChart({ breakdown }) {
  if (!breakdown) return null

  const entries = SENTIMENT_ORDER.map((k) => [k, breakdown[k] ?? 0]).filter(([, v]) => v > 0)
  const total = entries.reduce((sum, [, v]) => sum + v, 0)

  return (
    <div className="border border-border rounded-lg p-5">
      <h3 className="text-[13px] font-medium text-text-secondary mb-4">Caller Sentiment</h3>

      <div className="flex h-4 w-full rounded-full overflow-hidden bg-surface-2 mb-4">
        {entries.map(([key, val]) => {
          const cfg = sentimentConfig[key] || { label: key, color: '#8b949e' }
          const pct = total > 0 ? (val / total) * 100 : 0
          return (
            <div
              key={key}
              className="h-full shrink-0"
              style={{
                flex: `0 0 ${pct}%`,
                backgroundColor: cfg.color,
              }}
            />
          )
        })}
      </div>

      <div className="space-y-2">
        {entries.map(([key, val]) => {
          const cfg = sentimentConfig[key] || { label: key, color: '#8b949e' }
          const pct = total > 0 ? ((val / total) * 100).toFixed(0) : '0'
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
  )
}
