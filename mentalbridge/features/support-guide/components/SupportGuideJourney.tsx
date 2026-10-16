'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import type { GuidedJourney } from '@/features/assessment/api/care-contract'
import { ApiError } from '@/lib/api/api-error'
import { MamAnLoadingState } from '@/features/assessment/components/MamAnLoadingState'
import {
  getGuidedJourney,
  getSupportGuide,
  getSupportGuideHistory,
} from '../api/browser-support-guide'
import type { SupportGuide } from '../api/support-guide-contract'
import GuidedJourneySteps from './GuidedJourneySteps'
import SupportGuideCard, {
  type SupportGuideScorePair,
} from './SupportGuideCard'
import { guideContinuation, isCurrentJourneyGuide } from './guided-continuation'
import { loadGuideScores } from './load-guide-scores'

import './support-guide.css'

function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 404)
      return 'Không tìm thấy hướng dẫn thuộc tài khoản này.'
  }
  return 'Chưa thể tải gợi ý hỗ trợ. Vui lòng thử lại.'
}

export default function SupportGuideJourney({
  supportGuideId,
  historical = false,
  resultEvaluationId,
}: {
  supportGuideId?: string
  historical?: boolean
  resultEvaluationId?: string
}) {
  const [items, setItems] = useState<SupportGuide[]>([])
  const [scores, setScores] = useState<
    Record<string, SupportGuideScorePair | null>
  >({})
  const [cursor, setCursor] = useState<string>()
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [journey, setJourney] = useState<GuidedJourney | null>(null)
  const [journeyFailed, setJourneyFailed] = useState(false)

  const loadJourney = useCallback(async () => {
    if (historical || !supportGuideId) return
    setJourneyFailed(false)
    try {
      setJourney(await getGuidedJourney())
    } catch {
      setJourney(null)
      setJourneyFailed(true)
    }
  }, [historical, supportGuideId])

  const load = useCallback(
    async (next?: string) => {
      setLoading(true)
      setError(undefined)
      try {
        if (supportGuideId) {
          const [guide] = await Promise.all([
            getSupportGuide(supportGuideId),
            loadJourney(),
          ])
          setItems([guide])
          setScores({ [guide.supportGuideId]: await loadGuideScores(guide) })
          setHasMore(false)
        } else {
          const history = await getSupportGuideHistory(next)
          setItems((current) =>
            next ? [...current, ...history.items] : history.items,
          )
          setCursor(history.nextCursor ?? undefined)
          setHasMore(history.hasMore)
          const pairs = await Promise.all(
            history.items.map(
              async (guide) =>
                [guide.supportGuideId, await loadGuideScores(guide)] as const,
            ),
          )
          setScores((current) => ({ ...current, ...Object.fromEntries(pairs) }))
        }
      } catch (cause) {
        setError(message(cause))
      } finally {
        setLoading(false)
      }
    },
    [loadJourney, supportGuideId],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const currentGuide =
    !historical &&
    items.length === 1 &&
    isCurrentJourneyGuide(journey, items[0])
      ? items[0]
      : null
  const readOnly = historical || (journey !== null && currentGuide === null)

  return (
    <div className="support-guide-page">
      {!supportGuideId && (
        <header className="support-guide-page-header">
          <span>
            {historical ? 'Bản ghi lịch sử · chỉ đọc' : 'Sau sàng lọc'}
          </span>
          <h1>{historical ? 'Gợi ý của lần đánh giá này' : 'Gợi ý hỗ trợ'}</h1>
          <p>
            {historical
              ? 'Nội dung này được mở lại đúng như đã lưu cùng lần sàng lọc trước đây; trang không tạo lại hoặc thay đổi gợi ý lịch sử.'
              : 'Xem các bước hỗ trợ dựa trên cặp kết quả PHQ-9 và GAD-7 trong Kiểm tra ban đầu, rồi chủ động chọn điều phù hợp với bạn.'}
          </p>
        </header>
      )}

      {error && (
        <div className="support-guide-state error" role="alert">
          <p>{error}</p>
          <button className="btn btn-ghost" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}
      {!loading && journeyFailed && (
        <div className="support-guide-state" role="status">
          <p>
            Chưa tải được bước tiếp theo. Gợi ý bên dưới vẫn được lưu nguyên
            vẹn.
          </p>
          <button className="btn btn-ghost" onClick={() => void loadJourney()}>
            Thử lại
          </button>
        </div>
      )}
      {loading && (
        <MamAnLoadingState
          title="Đang tải gợi ý hỗ trợ đã lưu..."
          description="Mầm An đang mở lại gợi ý và đúng cặp kết quả của lần đánh giá này."
          preview="meaning"
        />
      )}
      {!loading && currentGuide && journey && (
        <GuidedJourneySteps
          journey={journey}
          onRetry={() => void loadJourney()}
        />
      )}
      {!loading && !error && items.length === 0 && (
        <div className="support-guide-state">
          <strong>Chưa có gợi ý hỗ trợ</strong>
          <p>
            Các bài trong lịch sử không tự động được ghép. Hãy hoàn tất PHQ-9 và
            GAD-7 trong cùng lượt Kiểm tra ban đầu để nhận gợi ý đầu tiên.
          </p>
          <Link className="btn btn-ghost" href="/initial-check">
            Đi tới kiểm tra ban đầu
          </Link>
        </div>
      )}
      {!loading && (
        <section
          className="support-guide-list"
          aria-label={
            historical ? 'Gợi ý hỗ trợ đã lưu' : 'Lịch sử gợi ý hỗ trợ'
          }
        >
          {items.map((guide, index) => (
            <div
              className="support-guide-entry"
              key={guide.supportGuideId}
              style={
                {
                  '--entry-delay': `${Math.min(index, 7) * 45}ms`,
                } as React.CSSProperties
              }
            >
              <SupportGuideCard
                guide={guide}
                historical={readOnly}
                scorePair={scores[guide.supportGuideId]}
                resultEvaluationId={resultEvaluationId}
                headingLevel={supportGuideId ? 'h1' : 'h2'}
                showOpenLink={!supportGuideId}
                continuation={
                  guide === currentGuide && journey
                    ? guideContinuation(journey, guide)
                    : readOnly
                      ? undefined
                      : null
                }
              />
            </div>
          ))}
        </section>
      )}
      {hasMore && !loading && (
        <button className="btn btn-ghost" onClick={() => void load(cursor)}>
          Tải thêm lịch sử
        </button>
      )}
    </div>
  )
}
