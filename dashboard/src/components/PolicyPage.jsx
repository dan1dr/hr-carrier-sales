import React from 'react'
import PolicySliders from './PolicySliders'

export default function PolicyPage({ configs, onSaved }) {
  return (
    <div className="space-y-6">
      <PolicySliders configs={configs} onSaved={onSaved} />
    </div>
  )
}
