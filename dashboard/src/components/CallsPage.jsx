import React, { useState, useEffect, useCallback } from 'react'
import { fetchCalls, fetchCall } from '../api'

function formatDuration(seconds) {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatDate(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatRate(rate) {
  if (rate == null) return '—'
  return `$${Number(rate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const OUTCOME_OPTIONS = ['all', 'booked', 'no_match', 'declined_by_carrier', 'failed_verification', 'escalated', 'dropped', 'unknown']
const SENTIMENT_OPTIONS = ['all', 'positive', 'neutral', 'negative', 'frustrated']

export default function CallsPage({ metrics }) {
  const totalCalls = metrics?.total_calls ?? null
  const totalMinutes = metrics?.total_call_minutes ?? null
  const avgDuration = metrics?.avg_call_duration_seconds ?? null

  const [calls, setCalls] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [sentimentFilter, setSentimentFilter] = useState('all')
  const [selectedCall, setSelectedCall] = useState(null)
  const [callDetail, setCallDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadCalls = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (outcomeFilter !== 'all') params.outcome = outcomeFilter
      if (sentimentFilter !== 'all') params.sentiment = sentimentFilter
      const data = await fetchCalls(params)
      setCalls(data.calls || [])
      setTotal(data.total || 0)
    } catch { /* ignore */ }
    setLoading(false)
  }, [outcomeFilter, sentimentFilter])

  useEffect(() => { loadCalls() }, [loadCalls])

  const openDetail = async (callId) => {
    setSelectedCall(callId)
    setDetailLoading(true)
    try {
      const data = await fetchCall(callId)
      setCallDetail(data)
    } catch { setCallDetail(null) }
    setDetailLoading(false)
  }

  const stats = [
    { value: totalCalls ?? '—', label: 'Total calls' },
    { value: totalMinutes != null ? Math.round(totalMinutes) : '—', label: 'Total call minutes' },
    { value: formatDuration(avgDuration), label: 'Avg call duration' },
  ]

  return (
    <div className="space-y-6">
      {/* Call Stats */}
      <div>
        <h2 className="text-[13px] font-medium text-text-secondary mb-3">Calls</h2>
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="border border-border rounded-lg px-5 py-4">
              <div className="text-2xl font-semibold text-text-primary tracking-tight">{stat.value}</div>
              <div className="text-[13px] text-text-muted mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-[13px] text-text-muted">Filter:</span>
        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="text-[13px] border border-border rounded-md px-2.5 py-1.5 bg-surface-0 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {OUTCOME_OPTIONS.map((o) => (
            <option key={o} value={o}>{o === 'all' ? 'All outcomes' : o.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={sentimentFilter}
          onChange={(e) => setSentimentFilter(e.target.value)}
          className="text-[13px] border border-border rounded-md px-2.5 py-1.5 bg-surface-0 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {SENTIMENT_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All sentiments' : s}</option>
          ))}
        </select>
        <span className="text-[11px] text-text-muted ml-auto">
          {total} call{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Call Log Table */}
      <div>
        <h2 className="text-[13px] font-medium text-text-secondary mb-3">Call Log</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-2">
                <th className="text-left px-4 py-2.5 font-medium text-text-secondary">Time</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-secondary">Caller</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-secondary">Lane</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-secondary">Outcome</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-secondary">Sentiment</th>
                <th className="text-right px-4 py-2.5 font-medium text-text-secondary">Rate</th>
                <th className="text-right px-4 py-2.5 font-medium text-text-secondary">Duration</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
              ) : calls.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">No calls found</td></tr>
              ) : (
                calls.map((call) => (
                  <tr
                    key={call.call_id}
                    onClick={() => openDetail(call.call_id)}
                    className="border-t border-border hover:bg-surface-2/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{formatDate(call.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-text-primary">{call.caller_name || '—'}</div>
                      <div className="text-[11px] text-text-muted">{call.mc_number || ''}</div>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">
                      {call.requested_origin && call.requested_destination
                        ? `${call.requested_origin} → ${call.requested_destination}`
                        : call.requested_origin || '—'}
                    </td>
                    <td className="px-4 py-2.5"><StatusPill status={call.outcome} /></td>
                    <td className="px-4 py-2.5"><SentimentPill sentiment={call.sentiment} /></td>
                    <td className="text-right px-4 py-2.5 text-text-primary tabular-nums font-medium">{formatRate(call.final_rate)}</td>
                    <td className="text-right px-4 py-2.5 text-text-muted tabular-nums">{formatDuration(call.call_duration_seconds)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down Modal */}
      {selectedCall && (
        <CallDetailModal
          call={callDetail}
          loading={detailLoading}
          onClose={() => { setSelectedCall(null); setCallDetail(null) }}
        />
      )}
    </div>
  )
}

function CallDetailModal({ call, loading, onClose }) {
  if (loading) {
    return (
      <Overlay onClose={onClose}>
        <div className="text-center py-12 text-text-muted text-[13px]">Loading call details...</div>
      </Overlay>
    )
  }
  if (!call) {
    return (
      <Overlay onClose={onClose}>
        <div className="text-center py-12 text-text-muted text-[13px]">Call not found</div>
      </Overlay>
    )
  }

  const fields = [
    ['Call ID', call.call_id],
    ['Caller', call.caller_name],
    ['MC Number', call.mc_number],
    ['Lane', call.requested_origin && call.requested_destination ? `${call.requested_origin} → ${call.requested_destination}` : call.requested_origin || '—'],
    ['Equipment', call.equipment_type],
    ['Outcome', call.outcome],
    ['Sentiment', call.sentiment],
    ['Loadboard Rate', formatRate(call.loadboard_rate)],
    ['Final Rate', formatRate(call.final_rate)],
    ['Margin', call.margin_retained_pct != null ? `${call.margin_retained_pct}%` : '—'],
    ['Negotiation Rounds', call.negotiation_rounds],
    ['Duration', formatDuration(call.call_duration_seconds)],
    ['Handoff Required', call.handoff_required ? 'Yes' : 'No'],
    ['Timestamp', formatDate(call.created_at)],
  ]

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-text-primary">Call Detail</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1 cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px] mb-5">
        {fields.map(([label, value]) => (
          <div key={label} className="flex justify-between py-1 border-b border-border/50">
            <span className="text-text-muted">{label}</span>
            <span className="text-text-primary font-medium text-right">{value ?? '—'}</span>
          </div>
        ))}
      </div>

      {call.summary && (
        <div className="mb-5">
          <h4 className="text-[12px] font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Summary</h4>
          <p className="text-[13px] text-text-primary leading-relaxed bg-surface-2 rounded-md p-3">{call.summary}</p>
        </div>
      )}

      {call.events && call.events.length > 0 && (
        <div>
          <h4 className="text-[12px] font-medium text-text-secondary mb-2 uppercase tracking-wider">Events</h4>
          <div className="space-y-2">
            {call.events.map((ev) => (
              <div key={ev.event_id} className="border border-border rounded-md px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-medium text-text-primary">{ev.event_type}</span>
                  <span className="text-[11px] text-text-muted">{formatDate(ev.created_at)}</span>
                </div>
                {ev.payload && (
                  <pre className="text-[11px] text-text-muted bg-surface-2 rounded p-2 overflow-x-auto max-h-40 mt-1">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Overlay>
  )
}

function Overlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative bg-surface-0 border border-border rounded-xl shadow-lg max-w-2xl w-full mx-4 max-h-[75vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
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
  if (!status) return <span className="text-text-muted">—</span>
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
  if (!sentiment) return <span className="text-text-muted">—</span>
  const cls = map[sentiment] || 'bg-gray-bg text-gray-text'
  return <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${cls}`}>{sentiment}</span>
}
