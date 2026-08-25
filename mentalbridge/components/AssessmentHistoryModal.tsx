'use client'
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import './AssessmentHistoryModal.css'

interface HistoryItem {
  id: number
  date: string
  day: string
  assessment: string
  score: number
  maxScore: number
  level: string
  tone: 'positive' | 'neutral' | 'warning'
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onViewResult?: (item: HistoryItem) => void
}

const fullHistory: HistoryItem[] = [
  { id: 1, date: '10 tháng 8, 2026', day: 'Thứ Hai', assessment: 'PHQ-9', score: 8, maxScore: 27, level: 'Nhẹ', tone: 'neutral' },
  { id: 2, date: '25 tháng 7, 2026', day: 'Thứ Bảy', assessment: 'GAD-7', score: 5, maxScore: 21, level: 'Tối thiểu', tone: 'positive' },
  { id: 3, date: '10 tháng 7, 2026', day: 'Thứ Sáu', assessment: 'PHQ-9', score: 12, maxScore: 27, level: 'Trung bình', tone: 'neutral' },
  { id: 4, date: '28 tháng 6, 2026', day: 'Chủ nhật', assessment: 'PSQI', score: 7, maxScore: 21, level: 'Tốt', tone: 'positive' },
  { id: 5, date: '15 tháng 6, 2026', day: 'Thứ Hai', assessment: 'PHQ-9', score: 14, maxScore: 27, level: 'Trung bình', tone: 'warning' },
  { id: 6, date: '1 tháng 6, 2026', day: 'Thứ Bảy', assessment: 'GAD-7', score: 8, maxScore: 21, level: 'Nhẹ', tone: 'neutral' },
  { id: 7, date: '15 tháng 5, 2026', day: 'Thứ Tư', assessment: 'PHQ-9', score: 6, maxScore: 27, level: 'Tối thiểu', tone: 'positive' },
  { id: 8, date: '1 tháng 5, 2026', day: 'Thứ Tư', assessment: 'GAD-7', score: 4, maxScore: 21, level: 'Tối thiểu', tone: 'positive' },
]

export default function AssessmentHistoryModal({ isOpen, onClose, onViewResult }: Props) {
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const modalRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const ctx = gsap.context(() => {
      // Animate overlay
      gsap.fromTo(overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' }
      )

      // Animate modal content
      gsap.fromTo(contentRef.current,
        { opacity: 0, y: 40, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.4)' }
      )

      // Animate rows with stagger
      gsap.fromTo('.history-modal-row',
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', delay: 0.2 }
      )
    })

    // Prevent body scroll
    document.body.style.overflow = 'hidden'

    return () => {
      ctx.revert()
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleClose = () => {
    gsap.context(() => {
      gsap.to(contentRef.current, {
        opacity: 0,
        y: 20,
        scale: 0.95,
        duration: 0.25,
        ease: 'power2.in'
      })
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: onClose
      })
    })
  }

  if (!isOpen) return null

  // Filter history based on active filter
  const filteredHistory = activeFilter === 'all' 
    ? fullHistory 
    : fullHistory.filter(item => item.assessment.toLowerCase() === activeFilter.toLowerCase())

  return (
    <div ref={modalRef} className="history-modal-container" onClick={handleClose}>
      <div ref={overlayRef} className="history-modal-overlay" />
      <div 
        ref={contentRef} 
        className="history-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="history-modal-header">
          <div>
            <h2>Lịch sử đánh giá</h2>
            <p>Xem tất cả các bài đánh giá bạn đã hoàn thành</p>
          </div>
          <button 
            className="history-modal-close"
            onClick={handleClose}
            aria-label="Đóng"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="history-modal-filters">
          <button 
            className={`history-filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            Tất cả
          </button>
          <button 
            className={`history-filter-btn ${activeFilter === 'phq-9' ? 'active' : ''}`}
            onClick={() => setActiveFilter('phq-9')}
          >
            PHQ-9
          </button>
          <button 
            className={`history-filter-btn ${activeFilter === 'gad-7' ? 'active' : ''}`}
            onClick={() => setActiveFilter('gad-7')}
          >
            GAD-7
          </button>
          <button 
            className={`history-filter-btn ${activeFilter === 'psqi' ? 'active' : ''}`}
            onClick={() => setActiveFilter('psqi')}
          >
            PSQI
          </button>
        </div>

        {/* Stats Cards */}
        <div className="history-stats-grid">
          <div className="history-stat-card">
            <div className="history-stat-icon teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12c2.2-7 4.4 7 6.6 0s4.4-7 6.6 0 4.4 7 4.8 0"/>
              </svg>
            </div>
            <div>
              <strong>8</strong>
              <span>Tổng số bài test</span>
            </div>
          </div>
          <div className="history-stat-card">
            <div className="history-stat-icon amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M2 12h20"/>
              </svg>
            </div>
            <div>
              <strong>Tối thiểu</strong>
              <span>Mức độ gần nhất</span>
            </div>
          </div>
          <div className="history-stat-card">
            <div className="history-stat-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h3l2-5 3 10 2-7 2 4h6"/>
              </svg>
            </div>
            <div>
              <strong>Cải thiện</strong>
              <span>Xu hướng 30 ngày</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="history-modal-table-wrap">
          {filteredHistory.length > 0 ? (
            <table className="history-modal-table">
              <thead>
                <tr>
                  <th>Ngày làm</th>
                  <th>Bài test</th>
                  <th>Điểm số</th>
                  <th>Kết quả</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item, index) => (
                  <tr key={item.id} className="history-modal-row" style={{ '--index': index } as React.CSSProperties}>
                    <td>
                      <div className="history-date">
                        <strong>{item.date}</strong>
                        <small>{item.day}</small>
                      </div>
                    </td>
                    <td>
                      <span className="history-assessment-name">{item.assessment}</span>
                    </td>
                    <td>
                      <div className="history-score-cell">
                        <span className="history-score">{item.score}</span>
                        <small>/ {item.maxScore}</small>
                      </div>
                    </td>
                    <td>
                      <span className={`history-level ${item.tone}`}>{item.level}</span>
                    </td>
                    <td>
                      <button 
                        className="history-view-btn"
                        aria-label={`Xem chi tiết ${item.assessment}`}
                        onClick={() => {
                          if (onViewResult) {
                            onViewResult(item)
                            handleClose()
                          }
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="history-empty-state">
              <div className="history-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12h6M9 16h6M9 8h6"/>
                  <path d="M4 4h16v16H4z"/>
                </svg>
              </div>
              <h3>Không có kết quả</h3>
              <p>Không tìm thấy bài đánh giá nào phù hợp với bộ lọc đã chọn.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="history-modal-footer">
          <p>Hiển thị {filteredHistory.length} kết quả</p>
          <div className="history-pagination">
            <button disabled>Trước</button>
            <button className="active">1</button>
            <button>2</button>
            <button>Sau</button>
          </div>
        </div>
      </div>
    </div>
  )
}
