'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import './AssessmentProgressModal.css'

type Props = {
  isOpen: boolean
  onClose: () => void
}

type ProgressRecord = {
  date: string
  shortDate: string
  score: number
  level: string
}

type ProgressData = {
  id: string
  name: string
  fullName: string
  maxScore: number
  color: string
  nextReview: string
  records: ProgressRecord[]
}

const PROGRESS_DATA: ProgressData[] = [
  {
    id: 'phq9',
    name: 'PHQ-9',
    fullName: 'Theo dõi triệu chứng trầm cảm',
    maxScore: 27,
    color: '#2f665d',
    nextReview: '24 tháng 8, 2026',
    records: [
      { date: '10 tháng 5, 2026', shortDate: '10/05', score: 15, level: 'Mức cao' },
      { date: '10 tháng 6, 2026', shortDate: '10/06', score: 13, level: 'Trung bình' },
      { date: '10 tháng 7, 2026', shortDate: '10/07', score: 12, level: 'Trung bình' },
      { date: '10 tháng 8, 2026', shortDate: '10/08', score: 8, level: 'Nhẹ' },
    ],
  },
  {
    id: 'gad7',
    name: 'GAD-7',
    fullName: 'Theo dõi triệu chứng lo âu',
    maxScore: 21,
    color: '#8175c2',
    nextReview: '08 tháng 9, 2026',
    records: [
      { date: '25 tháng 5, 2026', shortDate: '25/05', score: 11, level: 'Trung bình' },
      { date: '25 tháng 6, 2026', shortDate: '25/06', score: 9, level: 'Nhẹ' },
      { date: '25 tháng 7, 2026', shortDate: '25/07', score: 5, level: 'Tối thiểu' },
    ],
  },
  {
    id: 'psqi',
    name: 'PSQI',
    fullName: 'Theo dõi chất lượng giấc ngủ',
    maxScore: 21,
    color: '#4f7f6e',
    nextReview: '02 tháng 9, 2026',
    records: [
      { date: '02 tháng 6, 2026', shortDate: '02/06', score: 12, level: 'Cần chú ý' },
      { date: '02 tháng 7, 2026', shortDate: '02/07', score: 10, level: 'Cần theo dõi' },
      { date: '02 tháng 8, 2026', shortDate: '02/08', score: 7, level: 'Đang cải thiện' },
    ],
  },
]

export default function AssessmentProgressModal({ isOpen, onClose }: Props) {
  const [activeId, setActiveId] = useState('phq9')
  const active = PROGRESS_DATA.find(item => item.id === activeId) ?? PROGRESS_DATA[0]
  const latest = active.records.at(-1) ?? active.records[0]
  const previous = active.records.at(-2) ?? latest
  const first = active.records[0]
  const change = latest.score - previous.score
  const totalChange = latest.score - first.score
  const chart = useMemo(() => {
    const left = 44
    const right = 18
    const top = 26
    const bottom = 40
    const width = 560
    const height = 210
    const plotWidth = width - left - right
    const plotHeight = height - top - bottom
    const coordinates = active.records.map((record, index) => ({
      ...record,
      x: left + (active.records.length === 1 ? plotWidth / 2 : index * plotWidth / (active.records.length - 1)),
      y: top + (active.maxScore - record.score) / active.maxScore * plotHeight,
    }))
    return { coordinates, points: coordinates.map(point => `${point.x},${point.y}`).join(' ') }
  }, [active])

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

  return <>
    <motion.button className="assessment-progress-backdrop" aria-label="Đóng tiến trình đánh giá" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
    <div className="assessment-progress-shell">
      <motion.section className="assessment-progress-modal" role="dialog" aria-modal="true" aria-labelledby="assessment-progress-title" initial={{ opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .3, ease: [0.16, 1, 0.3, 1] }}>
        <header className="assessment-progress-header">
          <div><span>Track assessment progress</span><h2 id="assessment-progress-title">Tiến trình đánh giá</h2><p>Quan sát sự thay đổi qua các lần kiểm tra định kỳ.</p></div>
          <button type="button" onClick={onClose} aria-label="Đóng">×</button>
        </header>

        <div className="assessment-progress-scroll">
          <nav className="assessment-progress-tabs" aria-label="Chọn loại bài đánh giá">
            {PROGRESS_DATA.map(item => <button key={item.id} className={activeId === item.id ? 'active' : ''} onClick={() => setActiveId(item.id)}><strong>{item.name}</strong><span>{item.fullName}</span></button>)}
          </nav>

          <section className="assessment-progress-overview">
            <article className="assessment-progress-primary">
              <span>Điểm gần nhất</span>
              <div><strong>{latest.score}</strong><small>/ {active.maxScore}</small></div>
              <p>{latest.level} · {latest.date}</p>
            </article>
            <article><span>So với lần trước</span><strong className={change <= 0 ? 'improved' : 'attention'}>{change > 0 ? '+' : ''}{change} điểm</strong><p>{change < 0 ? 'Điểm số đã giảm' : change > 0 ? 'Điểm số cần theo dõi' : 'Không thay đổi'}</p></article>
            <article><span>Từ lần đầu</span><strong className={totalChange <= 0 ? 'improved' : 'attention'}>{totalChange > 0 ? '+' : ''}{totalChange} điểm</strong><p>{active.records.length} lần ghi nhận</p></article>
            <article><span>Đánh giá tiếp theo</span><strong className="assessment-progress-date">{active.nextReview}</strong><p>Chu kỳ được đề xuất</p></article>
          </section>

          <div className="assessment-progress-main">
            <section className="assessment-progress-chart-card">
              <header><div><span>Xu hướng điểm số</span><h3>{active.name} theo thời gian</h3></div><p>Điểm thấp hơn thể hiện ít dấu hiệu cần theo dõi hơn.</p></header>
              <div className="assessment-progress-chart-wrap">
                <svg key={active.id} className="assessment-progress-chart" viewBox="0 0 560 210" role="img" aria-label={`Biểu đồ tiến trình ${active.name}`}>
                  {[0, .25, .5, .75, 1].map(ratio => {
                    const y = 26 + ratio * 144
                    const score = Math.round(active.maxScore * (1 - ratio))
                    return <g key={ratio}><line x1="44" x2="542" y1={y} y2={y} /><text x="8" y={y + 4}>{score}</text></g>
                  })}
                  <polyline className="assessment-progress-area" points={`44,170 ${chart.points} 542,170`} />
                  <polyline className="assessment-progress-line" points={chart.points} style={{ stroke: active.color }} />
                  {chart.coordinates.map(point => <g className="assessment-progress-point" key={point.shortDate} style={{ color: active.color }}><circle cx={point.x} cy={point.y} r="6" /><text className="score" x={point.x} y={point.y - 13}>{point.score}</text><text className="date" x={point.x} y="197">{point.shortDate}</text></g>)}
                </svg>
              </div>
            </section>

            <aside className="assessment-progress-timeline">
              <header><span>Lịch sử</span><h3>Các mốc gần đây</h3></header>
              <div>{[...active.records].reverse().map((record, index) => <article key={record.date} className={index === 0 ? 'latest' : ''}><i>{index === 0 ? '✓' : ''}</i><div><strong>{record.date}</strong><span>{record.level}</span></div><b>{record.score}<small>/{active.maxScore}</small></b></article>)}</div>
            </aside>
          </div>

          <aside className="assessment-progress-disclaimer"><i>i</i><div><strong>Điểm số hỗ trợ theo dõi, không phải chẩn đoán</strong><p>Hãy trao đổi với chuyên gia nếu kết quả tăng lên, kéo dài hoặc khiến bạn lo lắng.</p></div></aside>
        </div>

        <footer className="assessment-progress-footer"><button type="button" onClick={onClose}>Đóng</button><Link href={`/assessment/${active.id}`}>Làm lại {active.name} <span>→</span></Link></footer>
      </motion.section>
    </div>
  </>
}
