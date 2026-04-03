import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { updateConfig } from '../api'

const TIERS = [
  { value: 'new', label: 'New' },
  { value: 'verified', label: 'Verified' },
  { value: 'premium', label: 'Premium' },
]

const THUMB = `w-full h-1 rounded-full appearance-none cursor-pointer bg-surface-3
  [&::-webkit-slider-thumb]:appearance-none
  [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:h-[18px]
  [&::-webkit-slider-thumb]:rounded-full
  [&::-webkit-slider-thumb]:bg-text-primary
  [&::-webkit-slider-thumb]:border-[2.5px] [&::-webkit-slider-thumb]:border-surface-0
  [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_var(--color-border),0_1px_3px_rgba(0,0,0,0.08)]
  [&::-webkit-slider-thumb]:cursor-pointer
  [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:h-[18px]
  [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-text-primary
  [&::-moz-range-thumb]:border-[2.5px] [&::-moz-range-thumb]:border-surface-0
  [&::-moz-range-thumb]:shadow-[0_0_0_1px_var(--color-border),0_1px_3px_rgba(0,0,0,0.08)]
  [&::-moz-range-thumb]:cursor-pointer`

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

      <div className="p-6 space-y-8">
        {/* Opening Offer */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-text-primary">Opening Offer</span>
            <span className="text-sm font-semibold text-text-primary tabular-nums">{pctFmt(form.open_pct)}</span>
          </div>
          <input
            type="range"
            min={0.75}
            max={1.00}
            step={0.01}
            value={form.open_pct}
            onChange={(e) => update('open_pct', parseFloat(e.target.value))}
            className={THUMB}
          />
          <div className="flex justify-between text-[10.5px] text-text-muted">
            <span>Aggressive · 75%</span>
            <span>100% · Conservative</span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-text-muted">
            First rate quoted to the carrier as a % of loadboard. Lower values leave more
            margin to negotiate upward.
          </p>
        </div>

        <div className="border-t border-border" />

        {/* Ceiling */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-text-primary">Ceiling</span>
            <span className="text-sm font-semibold text-text-primary tabular-nums">{pctFmt(form.ceiling_pct)}</span>
          </div>
          <input
            type="range"
            min={0.90}
            max={1.15}
            step={0.01}
            value={form.ceiling_pct}
            onChange={(e) => update('ceiling_pct', parseFloat(e.target.value))}
            className={THUMB}
          />
          <div className="flex justify-between text-[10.5px] text-text-muted">
            <span>Strict · 90%</span>
            <span>115% · Flexible</span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-text-muted">
            Max rate before walking away. Above 100% allows paying over loadboard to
            secure capacity.
          </p>
        </div>

        <div className="border-t border-border" />

        {/* Rate Override */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-[13px] font-medium transition-colors ${form.offered_rate_override != null ? 'text-text-primary' : 'text-text-muted'}`}>
              Rate Override
            </span>
            <button
              type="button"
              onClick={() => update('offered_rate_override', form.offered_rate_override != null ? null : 1500)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200
                ${form.offered_rate_override != null ? 'bg-text-primary' : 'bg-surface-3'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-1 ring-black/5
                transform transition-transform duration-200 mt-0.5
                ${form.offered_rate_override != null ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
          <div className={`relative transition-opacity duration-200 ${form.offered_rate_override != null ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-text-muted select-none">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.offered_rate_override ?? 1500}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '')
                update('offered_rate_override', v === '' ? null : parseFloat(v))
              }}
              className="w-full bg-surface-0 border border-border rounded-lg pl-7 pr-3.5 py-2.5 text-[13px] text-text-primary
                focus:outline-none focus:border-text-primary focus:ring-1 focus:ring-text-primary/10 transition-all
                [appearance:textfield]"
            />
          </div>
          <p className={`text-[11.5px] leading-relaxed transition-colors ${form.offered_rate_override != null ? 'text-text-muted' : 'text-text-muted/50'}`}>
            Hard dollar amount that bypasses the % formula. Useful for fixed-rate lanes
            or temporary market overrides.
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer
              bg-text-primary text-white hover:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
