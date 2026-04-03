import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { fetchCalls } from '../api'

const OUTCOME_META = {
  booked: { color: '#10b981', label: 'Booked' },
  handed_off: { color: '#10b981', label: 'Handed off' },
  no_match: { color: '#a8a29e', label: 'No match' },
  failed_verification: { color: '#ef4444', label: 'Failed verification' },
  declined: { color: '#f59e0b', label: 'Declined' },
  rate_rejected: { color: '#f59e0b', label: 'Rate rejected' },
}

function isSuccess(outcome) {
  return outcome === 'booked' || outcome === 'handed_off'
}

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(d) {
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateShort(d) {
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function fmtDateTime(d) {
  return `${fmtDateShort(d)}, ${fmtTime(d)}`
}

function groupByDay(calls) {
  const days = {}
  calls.forEach((c) => {
    const d = new Date(c.created_at)
    const key = d.toISOString().slice(0, 10)
    if (!days[key]) days[key] = { date: d, calls: [] }
    days[key].calls.push(c)
  })
  return Object.values(days).sort((a, b) => a.date - b.date)
}

const TIME_RANGES = [
  { id: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'All', ms: Infinity },
]

export default function AnalyticsPage() {
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

  const successCount = calls.filter((c) => isSuccess(c.outcome)).length
  const failedCount = calls.length - successCount

  const avgDuration = useMemo(() => {
    const withDuration = calls.filter((c) => c.call_duration_seconds != null)
    if (withDuration.length === 0) return null
    const avg = withDuration.reduce((s, c) => s + c.call_duration_seconds, 0) / withDuration.length
    const mins = Math.floor(avg / 60)
    const secs = Math.round(avg % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }, [calls])

  const timeFilter = (
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
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        {timeFilter}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Number of calls" value={calls.length} />
        <SummaryCard label="Average duration" value={avgDuration || '—'} />
        <SummaryCard label="Completed" value={successCount} />
        <SummaryCard label="Success rate" value={calls.length ? `${Math.round((successCount / calls.length) * 100)}%` : '—'} />
      </div>

      <div className="border border-border rounded-xl bg-surface-0 p-6 shadow-[var(--shadow-card)]">
        <div className="mb-5">
          <h3 className="text-[15px] font-semibold text-text-primary tracking-tight">Calls over time</h3>
          <p className="text-[12px] text-text-muted mt-0.5">{calls.length} calls</p>
        </div>

        {loading ? (
          <div className="h-56 flex items-center justify-center text-[13px] text-text-muted">Loading…</div>
        ) : calls.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-[13px] text-text-muted">No call data in this range</div>
        ) : (
          <LineChart calls={calls} />
        )}

        <div className="flex items-center justify-center gap-5 mt-4 pt-3 border-t border-border">
          <Legend color="#10b981" label="Completed" />
          <Legend color="#ef4444" label="Failed" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SuccessRateCard calls={calls} />
        <OutcomeSplitCard calls={calls} successCount={successCount} failedCount={failedCount} />
      </div>

      <div className="border border-border rounded-xl bg-surface-0 p-6 shadow-[var(--shadow-card)]">
        <h3 className="text-[15px] font-semibold text-text-primary tracking-tight mb-4">Call log</h3>
        <DayTable calls={calls} loading={loading} />
      </div>
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="border border-border rounded-xl bg-surface-0 p-4 shadow-[var(--shadow-card)]">
      <p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[22px] font-bold text-text-primary">{value}</p>
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

function SuccessRateCard({ calls }) {
  const rate = calls.length
    ? Math.round((calls.filter((c) => isSuccess(c.outcome)).length / calls.length) * 100)
    : 0

  return (
    <div className="border border-border rounded-xl bg-surface-0 p-5 shadow-[var(--shadow-card)]">
      <h4 className="text-[13px] font-semibold text-text-primary mb-1">Overall Success Rate</h4>
      <p className="text-[28px] font-bold text-text-primary">{rate}%</p>
    </div>
  )
}

function OutcomeSplitCard({ calls, successCount, failedCount }) {
  const total = calls.length || 1
  return (
    <div className="border border-border rounded-xl bg-surface-0 p-5 shadow-[var(--shadow-card)]">
      <h4 className="text-[13px] font-semibold text-text-primary mb-3">Outcome split</h4>
      <div className="flex h-3 rounded-full overflow-hidden bg-surface-2">
        <div className="bg-[#10b981] transition-all" style={{ width: `${(successCount / total) * 100}%` }} />
        <div className="bg-[#ef4444] transition-all" style={{ width: `${(failedCount / total) * 100}%` }} />
      </div>
      <div className="flex justify-between mt-2 text-[11px] text-text-muted">
        <span>Completed {successCount}</span>
        <span>Failed {failedCount}</span>
      </div>
    </div>
  )
}

function LineChart({ calls }) {
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
  const HEIGHT = 240
  const PAD_X = 40
  const PAD_Y = 30
  const PAD_TOP = 15
  const innerW = WIDTH - PAD_X * 2
  const innerH = HEIGHT - PAD_Y - PAD_TOP

  const bins = useMemo(() => {
    const binCount = Math.min(40, Math.max(8, Math.ceil(sorted.length / 1.5)))
    const step = range / binCount
    const result = Array.from({ length: binCount }, (_, i) => ({
      tMid: minT + (i + 0.5) * step,
      completed: 0,
      failed: 0,
    }))
    sorted.forEach((c) => {
      const idx = Math.min(Math.floor(((c._date.getTime() - minT) / range) * binCount), binCount - 1)
      if (isSuccess(c.outcome)) result[idx].completed++
      else result[idx].failed++
    })
    return result
  }, [sorted, minT, range])

  const maxVal = Math.max(...bins.map((b) => Math.max(b.completed, b.failed)), 1)

  const yTicks = useMemo(() => {
    if (maxVal <= 5) return Array.from({ length: maxVal + 1 }, (_, i) => i)
    const step = Math.ceil(maxVal / 4)
    const ticks = []
    for (let v = 0; v <= maxVal; v += step) ticks.push(v)
    return ticks
  }, [maxVal])

  const timeTicks = useMemo(() => {
    const count = 6
    return Array.from({ length: count + 1 }, (_, i) => {
      const t = minT + (range * i) / count
      const d = new Date(t)
      const isShort = range <= 24 * 3600 * 1000
      return { t, label: isShort ? fmtTime(d) : range <= 7 * 24 * 3600 * 1000 ? fmtDateTime(d) : fmtDateShort(d) }
    })
  }, [minT, range])

  const toX = useCallback((t) => PAD_X + ((t - minT) / range) * innerW, [minT, range, innerW])
  const toY = useCallback((v) => PAD_TOP + innerH - (v / maxVal) * innerH, [maxVal, innerH])

  function linePath(key) {
    return bins.map((b, i) => {
      const x = toX(b.tMid)
      const y = toY(b[key])
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    }).join(' ')
  }

  function areaPath(key) {
    const line = linePath(key)
    const lastX = toX(bins[bins.length - 1].tMid)
    const firstX = toX(bins[0].tMid)
    const base = toY(0)
    return `${line} L${lastX},${base} L${firstX},${base} Z`
  }

  const binW = innerW / bins.length

  return (
    <div ref={containerRef} className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ maxHeight: 260 }}>
        <defs>
          <linearGradient id="grad-completed-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="grad-failed-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((v) => {
          const y = toY(v)
          return (
            <g key={v}>
              <line x1={PAD_X} y1={y} x2={WIDTH - PAD_X} y2={y} stroke="var(--color-border)" strokeWidth="0.5" />
              <text x={PAD_X - 8} y={y + 3.5} textAnchor="end" fill="var(--color-text-muted)" fontSize="10">{v}</text>
            </g>
          )
        })}

        {timeTicks.map(({ t, label }, i) => (
          <text key={i} x={toX(t)} y={HEIGHT - 6} textAnchor="middle" fill="var(--color-text-muted)" fontSize="10">{label}</text>
        ))}

        <path d={areaPath('completed')} fill="url(#grad-completed-a)" />
        <path d={areaPath('failed')} fill="url(#grad-failed-a)" />

        <path d={linePath('completed')} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />
        <path d={linePath('failed')} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />

        {bins.map((b, i) => (
          <rect
            key={i}
            x={toX(b.tMid) - binW / 2}
            y={PAD_TOP}
            width={binW}
            height={innerH}
            fill="transparent"
            onMouseEnter={(e) => {
              const rect = containerRef.current.getBoundingClientRect()
              setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10, bin: b })
            }}
            onMouseMove={(e) => {
              const rect = containerRef.current.getBoundingClientRect()
              setTooltip((prev) => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top - 10 } : null)
            }}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </svg>

      {tooltip && (
        <div
          className="absolute pointer-events-none z-20 bg-surface-0 border border-border rounded-lg shadow-lg px-3 py-2 text-[11px] whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          <p className="text-text-muted mb-1">{fmtTime(new Date(tooltip.bin.tMid))}</p>
          <div className="flex items-center gap-3">
            <span className="text-[#10b981] font-medium">Completed: {tooltip.bin.completed}</span>
            <span className="text-[#ef4444] font-medium">Failed: {tooltip.bin.failed}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function DayTable({ calls, loading }) {
  const days = useMemo(() => groupByDay(calls), [calls])

  if (loading) return <p className="text-[13px] text-text-muted">Loading…</p>
  if (calls.length === 0) return <p className="text-[13px] text-text-muted">No calls yet</p>

  return (
    <div className="space-y-5 max-h-[480px] overflow-y-auto pr-1">
      {[...days].reverse().map((day) => (
        <div key={day.date.toISOString()}>
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">{fmtDate(day.date)}</p>
          <div className="space-y-1">
            {day.calls.map((c) => {
              const meta = OUTCOME_META[c.outcome] || { color: '#a8a29e', label: c.outcome }
              return (
                <div key={c.call_id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors text-[13px]">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className="text-text-muted w-14 shrink-0">{fmtTime(new Date(c.created_at))}</span>
                  <span className="text-text-primary font-medium flex-1 min-w-0 truncate">
                    {c.caller_name || c.mc_number || 'Unknown'}
                  </span>
                  <span className="text-text-muted shrink-0">{meta.label}</span>
                  {c.call_duration_seconds != null && (
                    <span className="text-text-muted shrink-0 text-[12px]">{c.call_duration_seconds}s</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
