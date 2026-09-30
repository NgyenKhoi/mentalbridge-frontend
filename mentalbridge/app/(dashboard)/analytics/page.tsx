'use client'

import { useState } from 'react'
import EmotionProgressModal from '@/features/emotion-check-in/EmotionProgressModal'
import EmotionProgressChart from '@/features/emotion-check-in/EmotionProgressChart'
import ActivitySummaryModal from '@/components/ActivitySummaryModal'
import './analytics.css'

const stats = [
  {
    label: 'Streak nhật ký',
    value: '12',
    unit: 'ngày',
    icon: '↗',
    tone: 'amber',
  },
  { label: 'Bài đánh giá', value: '8', unit: 'lần', icon: '✓', tone: 'teal' },
  {
    label: 'Phiên tư vấn',
    value: '5',
    unit: 'buổi',
    icon: '♡',
    tone: 'lavender',
  },
  {
    label: 'Trung bình tâm trạng',
    value: '3.8',
    unit: '/5',
    icon: '◡',
    tone: 'terra',
  },
]

export default function AnalyticsPage() {
  const [isEmotionProgressOpen, setIsEmotionProgressOpen] = useState(false)
  const [isActivitySummaryOpen, setIsActivitySummaryOpen] = useState(false)

  return (
    <>
      <div className="analytics-page">
        <header className="analytics-hero">
          <div>
            <span>Hành trình của bạn</span>
            <h1>Thống kê & Phân tích</h1>
            <p>
              Theo dõi những thay đổi trong sức khỏe tinh thần của bạn theo thời
              gian.
            </p>
          </div>
          <button type="button" onClick={() => setIsActivitySummaryOpen(true)}>
            <span>▤</span> Xem tổng kết hoạt động
          </button>
        </header>

        <section className="analytics-stats" aria-label="Tổng quan hoạt động">
          {stats.map((stat, index) => (
            <article
              className="analytics-stat"
              key={stat.label}
              style={{ '--delay': `${index * 65}ms` } as React.CSSProperties}
            >
              <span className={`analytics-stat-icon ${stat.tone}`}>
                {stat.icon}
              </span>
              <div>
                <strong>
                  {stat.value}
                  <small>{stat.unit}</small>
                </strong>
                <p>{stat.label}</p>
              </div>
            </article>
          ))}
        </section>

        <EmotionProgressChart
          onOpenDetails={() => setIsEmotionProgressOpen(true)}
        />

        <aside className="analytics-insights">
          <div className="analytics-insight-title">
            <span>✦</span>
            <div>
              <strong>Nhận xét từ dữ liệu</strong>
              <small>Tổng hợp từ các ghi nhận của bạn</small>
            </div>
          </div>
          <ul>
            <li className="positive">
              <span>✓</span>Tâm trạng được ghi nhận có xu hướng{' '}
              <strong>tích cực hơn</strong> so với tuần trước.
            </li>
            <li className="positive">
              <span>✓</span>Bạn đã duy trì viết nhật ký{' '}
              <strong>12 ngày liên tiếp</strong>.
            </li>
            <li className="attention">
              <span>!</span>Thứ Sáu có mức tâm trạng thấp hơn; bạn có thể ghi
              chú thêm bối cảnh để hiểu rõ hơn.
            </li>
          </ul>
        </aside>
      </div>
      <ActivitySummaryModal
        isOpen={isActivitySummaryOpen}
        onClose={() => setIsActivitySummaryOpen(false)}
      />
      <EmotionProgressModal
        isOpen={isEmotionProgressOpen}
        onClose={() => setIsEmotionProgressOpen(false)}
      />
    </>
  )
}
