'use client'

import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { getCombinedScreeningMeaning } from '@/features/assessment/api/browser-care'
import type {
  CombinedScreeningMeaning,
  GuidedJourney,
} from '@/features/assessment/api/care-contract'

type NoticeState =
  | { evaluationId: string; phase: 'ready'; meaning: CombinedScreeningMeaning }
  | { evaluationId: string; phase: 'error' }

export function HomeScreeningNotice({
  journey,
}: Readonly<{ journey: GuidedJourney }>) {
  const headingId = useId()
  const [state, setState] = useState<NoticeState | null>(null)
  const [attempt, setAttempt] = useState(0)
  const evaluationId = journey.presentationEvaluationId
  const episodeId = journey.episodeId
  const completedAt = journey.episodeCompletedAt

  useEffect(() => {
    if (!evaluationId || !episodeId || !completedAt) return
    const controller = new AbortController()
    void getCombinedScreeningMeaning(evaluationId, controller.signal).then(
      (meaning) => {
        if (controller.signal.aborted) return
        if (
          meaning.supportEvaluationId !== evaluationId ||
          meaning.episodeId !== episodeId ||
          !meaning.episodeCompletedAt
        ) {
          setState({ evaluationId, phase: 'error' })
          return
        }
        setState({ evaluationId, phase: 'ready', meaning })
      },
      () => {
        if (!controller.signal.aborted)
          setState({ evaluationId, phase: 'error' })
      },
    )
    return () => controller.abort()
  }, [evaluationId, episodeId, completedAt, attempt])

  if (!evaluationId || !episodeId || !completedAt) return null
  if (!state || state.evaluationId !== evaluationId)
    return (
      <p className="home-screening-status" role="status">
        Đang tải mức độ từ lần kiểm tra đã hoàn thành…
      </p>
    )
  if (state.phase === 'error')
    return (
      <div className="home-screening-status" role="status">
        <p>Chưa tải được mức độ từ lần kiểm tra đã lưu.</p>
        <button
          type="button"
          className="home-quiet-link"
          onClick={() => {
            setState(null)
            setAttempt((value) => value + 1)
          }}
        >
          Thử lại
        </button>
        <Link
          className="home-quiet-link"
          href={`/assessments/results/${evaluationId}`}
        >
          Xem kết quả đã lưu
        </Link>
      </div>
    )

  const severe = state.meaning.evidence.filter(
    (item) =>
      item.screeningLevel === 'SEVERE' &&
      ((item.instrument === 'PHQ9' && item.totalScore >= 20) ||
        (item.instrument === 'GAD7' && item.totalScore >= 15)),
  )
  if (severe.length === 0) return null

  return (
    <section
      className="home-screening-notice"
      aria-labelledby={headingId}
      data-page-motion="off"
    >
      <AlertTriangle size={22} aria-hidden="true" />
      <div className="home-screening-notice-copy">
        <h2 id={headingId}>Nên tìm hỗ trợ chuyên môn</h2>
        <p>
          Lần kiểm tra hoàn thành ngày{' '}
          {new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'Asia/Ho_Chi_Minh',
          }).format(new Date(completedAt))}{' '}
          có kết quả ở mức nặng:
        </p>
        <ul>
          {severe.map((item) => (
            <li key={item.assessmentId}>
              {item.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'}:{' '}
              <strong>
                {item.totalScore}/{item.instrument === 'PHQ9' ? 27 : 21} điểm ·
                Mức nặng
              </strong>
            </li>
          ))}
        </ul>
        <p>
          Bạn nên trao đổi với chuyên gia để được đánh giá thêm. Điểm sàng lọc
          không phải chẩn đoán hay kết luận về nguy hiểm tức thời.
        </p>
      </div>
      <div className="home-screening-notice-actions">
        <Link className="home-primary" href="/specialists">
          Xem chuyên gia
        </Link>
        <Link
          className="home-quiet-link"
          href={`/assessments/results/${evaluationId}`}
        >
          Xem kết quả
        </Link>
      </div>
    </section>
  )
}
