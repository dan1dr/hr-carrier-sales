import React from 'react'

export default function PlaceholderPage({ title, subtitle }) {
  return (
    <div className="border border-border rounded-xl bg-surface-0 p-10 text-center shadow-[var(--shadow-card)]">
      <h2 className="text-[17px] font-semibold text-text-primary tracking-tight">{title}</h2>
      <p className="text-[13px] text-text-muted mt-2 max-w-md mx-auto leading-relaxed">{subtitle}</p>
    </div>
  )
}
