import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { updateConfig } from '../api'

const TIERS = [
  { value: 'new', label: 'New' },
  { value: 'verified', label: 'Verified' },
  { value: 'premium', label: 'Premium' },
]

const SENSITIVITY_OPTIONS = ['low', 'medium', 'high']

function SliderInput({ label, value, onChange, min, max, step, format }) {
  const displayValue = format ? format(value) : value

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[13px] text-text-secondary">{label}</label>
        <span className="text-[13px] font-semibold text-text-primary tabular-nums">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer
          bg-surface-3
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-accent
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5
          [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent
          [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
      />
      <div className="flex justify-between text-[11px] text-text-muted">
        <span>{format ? format(min) : min}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  )
}

export default function PolicySliders({ configs, onSaved }) {
  const [activeTier, setActiveTier] = useState('new')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const cfg = configs?.find((c) => c.tier === activeTier)
    if (cfg) setForm({ ...cfg })
  }, [activeTier, configs])

  if (!form) return null

  const update = (key, val) => setForm((prev) => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateConfig(form)
      toast.success(`${activeTier} tier saved`, {
        style: { background: '#fff', color: '#1f2328', border: '1px solid #e8e8e6', fontSize: '13px' },
      })
      onSaved?.()
    } catch (err) {
      toast.error(`Failed: ${err.message}`, {
        style: { background: '#fff', color: '#1f2328', border: '1px solid #e8e8e6', fontSize: '13px' },
      })
    } finally {
      setSaving(false)
    }
  }

  const pctFmt = (v) => `${(v * 100).toFixed(0)}%`

  return (
    <div className="border border-border rounded-xl bg-surface-0 shadow-[var(--shadow-card)]">
      {/* Tier Tabs */}
      <div className="flex items-center gap-0 border-b border-border">
        {TIERS.map((tier) => (
          <button
            key={tier.value}
            onClick={() => setActiveTier(tier.value)}
            className={`px-5 py-2.5 text-[13px] font-medium transition-colors cursor-pointer border-b-2 -mb-px
              ${activeTier === tier.value
                ? 'border-text-primary text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
          >
            {tier.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SliderInput
            label="Opening Offer %"
            value={form.open_pct}
            onChange={(v) => update('open_pct', v)}
            min={0.75}
            max={0.99}
            step={0.01}
            format={pctFmt}
          />

          <SliderInput
            label="Ceiling %"
            value={form.ceiling_pct}
            onChange={(v) => update('ceiling_pct', v)}
            min={0.90}
            max={1.15}
            step={0.01}
            format={pctFmt}
          />

          <SliderInput
            label="Urgency Boost %"
            value={form.urgency_boost_pct}
            onChange={(v) => update('urgency_boost_pct', v)}
            min={0.00}
            max={0.15}
            step={0.01}
            format={pctFmt}
          />

          <div className="space-y-1.5">
            <label className="text-[13px] text-text-secondary">Max Rounds</label>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => update('max_rounds', n)}
                  className={`flex-1 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer border
                    ${form.max_rounds === n
                      ? 'bg-text-primary text-white border-text-primary'
                      : 'bg-surface-0 border-border text-text-muted hover:text-text-secondary hover:border-border-hover'
                    }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] text-text-secondary">Escalation Sensitivity</label>
            <div className="flex gap-2">
              {SENSITIVITY_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => update('escalation_sensitivity', s)}
                  className={`flex-1 py-2 rounded-md text-[13px] font-medium capitalize transition-colors cursor-pointer border
                    ${form.escalation_sensitivity === s
                      ? 'bg-text-primary text-white border-text-primary'
                      : 'bg-surface-0 border-border text-text-muted hover:text-text-secondary hover:border-border-hover'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] text-text-secondary">Rate Override</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={form.offered_rate_override ?? ''}
                onChange={(e) => update('offered_rate_override', e.target.value === '' ? null : parseFloat(e.target.value))}
                placeholder="Auto (use %)"
                className="flex-1 bg-surface-0 border border-border rounded-md px-3 py-2 text-[13px] text-text-primary
                  placeholder-text-muted focus:outline-none focus:border-text-primary transition-colors"
              />
              {form.offered_rate_override != null && (
                <button
                  onClick={() => update('offered_rate_override', null)}
                  className="text-[11px] text-text-muted hover:text-red-text transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer
              bg-text-primary text-white hover:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
