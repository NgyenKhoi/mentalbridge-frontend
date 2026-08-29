'use client'

import { useState } from 'react'
import EmotionProgressModal from '@/components/EmotionProgressModal'
import ActivitySummaryModal from '@/components/ActivitySummaryModal'
import './analytics.css'

const stats = [
  { label: 'Streak nhật ký', value: '12', unit: 'ngày', icon: '↗', tone: 'amber' },
  { label: 'Bài đánh giá', value: '8', unit: 'lần', icon: '✓', tone: 'teal' },
  { label: 'Phiên tư vấn', value: '5', unit: 'buổi', icon: '♡', tone: 'lavender' },
  { label: 'Trung bình tâm trạng', value: '3.8', unit: '/5', icon: '◡', tone: 'terra' },
]

const points = [
  { x: 55, y: 90, day: 'T2', label: 'Tốt', tone: 'teal', width: 50 },
  { x: 153, y: 135, day: 'T3', label: 'Bình thường', tone: 'amber', width: 78 },
  { x: 267, y: 45, day: 'T4', label: 'Tuyệt vời', tone: 'deep', width: 70 },
  { x: 380, y: 90, day: 'T5', label: 'Tốt', tone: 'teal', width: 50 },
  { x: 493, y: 180, day: 'T6', label: 'Không tốt', tone: 'terra', width: 70 },
  { x: 607, y: 90, day: 'T7', label: 'Tốt', tone: 'teal', width: 50 },
  { x: 720, y: 45, day: 'CN', label: 'Tuyệt vời', tone: 'deep', width: 70 },
]

export default function AnalyticsPage() {
  const [isEmotionProgressOpen, setIsEmotionProgressOpen] = useState(false)
  const [isActivitySummaryOpen, setIsActivitySummaryOpen] = useState(false)

  return <>
  <div className="analytics-page">
    <header className="analytics-hero"><div><span>Hành trình của bạn</span><h1>Thống kê & Phân tích</h1><p>Theo dõi những thay đổi trong sức khỏe tinh thần của bạn theo thời gian.</p></div><button type="button" onClick={() => setIsActivitySummaryOpen(true)}><span>▤</span> Xem tổng kết hoạt động</button></header>

    <section className="analytics-stats" aria-label="Tổng quan hoạt động">
      {stats.map((stat, index) => <article className="analytics-stat" key={stat.label} style={{ '--delay': `${index * 65}ms` } as React.CSSProperties}>
        <span className={`analytics-stat-icon ${stat.tone}`}>{stat.icon}</span>
        <div><strong>{stat.value}<small>{stat.unit}</small></strong><p>{stat.label}</p></div>
      </article>)}
    </section>

    <section className="analytics-chart-card">
      <div className="analytics-chart-head"><div><span>7 ngày gần nhất</span><h2>Xu hướng tâm trạng tuần này</h2></div><div className="analytics-chart-actions"><div className="analytics-legend"><span className="terra">Không tốt</span><span className="amber">Bình thường</span><span className="teal">Tốt</span><span className="deep">Tuyệt vời</span></div><button onClick={() => setIsEmotionProgressOpen(true)}>Xem chi tiết <b>→</b></button></div></div>
      <div className="analytics-chart-scroll"><svg className="analytics-chart" viewBox="0 0 780 245" role="img" aria-label="Biểu đồ tâm trạng từ thứ Hai đến Chủ nhật">
        <defs><linearGradient id="moodArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--teal-deep)" stopOpacity=".16"/><stop offset="100%" stopColor="var(--teal-deep)" stopOpacity="0"/></linearGradient></defs>
        {[45,90,135,180].map(y => <line key={y} x1="55" y1={y} x2="745" y2={y} className="analytics-grid-line" />)}
        <text x="0" y="49" className="analytics-axis">Tuyệt vời</text><text x="18" y="94" className="analytics-axis">Tốt</text><text x="0" y="139" className="analytics-axis">Bình thường</text><text x="0" y="184" className="analytics-axis">Không tốt</text>
        <path className="analytics-area" d="M55 90C104 90 104 135 153 135C210 135 210 45 267 45C324 45 324 90 380 90C437 90 437 180 493 180C550 180 550 90 607 90C664 90 664 45 720 45L720 190L55 190Z" />
        <path className="analytics-line" d="M55 90C104 90 104 135 153 135C210 135 210 45 267 45C324 45 324 90 380 90C437 90 437 180 493 180C550 180 550 90 607 90C664 90 664 45 720 45" />
        {points.map((point, index) => <g key={point.day} className={`analytics-point ${point.tone}`} style={{ '--delay': `${900 + index * 90}ms` } as React.CSSProperties}>
          <rect x={point.x - point.width / 2} y={point.y - 27} width={point.width} height="18" rx="9"/><text x={point.x} y={point.y - 15} textAnchor="middle">{point.label}</text><circle cx={point.x} cy={point.y} r="5"/><text className="analytics-day" x={point.x} y="215" textAnchor="middle">{point.day}</text>
        </g>)}
      </svg></div>
    </section>

    <aside className="analytics-insights"><div className="analytics-insight-title"><span>✦</span><div><strong>Nhận xét từ dữ liệu</strong><small>Thông tin hỗ trợ theo dõi, không phải kết luận chuyên môn</small></div></div><ul><li className="positive"><span>✓</span>Tâm trạng được ghi nhận có xu hướng <strong>tích cực hơn</strong> so với tuần trước.</li><li className="positive"><span>✓</span>Bạn đã duy trì viết nhật ký <strong>12 ngày liên tiếp</strong>.</li><li className="attention"><span>!</span>Thứ Sáu có mức tâm trạng thấp hơn; bạn có thể ghi chú thêm bối cảnh để hiểu rõ hơn.</li></ul></aside>
  </div>
  <ActivitySummaryModal isOpen={isActivitySummaryOpen} onClose={() => setIsActivitySummaryOpen(false)} />
  <EmotionProgressModal isOpen={isEmotionProgressOpen} onClose={() => setIsEmotionProgressOpen(false)} />
  </>
}
