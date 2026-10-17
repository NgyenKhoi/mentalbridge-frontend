'use client'

import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type {
  CombinedScreeningMeaning,
  GuidedJourney,
} from '@/features/assessment/api/care-contract'
import { MamAnLoadingState } from '@/features/assessment/components/MamAnLoadingState'
import {
  ensureCurrentSupportGuide,
  getGuidedJourney,
  getSupportGuide,
  getSupportGuideHistory,
} from '../api/browser-support-guide'
import type { SupportGuide } from '../api/support-guide-contract'
import GuideLoadError from './GuideLoadError'
import GuidedJourneySteps from './GuidedJourneySteps'
import SupportGuideCard, {
  type SupportGuideScorePair,
} from './SupportGuideCard'
import { guideContinuation, isCurrentJourneyGuide } from './guided-continuation'
import { loadGuideMeaning, loadGuideScores } from './load-guide-scores'
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
  const [meaning, setMeaning] = useState<CombinedScreeningMeaning | null>(null)
  const [journey, setJourney] = useState<GuidedJourney | null>(null)
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A retry keeps the error panel mounted so its busy state and focus survive.
  const load = useCallback(async (retry = false) => {
    if (!retry) {
      setLoading(true)
      setError(null)
    }
    const [historyResult, journeyResult] = await Promise.allSettled([
      getSupportGuideHistory(),
      getGuidedJourney(),
    ])
    if (
      historyResult.status === 'rejected' ||
      journeyResult.status === 'rejected'
    ) {
      setError(
        'Kết quả sàng lọc của bạn vẫn được lưu an toàn. Hãy thử lại sau giây lát.',
      )
      setLoading(false)
      return
    }
    let currentJourney = journeyResult.value
    let current: SupportGuide | null
    try {
      if (currentJourney.stage === 'GUIDE_REQUIRED') {
        setPreparing(true)
        setLoading(true)
      }
      current = await currentGuide(currentJourney, historyResult.value.items)
      if (currentJourney.stage === 'GUIDE_REQUIRED') {
        currentJourney = await getGuidedJourney()
      }
    } catch {
      setError(
        'Chưa thể chuẩn bị gợi ý hỗ trợ lúc này. Kết quả sàng lọc của bạn vẫn được lưu an toàn.',
      )
      setLoading(false)
      setPreparing(false)
      return
    }
    const shown = current ?? historyResult.value.items[0] ?? null
    // Resolve the whole card before committing it, so a retry never flashes a partial Guide.
    const [pair, savedMeaning] = shown
      ? await Promise.all([
          loadGuideScores(shown),
          loadGuideMeaning(
            shown,
            isCurrentJourneyGuide(currentJourney, shown)
              ? currentJourney.presentationEvaluationId
              : null,
          ),
        ])
      : [null, null]
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
    setError(null)
    setGuide(shown)
    setScores(pair)
    setMeaning(savedMeaning)
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
              ? 'Đang chuẩn bị gợi ý hỗ trợ của bạn…'
              : 'Đang tải gợi ý hỗ trợ của bạn…'
          }
          description="Mầm An đang đồng hành cùng bạn. Gợi ý và cặp kết quả đã lưu sẽ xuất hiện tại đây."
          preview="meaning"
        />
      ) : (
        <>
          {error &&
            (guide ? (
              <div className={styles.state} role="alert">
                <p>{error}</p>
                <button type="button" onClick={() => void load()}>
                  Thử lại
                </button>
              </div>
            ) : (
              <GuideLoadError message={error} onRetry={() => load(true)} />
            ))}
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
                    meaning
                      ? `/assessments/results/${meaning.supportEvaluationId}`
                      : '/assessments'
                  }
                >
                  {meaning
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
                meaning={meaning}
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
                    {historyLoading ? 'Đang tải…' : 'Tải thêm lịch sử'}
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
