'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import './ActivitySummaryModal.css'

type Props = {
  isOpen: boolean
  onClose: () => void
}

type Period = '7' | '30' | '90'
type SummaryTab = 'overview' | 'breakdown' | 'history'

const TABS: { id: SummaryTab; label: string; helper: string }[] = [
  { id: 'overview', label: 'Tổng quan', helper: 'Chỉ số chính' },
  { id: 'breakdown', label: 'Phân bổ hoạt động', helper: 'Theo từng nhóm' },
  { id: 'history', label: 'Lịch sử gần đây', helper: 'Các mốc đã hoàn thành' },
]

const PERIODS: Record<Period, {
  label: string
  range: string
  completed: number
  planned: number
  activeDays: number
  change: string
  journal: number
  assessment: number
  selfCare: number
  consultation: number
  goal: number
}> = {
  '7': { label: '7 ngày', range: '20–26 tháng 8, 2026', completed: 15, planned: 18, activeDays: 6, change: '+18%', journal: 7, assessment: 1, selfCare: 5, consultation: 2, goal: 83 },
  '30': { label: '30 ngày', range: '28 tháng 7–26 tháng 8, 2026', completed: 49, planned: 60, activeDays: 24, change: '+12%', journal: 24, assessment: 3, selfCare: 17, consultation: 5, goal: 82 },
  '90': { label: '3 tháng', range: '29 tháng 5–26 tháng 8, 2026', completed: 132, planned: 168, activeDays: 68, change: '+9%', journal: 68, assessment: 8, selfCare: 43, consultation: 13, goal: 79 },
}

const RECENT = [
  { date: '26/08', icon: '✎', title: 'Ghi nhật ký cảm xúc', detail: 'Tâm trạng: Tốt · 4/5', tone: 'teal' },
  { date: '25/08', icon: '◷', title: 'Hoàn thành bài thở 4–7–8', detail: '8 phút · Thư giãn', tone: 'amber' },
  { date: '24/08', icon: '✓', title: 'Đánh giá PHQ-9', detail: '8/27 · Mức nhẹ', tone: 'lavender' },
  { date: '22/08', icon: '♡', title: 'Phiên tư vấn trực tuyến', detail: 'TS. Nguyễn Thị Lan · 60 phút', tone: 'terra' },
]

export default function ActivitySummaryModal({ isOpen, onClose }: Props) {
  const [period, setPeriod] = useState<Period>('7')
  const [activeTab, setActiveTab] = useState<SummaryTab>('overview')
  const summary = PERIODS[period]
  const activities = [
    { label: 'Nhật ký', value: summary.journal, icon: '✎', tone: 'teal' },
    { label: 'Đánh giá', value: summary.assessment, icon: '✓', tone: 'lavender' },
    { label: 'Tự chăm sóc', value: summary.selfCare, icon: '◷', tone: 'amber' },
    { label: 'Tư vấn', value: summary.consultation, icon: '♡', tone: 'terra' },
  ]
  const maxActivity = Math.max(...activities.map(item => item.value), 1)

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
    <motion.button className="activity-summary-backdrop" aria-label="Đóng tổng kết hoạt động" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
    <div className="activity-summary-shell">
      <motion.section className="activity-summary-modal" role="dialog" aria-modal="true" aria-labelledby="activity-summary-title" initial={{ opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .3, ease: [0.16, 1, 0.3, 1] }}>
        <header className="activity-summary-header">
          <div><span>View activity summary</span><h2 id="activity-summary-title">Tổng kết hoạt động</h2><p>Một góc nhìn rõ ràng về những việc bạn đã làm để chăm sóc sức khỏe tinh thần.</p></div>
          <button type="button" onClick={onClose} aria-label="Đóng">×</button>
        </header>

        <div className="activity-summary-scroll">
          <div className="activity-summary-periods">
            <div role="group" aria-label="Chọn khoảng thời gian">
              {(Object.keys(PERIODS) as Period[]).map(key => <button type="button" key={key} className={period === key ? 'active' : ''} onClick={() => setPeriod(key)}>{PERIODS[key].label}</button>)}
            </div>
            <span>{summary.range}</span>
          </div>

          <nav className="activity-summary-tabs" role="tablist" aria-label="Nội dung tổng kết hoạt động">
            {TABS.map(tab => <button type="button" role="tab" id={`activity-summary-tab-${tab.id}`} aria-controls={`activity-summary-panel-${tab.id}`} aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)}><strong>{tab.label}</strong><span>{tab.helper}</span></button>)}
          </nav>

          <motion.div key={`${activeTab}-${period}`} className="activity-summary-tab-panel" id={`activity-summary-panel-${activeTab}`} role="tabpanel" aria-labelledby={`activity-summary-tab-${activeTab}`} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }}>
            {activeTab === 'overview' && <div className="activity-summary-overview-tab">
              <section className="activity-summary-overview" aria-label="Số liệu tổng quan">
                <article className="activity-summary-primary"><span>Hoạt động hoàn thành</span><div><strong>{summary.completed}</strong><small>/ {summary.planned} dự kiến</small></div><p>Hoàn thành {summary.goal}% kế hoạch</p></article>
                <article><span>Ngày có hoạt động</span><strong>{summary.activeDays}</strong><p>trong {summary.label.toLowerCase()}</p></article>
                <article><span>So với kỳ trước</span><strong className="positive">{summary.change}</strong><p>Mức độ duy trì tăng</p></article>
                <article><span>Chuỗi nhật ký</span><strong>12 ngày</strong><p>Dài nhất: 18 ngày</p></article>
              </section>
              <div className="activity-overview-focus">
                <aside className="activity-goal-card">
                  <span>Mục tiêu tuần</span>
                  <div className="activity-goal-ring" style={{ '--progress': `${summary.goal * 3.6}deg` } as React.CSSProperties}><div><strong>{summary.goal}%</strong><small>hoàn thành</small></div></div>
                  <div><h3>Bạn đang duy trì tốt</h3><p>Còn <strong>{Math.max(summary.planned - summary.completed, 0)} hoạt động</strong> để hoàn tất kế hoạch trong kỳ này.</p></div>
                </aside>
                <section className="activity-summary-highlights"><span>Điểm đáng chú ý</span><h3>Nhịp chăm sóc đang ổn định hơn</h3><ul><li><i>✓</i><p><strong>Duy trì đều</strong><span>Bạn có hoạt động trong {summary.activeDays} ngày của kỳ đã chọn.</span></p></li><li><i>↗</i><p><strong>Tăng {summary.change}</strong><span>Mức độ tham gia cao hơn so với kỳ trước.</span></p></li><li><i>✎</i><p><strong>Nhật ký là thói quen chính</strong><span>{summary.journal} lần ghi nhận giúp dữ liệu tiến trình rõ ràng hơn.</span></p></li></ul></section>
              </div>
            </div>}

            {activeTab === 'breakdown' && <section className="activity-breakdown activity-breakdown-full">
              <header><span>Phân bổ hoạt động</span><h3>Bạn đã dành thời gian cho điều gì?</h3></header>
              <div className="activity-breakdown-list">{activities.map(item => <article key={item.label}><i className={item.tone}>{item.icon}</i><div><span><strong>{item.label}</strong><b>{item.value} lần</b></span><div><em className={item.tone} style={{ width: `${Math.max(item.value / maxActivity * 100, 8)}%` }} /></div></div></article>)}</div>
              <footer><p><strong>{summary.completed} hoạt động</strong> đã hoàn thành trong {summary.label.toLowerCase()}.</p><Link href="/resources">Tìm hoạt động tiếp theo <b>→</b></Link></footer>
            </section>}

            {activeTab === 'history' && <section className="activity-recent activity-recent-tab">
              <header><div><span>Hoạt động gần đây</span><h3>Những mốc bạn vừa hoàn thành</h3></div><Link href="/journal">Mở nhật ký <b>→</b></Link></header>
              <div>{RECENT.map(item => <article key={`${item.date}-${item.title}`}><time>{item.date}</time><i className={item.tone}>{item.icon}</i><p><strong>{item.title}</strong><span>{item.detail}</span></p><b>Hoàn thành</b></article>)}</div>
            </section>}
          </motion.div>

          <aside className="activity-summary-note"><i>i</i><p><strong>Tiến trình được tạo nên từ những bước nhỏ và đều đặn</strong><span>Số liệu này giúp bạn nhìn lại thói quen chăm sóc bản thân, không dùng để đánh giá hay chẩn đoán sức khỏe tâm thần.</span></p></aside>
        </div>

        <footer className="activity-summary-footer"><button type="button" onClick={onClose}>Đóng</button><Link href="/resources">Khám phá hoạt động phù hợp <span>→</span></Link></footer>
      </motion.section>
    </div>
  </>
}
