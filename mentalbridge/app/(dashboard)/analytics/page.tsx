'use client'

import { useState } from 'react'

import AuthoritativeProgressOverview from '@/features/analytics/AuthoritativeProgressOverview'
import EmotionProgressChart from '@/features/emotion-check-in/EmotionProgressChart'
import EmotionProgressModal from '@/features/emotion-check-in/EmotionProgressModal'

import './analytics.css'

export default function AnalyticsPage() {
  const [isEmotionProgressOpen, setIsEmotionProgressOpen] = useState(false)

  return (
    <>
      <div className="analytics-page">
        <header className="analytics-hero">
          <div>
            <span>Hành trình của bạn</span>
            <h1>Thống kê &amp; Phân tích</h1>
            <p>
              Xem lại các hoạt động bạn đã ghi nhận trên MentalBridge theo thời
              gian.
            </p>
          </div>
        </header>

        <AuthoritativeProgressOverview />

        <EmotionProgressChart
          onOpenDetails={() => setIsEmotionProgressOpen(true)}
        />
      </div>
      <EmotionProgressModal
        isOpen={isEmotionProgressOpen}
        onClose={() => setIsEmotionProgressOpen(false)}
      />
    </>
  )
}
