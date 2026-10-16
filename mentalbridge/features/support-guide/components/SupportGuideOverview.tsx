'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RefreshCw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getInitialCheckState } from '@/features/assessment/api/browser-care'
import { MamAnLoadingState } from '@/features/assessment/components/MamAnLoadingState'
import type { InitialCheckState } from '@/features/initial-check/api/initial-check-contract'
import { ApiError } from '@/lib/api/api-error'
import {
  generateSupportGuide,
  getSupportGuideHistory,
} from '../api/browser-support-guide'
import type { SupportGuide } from '../api/support-guide-contract'
import SupportGuideCard, {
  type SupportGuideScorePair,
} from './SupportGuideCard'
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

export default function SupportGuideOverview() {
  const router = useRouter()
  const [guide, setGuide] = useState<SupportGuide | null>(null)
  const [history, setHistory] = useState<SupportGuide[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [scores, setScores] = useState<SupportGuideScorePair | null>(null)
  const [initialCheck, setInitialCheck] = useState<InitialCheckState | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generationKey = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [historyResult, checkResult] = await Promise.allSettled([
      getSupportGuideHistory(),
      getInitialCheckState(),
    ])
    setInitialCheck(
      checkResult.status === 'fulfilled' ? checkResult.value : null,
    )
    if (historyResult.status === 'rejected') {
      setError('Chưa thể tải gợi ý hỗ trợ. Vui lòng thử lại.')
      setLoading(false)
      return
    }
    const latest = historyResult.value.items[0] ?? null
    setHistory(historyResult.value.items)
    setCursor(historyResult.value.nextCursor ?? null)
    setHasMore(historyResult.value.hasMore)
    setGuide(latest)
    setScores(latest ? await loadGuideScores(latest) : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const create = async () => {
    if (generating) return
    setGenerating(true)
    setError(null)
    try {
      const currentCheck = await getInitialCheckState()
      setInitialCheck(currentCheck)
      if (currentCheck.phase !== 'COMPLETED') {
        router.push('/assessments')
        return
      }
      generationKey.current ??= crypto.randomUUID()
      const created = await generateSupportGuide(generationKey.current)
      const nextScores = await loadGuideScores(created)
      setGuide(created)
      setHistory((current) => [
        created,
        ...current.filter(
          (item) => item.supportGuideId !== created.supportGuideId,
        ),
      ])
      setScores(nextScores)
      generationKey.current = null
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.code === 'INITIAL_CHECK_INCOMPLETE'
      ) {
        router.push('/assessments')
        return
      }
      setError('Chưa thể tạo gợi ý hỗ trợ. Vui lòng thử lại.')
    } finally {
      setGenerating(false)
    }
  }

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
  const hasNewCheck =
    guide &&
    initialCheck?.phase === 'COMPLETED' &&
    initialCheck.combinedMeaning.domainSupportEvaluationId !==
      guide.supportEvaluationId

  return (
    <div className={styles.page}>
      {loading || generating ? (
        <MamAnLoadingState
          title={
            generating
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
                {hasNewCheck ? (
                  <button type="button" onClick={() => void create()}>
                    <Sparkles aria-hidden="true" /> Tạo gợi ý từ kiểm tra ban
                    đầu
                  </button>
                ) : (
                  <Link href="/initial-check">
                    <RefreshCw aria-hidden="true" /> Cập nhật sàng lọc mới
                  </Link>
                )}
              </div>
              <SupportGuideCard
                guide={guide}
                headingLevel="h1"
                scorePair={scores}
                supportTier={evaluation?.supportTier}
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
                  Hoàn tất PHQ-9 và GAD-7 trong cùng lượt Kiểm tra ban đầu để
                  xem những bước hỗ trợ phù hợp.
                </p>
                <button type="button" onClick={() => void create()}>
                  <Sparkles aria-hidden="true" /> Tạo gợi ý từ kiểm tra ban đầu
                </button>
              </section>
            )
          )}
        </>
      )}
    </div>
  )
}
