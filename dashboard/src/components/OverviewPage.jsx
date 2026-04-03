import React from 'react'
import MetricCards from './MetricCards'
import RateChart from './RateChart'
import OutcomeChart from './OutcomeChart'
import SentimentChart from './SentimentChart'
import PerformanceCards from './PerformanceCards'

export default function OverviewPage({ metrics }) {
  return (
    <div className="space-y-6">
      <MetricCards metrics={metrics} />
      <RateChart />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OutcomeChart breakdown={metrics?.outcome_breakdown} />
        <SentimentChart breakdown={metrics?.sentiment_breakdown} />
      </div>
      <PerformanceCards metrics={metrics} />
    </div>
  )
}
