'use client'

import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { GuidedJourney } from '@/features/assessment/api/care-contract'
import { getInitialCheckState } from '@/features/assessment/api/browser-care'
import { MamAnLoadingState } from '@/features/assessment/components/MamAnLoadingState'
import type { InitialCheckState } from '@/features/initial-check/api/initial-check-contract'
import {
  ensureCurrentSupportGuide,
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
import styles from './support-guide-overview.module.css'
import './support-guide.css'

function guideDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

async function currentGuide(
  journey: GuidedJourney,
  history: readonly SupportGuide[],
) {
  if (journey.supportGuideId) {
    return (
      history.find((item) => item.supportGuideId === journey.supportGuideId) ??
      (await getSupportGuide(journey.supportGuideId))
    )
  }
  return journey.episodeId ? ensureCurrentSupportGuide() : null
}

export default function SupportGuideOverview() {
  const [guide, setGuide] = useState<SupportGuide | null>(null)
  const [history, setHistory] = useState<SupportGuide[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [scores, setScores] = useState<SupportGuideScorePair | null>(null)
  const [initialCheck, setInitialCheck] = useState<InitialCheckState | null>(
    null,
  )
  const [journey, setJourney] = useState<GuidedJourney | null>(null)
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [historyResult, checkResult, journeyResult] =
      await Promise.allSettled([
        getSupportGuideHistory(),
        getInitialCheckState(),
        getGuidedJourney(),
      ])
    setInitialCheck(
      checkResult.status === 'fulfilled' ? checkResult.value : null,
    )
    if (
      historyResult.status === 'rejected' ||
      journeyResult.status === 'rejected'
    ) {
      setError('Chưa thể tải gợi ý hỗ trợ. Vui lòng thử lại.')
      setLoading(false)
      return
    }
    let currentJourney = journeyResult.value
    let current: SupportGuide | null
    try {
      setPreparing(currentJourney.stage === 'GUIDE_REQUIRED')
      current = await currentGuide(currentJourney, historyResult.value.items)
      if (currentJourney.stage === 'GUIDE_REQUIRED') {
        currentJourney = await getGuidedJourney()
      }
    } catch {
      setError(
        'Chưa thể chuẩn bị gợi ý hỗ trợ. Kết quả sàng lọc của bạn vẫn được lưu, hãy thử lại.',
      )
      setLoading(false)
      setPreparing(false)
      return
    }
    const shown = current ?? historyResult.value.items[0] ?? null
    setJourney(currentJourney)
    setHistory(
      shown
        ? [
            shown,
            ...historyResult.value.items.filter(
              (item) => item.supportGuideId !== shown.supportGuideId,
            ),
          ]
        : historyResult.value.items,
    )
    setCursor(historyResult.value.nextCursor ?? null)
    setHasMore(historyResult.value.hasMore)
    setGuide(shown)
    setScores(shown ? await loadGuideScores(shown) : null)
    setPreparing(false)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const loadMoreHistory = async () => {
    if (!cursor || historyLoading) return
    setHistoryLoading(true)
    try {
      const next = await getSupportGuideHistory(cursor)
      setHistory((current) => [
        ...current,
        ...next.items.filter(
          (item) =>
            !current.some(
              (existing) => existing.supportGuideId === item.supportGuideId,
            ),
        ),
      ])
      setCursor(next.nextCursor ?? null)
      setHasMore(next.hasMore)
    } catch {
      setError('Chưa thể tải thêm lịch sử gợi ý. Vui lòng thử lại.')
    } finally {
      setHistoryLoading(false)
    }
  }

  const evaluation =
    initialCheck?.phase === 'COMPLETED' &&
    guide?.supportEvaluationId ===
      initialCheck.combinedMeaning.domainSupportEvaluationId
      ? initialCheck.evaluation
      : null
  const isCurrent = guide !== null && isCurrentJourneyGuide(journey, guide)
  const resumeLabel = journey?.assessmentInProgress
    ? 'Tiếp tục bài sàng lọc đang làm'
    : 'Cập nhật sàng lọc mới'

  return (
    <div className={styles.page}>
      {loading ? (
        <MamAnLoadingState
          title={
            preparing
              ? 'Đang chuẩn bị gợi ý hỗ trợ của bạn...'
              : 'Đang tải gợi ý hỗ trợ của bạn...'
          }
          description="Mầm An đang đồng hành cùng bạn. Gợi ý và cặp kết quả đã lưu sẽ xuất hiện tại đây."
          preview="meaning"
        />
      ) : (
        <>
          {error && (
            <div className={styles.state} role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => void load()}>
                Thử lại
              </button>
            </div>
          )}
          {guide ? (
            <>
              {isCurrent && journey && (
                <GuidedJourneySteps
                  journey={journey}
                  onRetry={() => void load()}
                />
              )}
              <div className={styles.contextRow}>
                <Link
                  href={
                    evaluation
                      ? `/assessments/results/${evaluation.supportEvaluationId}`
                      : '/assessments'
                  }
                >
                  {evaluation
                    ? 'Xem kết quả sàng lọc liên kết'
                    : 'Xem lịch sử sàng lọc'}
                </Link>
                <Link href="/initial-check">
                  <RefreshCw aria-hidden="true" /> {resumeLabel}
                </Link>
              </div>
              <SupportGuideCard
                guide={guide}
                headingLevel="h1"
                scorePair={scores}
                supportTier={evaluation?.supportTier}
                continuation={
                  isCurrent && journey
                    ? guideContinuation(journey, guide)
                    : undefined
                }
              />
              <details className={styles.history}>
                <summary>Lịch sử gợi ý hỗ trợ</summary>
                <ul>
                  {history.map((item) => (
                    <li key={item.supportGuideId}>
                      <Link
                        href={`/support-guides/${item.supportGuideId}?from=screening-history`}
                      >
                        Gợi ý ngày {guideDate(item.generatedAt)}
                      </Link>
                    </li>
                  ))}
                </ul>
                {hasMore && (
                  <button
                    type="button"
                    disabled={historyLoading}
                    onClick={() => void loadMoreHistory()}
                  >
                    {historyLoading ? 'Đang tải...' : 'Tải thêm lịch sử'}
                  </button>
                )}
              </details>
            </>
          ) : (
            !error && (
              <section className={styles.empty}>
                <h1>Với kết quả của mình, bạn nên làm gì tiếp theo?</h1>
                <p>
                  Hoàn tất PHQ-9 và GAD-7 trong cùng lượt Kiểm tra ban đầu, gợi
                  ý hỗ trợ sẽ xuất hiện ngay sau phần kết quả.
                </p>
                <Link href="/initial-check">
                  {journey?.assessmentInProgress
                    ? 'Tiếp tục kiểm tra ban đầu'
                    : 'Bắt đầu kiểm tra ban đầu'}
                </Link>
              </section>
            )
          )}
        </>
      )}
    </div>
  )
}
