'use client'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import './AssessmentResultModal.css'

interface Question {
  question: string
  answer: number
  answerText: string
}

interface AssessmentResult {
  id: number
  date: string
  day: string
  assessment: string
  assessmentFull: string
  score: number
  maxScore: number
  level: string
  tone: 'positive' | 'neutral' | 'warning'
  description: string
  recommendations: string[]
  questions: Question[]
  previousScore?: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  result: AssessmentResult | null
}

// Mock data generator - trong thực tế sẽ lấy từ API
const generateQuestions = (type: string): Question[] => {
  if (type === 'PHQ-9') {
    return [
      { question: 'Ít hứng thú hoặc vui thích khi làm việc', answer: 1, answerText: 'Vài ngày' },
      { question: 'Cảm thấy buồn, chán nản hoặc tuyệt vọng', answer: 1, answerText: 'Vài ngày' },
      { question: 'Khó ngủ, ngủ không sâu giấc hoặc ngủ quá nhiều', answer: 2, answerText: 'Hơn một nửa số ngày' },
      { question: 'Cảm thấy mệt mỏi hoặc không có năng lượng', answer: 1, answerText: 'Vài ngày' },
      { question: 'Ăn kém hoặc ăn quá nhiều', answer: 0, answerText: 'Không ngày nào' },
      { question: 'Cảm thấy tệ về bản thân', answer: 1, answerText: 'Vài ngày' },
      { question: 'Khó tập trung vào công việc', answer: 2, answerText: 'Hơn một nửa số ngày' },
      { question: 'Di chuyển hoặc nói chuyện chậm', answer: 0, answerText: 'Không ngày nào' },
      { question: 'Có ý nghĩ tự làm hại bản thân', answer: 0, answerText: 'Không ngày nào' }
    ]
  }
  return []
}

const getLevelColor = (tone: string) => {
  switch (tone) {
    case 'positive': return '#2d7a4d'
    case 'warning': return '#8a5a1f'
    default: return '#1E4A43'
  }
}

const getLevelBg = (tone: string) => {
  switch (tone) {
    case 'positive': return 'rgba(100, 180, 130, 0.15)'
    case 'warning': return 'var(--amber-soft)'
    default: return 'var(--teal-pale)'
  }
}

export default function AssessmentResultModal({ isOpen, onClose, result }: Props) {
  const modalRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !result) return

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

      // Animate sections
      gsap.fromTo('.result-section',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.1, ease: 'power2.out', delay: 0.2 }
      )
    })

    document.body.style.overflow = 'hidden'

    return () => {
      ctx.revert()
      document.body.style.overflow = ''
    }
  }, [isOpen, result])

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

  if (!isOpen || !result) return null

  const questions = generateQuestions(result.assessment)

  return (
    <div ref={modalRef} className="result-modal-container" onClick={handleClose}>
      <div ref={overlayRef} className="result-modal-overlay" />
      <div 
        ref={contentRef} 
        className="result-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="result-modal-header">
          <div className="result-header-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          </div>
          <div className="result-header-text">
            <h2>Kết quả đánh giá</h2>
            <p>{result.date} • {result.day}</p>
          </div>
          <button 
            className="result-modal-close"
            onClick={handleClose}
            aria-label="Đóng"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="result-modal-body">
          {/* Score Section */}
          <section className="result-section result-score-section">
            <div className="result-score-card">
              <div className="result-test-name">
                <h3>{result.assessment}</h3>
                <p>{result.assessmentFull}</p>
              </div>
              <div className="result-score-display">
                <div className="result-score-main">
                  <span className="result-score-number">{result.score}</span>
                  <span className="result-score-max">/ {result.maxScore}</span>
                </div>
                <div 
                  className="result-level-badge"
                  style={{ 
                    background: getLevelBg(result.tone),
                    color: getLevelColor(result.tone)
                  }}
                >
                  {result.level}
                </div>
              </div>
            </div>

            {result.previousScore !== undefined && (
              <div className="result-comparison">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h3l2-5 3 10 2-7 2 4h6"/>
                </svg>
                <span>
                  {result.score < result.previousScore ? (
                    <>↓ Giảm {result.previousScore - result.score} điểm so với lần trước</>
                  ) : result.score > result.previousScore ? (
                    <>↑ Tăng {result.score - result.previousScore} điểm so với lần trước</>
                  ) : (
                    <>→ Không thay đổi so với lần trước</>
                  )}
                </span>
              </div>
            )}
          </section>

          {/* Description */}
          <section className="result-section result-description">
            <h4>Giải thích kết quả</h4>
            <p>{result.description}</p>
          </section>

          {/* Recommendations */}
          <section className="result-section result-recommendations">
            <h4>Khuyến nghị</h4>
            <ul>
              {result.recommendations.map((rec, i) => (
                <li key={i}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Questions & Answers */}
          {questions.length > 0 && (
            <section className="result-section result-questions">
              <h4>Chi tiết câu trả lời</h4>
              <div className="result-questions-list">
                {questions.map((q, i) => (
                  <div key={i} className="result-question-item">
                    <div className="result-question-number">{i + 1}</div>
                    <div className="result-question-content">
                      <p className="result-question-text">{q.question}</p>
                      <div className="result-question-answer">
                        <span className="result-answer-score">{q.answer} điểm</span>
                        <span className="result-answer-text">{q.answerText}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Actions */}
          <section className="result-section result-actions">
            <button className="result-btn result-btn-secondary" onClick={handleClose}>
              Đóng
            </button>
            <button className="result-btn result-btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Tải xuống PDF
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
