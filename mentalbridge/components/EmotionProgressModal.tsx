'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import './EmotionProgressModal.css'

type Props = {
  isOpen: boolean
  onClose: () => void
}

type PeriodKey = '7d' | '30d' | '90d'

const PERIODS: Record<
  PeriodKey,
  {
    label: string
    range: string
    values: number[]
    labels: string[]
    average: string
    change: string
    entries: number
  }
> = {
  '7d': {
    label: '7 ngày',
    range: '20–26 tháng 8',
    values: [4, 3, 5, 4, 2, 4, 5],
    labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
    average: '3.9',
    change: '+0.6',
    entries: 7,
  },
  '30d': {
    label: '30 ngày',
    range: '28 tháng 7–26 tháng 8',
    values: [3, 3, 4, 2, 4, 3, 5, 4, 4, 5],
    labels: [
      '28/7',
      '31/7',
      '04/8',
      '07/8',
      '10/8',
      '13/8',
      '16/8',
      '19/8',
      '22/8',
      '26/8',
    ],
    average: '3.7',
    change: '+0.4',
    entries: 23,
  },
  '90d': {
    label: '3 tháng',
    range: '28 tháng 5–26 tháng 8',
    values: [2, 3, 2, 3, 3, 4, 3, 4, 4, 3, 4, 5],
    labels: [
      '28/5',
      '05/6',
      '13/6',
      '21/6',
      '29/6',
      '07/7',
      '15/7',
      '23/7',
      '31/7',
      '08/8',
      '17/8',
      '26/8',
    ],
    average: '3.4',
    change: '+1.1',
    entries: 61,
  },
}

const MOODS = [
  { score: 5, emoji: '😄', label: 'Tuyệt vời', percent: 24, tone: 'deep' },
  { score: 4, emoji: '😊', label: 'Tốt', percent: 38, tone: 'teal' },
  { score: 3, emoji: '😌', label: 'Bình thường', percent: 23, tone: 'amber' },
  { score: 2, emoji: '😟', label: 'Không tốt', percent: 11, tone: 'terra' },
  { score: 1, emoji: '😞', label: 'Rất khó khăn', percent: 4, tone: 'muted' },
]

const FACTORS = [
  {
    icon: '☼',
    label: 'Vận động',
    count: '5 lần',
    impact: 'Thường đi cùng tâm trạng tốt',
    tone: 'positive',
  },
  {
    icon: '◷',
    label: 'Giấc ngủ',
    count: '4 lần',
    impact: 'Ngủ đủ giúp cảm xúc ổn định hơn',
    tone: 'positive',
  },
  {
    icon: '↗',
    label: 'Áp lực công việc',
    count: '3 lần',
    impact: 'Xuất hiện ở các ngày điểm thấp',
    tone: 'attention',
  },
]

const RECENT = [
  {
    date: '26/08',
    emoji: '😄',
    mood: 'Tuyệt vời',
    note: 'Hoàn thành công việc sớm và có thời gian đi bộ.',
    score: 5,
  },
  {
    date: '25/08',
    emoji: '😊',
    mood: 'Tốt',
    note: 'Ngủ đủ giấc, buổi chiều tập trung tốt hơn.',
    score: 4,
  },
  {
    date: '24/08',
    emoji: '😟',
    mood: 'Không tốt',
    note: 'Áp lực từ deadline và hơi khó ngủ.',
    score: 2,
  },
]

export default function EmotionProgressModal({ isOpen, onClose }: Props) {
  const [period, setPeriod] = useState<PeriodKey>('7d')
  const data = PERIODS[period]
  const chart = useMemo(() => {
    const left = 42
    const top = 24
    const plotWidth = 594
    const plotHeight = 152
    const points = data.values.map((value, index) => ({
      value,
      label: data.labels[index],
      x:
        left +
        (data.values.length === 1
          ? plotWidth / 2
          : (index * plotWidth) / (data.values.length - 1)),
      y: top + ((5 - value) / 4) * plotHeight,
    }))
    return {
      points,
      line: points.map((point) => `${point.x},${point.y}`).join(' '),
      area: `${left},${top + plotHeight} ${points.map((point) => `${point.x},${point.y}`).join(' ')} ${left + plotWidth},${top + plotHeight}`,
    }
  }, [data])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <motion.button
        className="emotion-progress-backdrop"
        aria-label="Đóng chi tiết tiến trình cảm xúc"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <div className="emotion-progress-shell">
        <motion.section
          className="emotion-progress-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="emotion-progress-title"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <header className="emotion-progress-header">
            <div>
              <span>Track emotion progress</span>
              <h2 id="emotion-progress-title">Chi tiết tiến trình cảm xúc</h2>
              <p>
                Tổng hợp từ những cảm xúc bạn chủ động ghi lại trong nhật ký.
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Đóng">
              ×
            </button>
          </header>

          <div className="emotion-progress-scroll">
            <nav
              className="emotion-progress-periods"
              aria-label="Chọn khoảng thời gian"
            >
              <div>
                {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
                  <button
                    key={key}
                    className={period === key ? 'active' : ''}
                    onClick={() => setPeriod(key)}
                  >
                    {PERIODS[key].label}
                  </button>
                ))}
              </div>
              <span>{data.range}</span>
            </nav>

            <section
              className="emotion-progress-summary"
              aria-label="Tổng quan cảm xúc"
            >
              <article className="primary">
                <span>Điểm trung bình</span>
                <div>
                  <strong>{data.average}</strong>
                  <small>/5</small>
                </div>
                <p>Trong {data.label.toLowerCase()}</p>
              </article>
              <article>
                <span>So với kỳ trước</span>
                <strong>{data.change}</strong>
                <p>Xu hướng tích cực hơn</p>
              </article>
              <article>
                <span>Số lần ghi nhận</span>
                <strong>{data.entries}</strong>
                <p>
                  {period === '7d' ? 'Đủ 7 ngày liên tiếp' : 'Bản ghi cảm xúc'}
                </p>
              </article>
              <article>
                <span>Cảm xúc nổi bật</span>
                <strong className="mood">😊 Tốt</strong>
                <p>Chiếm 38% bản ghi</p>
              </article>
            </section>

            <section className="emotion-progress-chart-card">
              <header>
                <div>
                  <span>Xu hướng theo thời gian</span>
                  <h3>Nhịp cảm xúc của bạn</h3>
                </div>
                <div className="emotion-progress-scale">
                  <span>1 · Khó khăn</span>
                  <span>5 · Tuyệt vời</span>
                </div>
              </header>
              <div className="emotion-progress-chart-wrap">
                <svg
                  key={period}
                  className="emotion-progress-chart"
                  viewBox="0 0 660 225"
                  role="img"
                  aria-label={`Biểu đồ cảm xúc trong ${data.label}`}
                >
                  {[1, 2, 3, 4, 5].map((score) => {
                    const y = 24 + ((5 - score) / 4) * 152
                    return (
                      <g key={score}>
                        <line x1="42" x2="636" y1={y} y2={y} />
                        <text x="17" y={y + 4}>
                          {score}
                        </text>
                      </g>
                    )
                  })}
                  <polyline
                    className="emotion-progress-area"
                    points={chart.area}
                  />
                  <polyline
                    className="emotion-progress-line"
                    points={chart.line}
                  />
                  {chart.points.map((point, index) => (
                    <g
                      className="emotion-progress-point"
                      key={`${point.label}-${index}`}
                    >
                      <circle cx={point.x} cy={point.y} r="6" />
                      <text className="score" x={point.x} y={point.y - 13}>
                        {point.value}
                      </text>
                      <text className="date" x={point.x} y="207">
                        {point.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </section>

            <div className="emotion-progress-grid">
              <section className="emotion-distribution">
                <header>
                  <span>Phân bố cảm xúc</span>
                  <h3>Bạn thường cảm thấy thế nào?</h3>
                </header>
                <div>
                  {MOODS.map((mood) => (
                    <article key={mood.score}>
                      <i>{mood.emoji}</i>
                      <span>{mood.label}</span>
                      <div>
                        <b
                          className={mood.tone}
                          style={{ width: `${mood.percent}%` }}
                        />
                      </div>
                      <strong>{mood.percent}%</strong>
                    </article>
                  ))}
                </div>
              </section>

              <section className="emotion-factors">
                <header>
                  <span>Yếu tố liên quan</span>
                  <h3>Điều gì thường đi cùng cảm xúc?</h3>
                </header>
                <div>
                  {FACTORS.map((factor) => (
                    <article key={factor.label} className={factor.tone}>
                      <i>{factor.icon}</i>
                      <p>
                        <strong>
                          {factor.label}
                          <small>{factor.count}</small>
                        </strong>
                        <span>{factor.impact}</span>
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <section className="emotion-recent">
              <header>
                <div>
                  <span>Ghi nhận gần đây</span>
                  <h3>Bối cảnh phía sau điểm số</h3>
                </div>
                <Link href="/journal">
                  Mở nhật ký <b>→</b>
                </Link>
              </header>
              <div>
                {RECENT.map((entry) => (
                  <article key={entry.date}>
                    <time>{entry.date}</time>
                    <i>{entry.emoji}</i>
                    <p>
                      <strong>{entry.mood}</strong>
                      <span>{entry.note}</span>
                    </p>
                    <b>{entry.score}/5</b>
                  </article>
                ))}
              </div>
            </section>

            <aside className="emotion-progress-note">
              <i>i</i>
              <p>
                <strong>
                  Dữ liệu giúp bạn nhận ra khuynh hướng, không định nghĩa cảm
                  xúc của bạn
                </strong>
                <span>
                  Nếu cảm xúc khó khăn kéo dài hoặc ảnh hưởng đến sinh hoạt, hãy
                  cân nhắc trao đổi với một chuyên gia.
                </span>
              </p>
            </aside>
          </div>

          <footer className="emotion-progress-footer">
            <button type="button" onClick={onClose}>
              Đóng
            </button>
            <Link href="/journal">
              Ghi lại cảm xúc hôm nay <span>→</span>
            </Link>
          </footer>
        </motion.section>
      </div>
    </>
  )
}
