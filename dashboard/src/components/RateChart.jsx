import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { fetchCalls } from '../api'

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function fmtDateShort(d) {
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
function fmtDollar(v) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const TIME_RANGES = [
  { id: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'All', ms: Infinity },
]

export default function RateChart() {
  const [allCalls, setAllCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('all')

  useEffect(() => {
    let cancelled = false
    fetchCalls({ limit: 200 })
      .then((data) => { if (!cancelled) setAllCalls(data.calls || []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const calls = useMemo(() => {
    const range = TIME_RANGES.find((r) => r.id === timeRange)
    if (!range || range.ms === Infinity) return allCalls
    const cutoff = Date.now() - range.ms
    return allCalls.filter((c) => new Date(c.created_at).getTime() >= cutoff)
  }, [allCalls, timeRange])

  const ratedCalls = useMemo(() =>
    calls.filter((c) => c.final_rate != null && c.loadboard_rate != null && c.loadboard_rate > 0),
  [calls])

  const avgAgreedRate = useMemo(() => {
    if (ratedCalls.length === 0) return null
    return ratedCalls.reduce((s, c) => s + c.final_rate, 0) / ratedCalls.length
  }, [ratedCalls])

  const avgMarginPct = useMemo(() => {
    if (ratedCalls.length === 0) return null
    const margins = ratedCalls.map((c) => ((c.loadboard_rate - c.final_rate) / c.loadboard_rate) * 100)
    return margins.reduce((s, m) => s + m, 0) / margins.length
  }, [ratedCalls])

  const totalSaved = useMemo(() => {
    if (ratedCalls.length === 0) return null
    return ratedCalls.reduce((s, c) => s + (c.loadboard_rate - c.final_rate), 0)
  }, [ratedCalls])

  const totalAgreed = useMemo(() => {
    if (ratedCalls.length === 0) return null
    return ratedCalls.reduce((s, c) => s + c.final_rate, 0)
  }, [ratedCalls])

  return (
    <div className="border border-border rounded-xl bg-surface-0 p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-[15px] font-semibold text-text-primary tracking-tight">Rate comparison</h3>
          <p className="text-[12px] text-text-muted mt-0.5">Agreed rate vs loadboard rate per call</p>
        </div>
        <div className="flex items-center gap-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setTimeRange(r.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                timeRange === r.id
                  ? 'bg-surface-2 text-text-primary'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-2/60'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-5 mb-5">
        <div className="border border-border rounded-lg px-4 py-2.5">
          <p className="text-[10px] text-text-muted uppercase tracking-wide font-medium">Total saved vs loadboard</p>
          <p className="text-[24px] font-bold text-text-primary tabular-nums">{totalSaved != null ? fmtDollar(totalSaved) : '—'}</p>
        </div>
        <div className="h-10 w-px bg-border" />
        <Stat label="Avg agreed rate" value={avgAgreedRate != null ? fmtDollar(avgAgreedRate) : '—'} />
        <Stat label="Total agreed" value={totalAgreed != null ? fmtDollar(totalAgreed) : '—'} />
        <Stat label="Avg margin" value={avgMarginPct != null ? `${avgMarginPct.toFixed(1)}%` : '—'} />
      </div>

      {loading ? (
        <div className="h-52 flex items-center justify-center text-[13px] text-text-muted">Loading…</div>
      ) : ratedCalls.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-[13px] text-text-muted">No rate data in this range</div>
      ) : (
        <RateLineChart calls={ratedCalls} />
      )}

      <div className="flex items-center justify-center gap-5 mt-4 pt-3 border-t border-border">
        <Legend color="#10b981" label="Agreed rate" />
        <Legend color="#78716c" label="Loadboard rate" />
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-text-muted uppercase tracking-wide">{label}</p>
      <p className="text-[18px] font-bold text-text-primary tabular-nums">{value}</p>
    </div>
  )
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-[2px] rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-text-muted">{label}</span>
    </div>
  )
}

function RateLineChart({ calls }) {
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  const sorted = useMemo(() =>
    [...calls]
      .map((c) => ({ ...c, _date: new Date(c.created_at) }))
      .sort((a, b) => a._date - b._date),
  [calls])

  const minT = sorted[0]._date.getTime()
  const maxT = sorted[sorted.length - 1]._date.getTime()
  const range = maxT - minT || 1

  const WIDTH = 900
  const HEIGHT = 220
  const PAD_X = 55
  const PAD_Y = 30
  const PAD_TOP = 10
  const innerW = WIDTH - PAD_X * 2
  const innerH = HEIGHT - PAD_Y - PAD_TOP

  const allRates = sorted.flatMap((c) => [c.final_rate, c.loadboard_rate])
  const minRate = Math.floor(Math.min(...allRates) * 0.9)
  const maxRate = Math.ceil(Math.max(...allRates) * 1.05)
  const rateRange = maxRate - minRate || 1

  const yTicks = useMemo(() => {
    const step = Math.ceil(rateRange / 4 / 100) * 100 || 100
    const ticks = []
    for (let v = Math.floor(minRate / step) * step; v <= maxRate; v += step) {
      if (v >= minRate) ticks.push(v)
    }
    return ticks
  }, [minRate, maxRate, rateRange])

  const timeTicks = useMemo(() => {
    const count = 6
    return Array.from({ length: count + 1 }, (_, i) => {
      const t = minT + (range * i) / count
      const d = new Date(t)
      return { t, label: range > 2 * 24 * 3600 * 1000 ? fmtDateShort(d) : fmtTime(d) }
    })
  }, [minT, range])

  const toX = useCallback((t) => PAD_X + ((t - minT) / range) * innerW, [minT, range, innerW])
  const toY = useCallback((v) => PAD_TOP + innerH - ((v - minRate) / rateRange) * innerH, [minRate, rateRange, innerH])

  function linePath(key) {
    return sorted.map((c, i) => {
      const x = toX(c._date.getTime())
      const y = toY(c[key])
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    }).join(' ')
  }

  function areaPath(key) {
    const line = linePath(key)
    const lastX = toX(sorted[sorted.length - 1]._date.getTime())
    const firstX = toX(sorted[0]._date.getTime())
    const base = toY(minRate)
    return `${line} L${lastX},${base} L${firstX},${base} Z`
  }

  return (
    <div ref={containerRef} className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ maxHeight: 240 }}>
        <defs>
          <linearGradient id="grad-agreed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((v) => {
          const y = toY(v)
          return (
            <g key={v}>
              <line x1={PAD_X} y1={y} x2={WIDTH - PAD_X} y2={y} stroke="var(--color-border)" strokeWidth="0.5" />
              <text x={PAD_X - 8} y={y + 3.5} textAnchor="end" fill="var(--color-text-muted)" fontSize="10">{fmtDollar(v)}</text>
            </g>
          )
        })}

        {timeTicks.map(({ t, label }, i) => (
          <text key={i} x={toX(t)} y={HEIGHT - 6} textAnchor="middle" fill="var(--color-text-muted)" fontSize="10">{label}</text>
        ))}

        <path d={areaPath('final_rate')} fill="url(#grad-agreed)" />

        <path d={linePath('loadboard_rate')} fill="none" stroke="#78716c" strokeWidth="2" strokeLinejoin="round" strokeDasharray="5 3" />
        <path d={linePath('final_rate')} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />

        {sorted.map((c, i) => {
          const x = toX(c._date.getTime())
          return (
            <rect
              key={i}
              x={x - innerW / sorted.length / 2}
              y={PAD_TOP}
              width={innerW / sorted.length}
              height={innerH}
              fill="transparent"
              onMouseEnter={(e) => {
                const rect = containerRef.current.getBoundingClientRect()
                setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10, call: c })
              }}
              onMouseMove={(e) => {
                const rect = containerRef.current.getBoundingClientRect()
                setTooltip((prev) => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top - 10 } : null)
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          )
        })}
      </svg>

      {tooltip && (
        <div
          className="absolute pointer-events-none z-20 bg-surface-0 border border-border rounded-lg shadow-lg px-3 py-2 text-[11px] whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          <p className="text-text-muted mb-1">
            {tooltip.call.caller_name || tooltip.call.mc_number || 'Call'} · {fmtTime(tooltip.call._date)}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-[#10b981] font-medium">Agreed: {fmtDollar(tooltip.call.final_rate)}</span>
            <span className="text-text-muted font-medium">Board: {fmtDollar(tooltip.call.loadboard_rate)}</span>
          </div>
          <p className="text-text-muted mt-0.5">
            Margin: {((tooltip.call.loadboard_rate - tooltip.call.final_rate) / tooltip.call.loadboard_rate * 100).toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  )
}
