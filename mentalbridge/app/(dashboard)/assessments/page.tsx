'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import type {
  AssessmentSummary,
  ScreeningLevel,
} from '@/features/assessment/api/care-contract'
import { getAssessmentHistory } from '@/features/assessment/api/browser-care'
import AssessmentProgressPanel from '@/features/assessment/components/AssessmentProgressPanel'

import './assessments.css'

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}
const assessments = [
  {
    id: 'phq9',
    name: 'PHQ-9',
    fullName: 'Patient Health Questionnaire-9',
    description:
      'Bộ câu hỏi được tải từ phiên bản đã công bố của Care service.',
    duration: '3–5 phút',
    questions: 9,
    available: true,
  },
  {
    id: 'gad7',
    name: 'GAD-7',
    fullName: 'Generalized Anxiety Disorder-7',
    description: 'Runtime và nội dung đã duyệt hiện chưa khả dụng.',
    duration: 'Chưa khả dụng',
    questions: 7,
    available: false,
  },
  {
    id: 'psqi',
    name: 'PSQI',
    fullName: 'Pittsburgh Sleep Quality Index',
    description: 'Contract và nội dung đã duyệt hiện chưa khả dụng.',
    duration: 'Chưa khả dụng',
    questions: 19,
    available: false,
  },
]

function AssessmentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12c2.2-7 4.4 7 6.6 0s4.4-7 6.6 0 4.4 7 4.8 0" />
    </svg>
  )
}

export default function AssessmentsPage() {
  const [items, setItems] = useState<AssessmentSummary[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [progressAssessmentId, setProgressAssessmentId] = useState<string>()
  const progressTriggerRef = useRef<HTMLButtonElement | null>(null)
  const load = async (next?: string) => {
    setLoading(true)
    setError(false)
    try {
      const page = await getAssessmentHistory(next)
      setItems((current) => (next ? [...current, ...page.items] : page.items))
      setCursor(page.nextCursor ?? undefined)
      setHasMore(page.hasMore)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <div className="assessment-page">
      <header className="assessment-page-header">
        <div className="assessment-page-title">
          <span className="assessment-kicker">Theo dõi sức khỏe tinh thần</span>
          <h1>Bài đánh giá</h1>
          <p>
            Câu hỏi, lịch sử và kết quả được lấy trực tiếp qua Care service.
            Trình duyệt không tự tính điểm hoặc suy diễn mức độ.
          </p>
        </div>
      </header>
      <section aria-labelledby="available-assessments">
        <h2 id="available-assessments" className="sr-only">
          Bài đánh giá khả dụng
        </h2>
        <div className="assessment-card-grid">
          {assessments.map((assessment, index) => (
            <article
              className={`assessment-card ${assessment.available ? '' : 'assessment-card-unavailable'}`}
              key={assessment.id}
              style={{ '--delay': `${index * 70}ms` } as React.CSSProperties}
            >
              <div className="assessment-card-top">
                <span className="assessment-icon pulse">
                  <AssessmentIcon />
                </span>
                <span className="assessment-question-count">
                  {assessment.questions} câu hỏi
                </span>
                <h3>{assessment.name}</h3>
              </div>
              <strong>{assessment.fullName}</strong>
              <p>{assessment.description}</p>
              <div className="assessment-card-footer">
                <div className="assessment-duration">{assessment.duration}</div>
                {assessment.available ? (
                  <Link href="/assessment/phq9" className="assessment-start">
                    Bắt đầu <span aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <span className="assessment-unavailable-label">
                    Chưa khả dụng
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section
        className="assessment-history"
        aria-labelledby="assessment-history-title"
      >
        <div className="assessment-section-title">
          <div>
            <span>Lịch sử</span>
            <h2 id="assessment-history-title">Các lần đánh giá gần đây</h2>
          </div>
          <p>Chỉ hiển thị các assessment thuộc tài khoản hiện tại.</p>
        </div>
        {error ? (
          <div className="assessment-history-unavailable" role="alert">
            <strong>Không thể tải lịch sử</strong>
            <p>
              Care chưa xác nhận dữ liệu. Không có bản ghi mẫu được hiển thị
              thay thế.
            </p>
            <button className="assessment-start" onClick={() => void load()}>
              Thử lại
            </button>
          </div>
        ) : items.length === 0 && !loading ? (
          <div className="assessment-history-unavailable">
            <strong>Chưa có lịch sử đánh giá</strong>
            <p>
              Mỗi lần làm lại sẽ tạo một assessment mới, không ghi đè kết quả
              cũ.
            </p>
          </div>
        ) : (
          <div className="assessment-table-wrap">
            <table className="assessment-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Bộ câu hỏi</th>
                  <th>Kết quả sàng lọc</th>
                  <th>Điểm</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.assessmentId}>
                    <td>
                      {new Date(item.submittedAt).toLocaleString('vi-VN')}
                    </td>
                    <td>
                      {item.instrument} · {item.questionnaireVersion}
                    </td>
                    <td>{levelLabels[item.result.screeningLevel]}</td>
                    <td>{item.result.totalScore}/27</td>
                    <td>
                      <div className="assessment-row-actions">
                        <Link
                          className="assessment-row-action"
                          href={`/assessment/phq9?assessmentId=${encodeURIComponent(item.assessmentId)}`}
                        >
                          Xem lại
                        </Link>
                        <button
                          type="button"
                          className="assessment-row-action"
                          aria-expanded={
                            progressAssessmentId === item.assessmentId
                          }
                          aria-controls="assessment-progress-panel"
                          onClick={(event) => {
                            progressTriggerRef.current = event.currentTarget
                            setProgressAssessmentId(item.assessmentId)
                          }}
                        >
                          So sánh
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {progressAssessmentId && (
          <AssessmentProgressPanel
            key={progressAssessmentId}
            assessmentId={progressAssessmentId}
            onClose={() => {
              progressTriggerRef.current?.focus()
              setProgressAssessmentId(undefined)
            }}
          />
        )}
        {loading && (
          <p className="assessment-history-loading" aria-live="polite">
            Đang tải lịch sử từ Care…
          </p>
        )}
        {hasMore && !loading && (
          <button
            className="assessment-progress-trigger"
            onClick={() => void load(cursor)}
          >
            Tải thêm
          </button>
        )}
      </section>
      <aside className="assessment-note">
        <span>i</span>
        <div>
          <strong>Một lời nhắc nhẹ nhàng</strong>
          <p>
            Kết quả chỉ mang tính hỗ trợ sàng lọc và không thay thế chẩn đoán
            hoặc tư vấn từ chuyên gia sức khỏe tâm thần.
          </p>
        </div>
      </aside>
    </div>
  )
}
