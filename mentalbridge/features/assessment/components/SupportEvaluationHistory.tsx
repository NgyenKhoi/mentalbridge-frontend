'use client'

import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Check } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Disclosure } from '@/components/ui/Disclosure'
import type {
  SupportEvaluation,
  SupportTier,
} from '@/features/assessment/api/care-contract'
import { getSupportEvaluationHistory } from '@/features/assessment/api/browser-care'
import { HistoricalCombinedMeaning } from './HistoricalCombinedMeaning'
import { MamAnLoadingState } from './MamAnLoadingState'

import styles from './SupportEvaluationHistory.module.css'

const tierLabels: Record<SupportTier, string> = {
  SELF_GUIDED_SUPPORT: 'Tự hỗ trợ',
  PROFESSIONAL_SUPPORT_RECOMMENDED: 'Hỗ trợ chuyên môn',
  SAFETY_FOLLOW_UP_RECOMMENDED: 'Ưu tiên an toàn',
}

function evaluationDate(item: SupportEvaluation) {
  return new Date(item.evaluatedAt).toLocaleString('vi-VN')
}

export function SupportEvaluationHistory({
  active = true,
}: {
  active?: boolean
}) {
  const [items, setItems] = useState<SupportEvaluation[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const [cursor, setCursor] = useState<string>()
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ cursor?: string }>()
  const requestRef = useRef<AbortController | null>(null)
  const started = useRef(false)

  const load = useCallback(async (next?: string) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError(undefined)
    try {
      const page = await getSupportEvaluationHistory(next, controller.signal)
      if (controller.signal.aborted) return
      setItems((current) => {
        const records = next ? [...current, ...page.items] : page.items
        return [
          ...new Map(
            records.map((item) => [item.supportEvaluationId, item]),
          ).values(),
        ]
      })
      setCursor(page.nextCursor ?? undefined)
      setHasMore(page.hasMore)
    } catch {
      if (!controller.signal.aborted) setError({ cursor: next })
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!active || started.current) return
    const timer = window.setTimeout(() => {
      started.current = true
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [active, load])

  useEffect(() => () => requestRef.current?.abort(), [])

  const selected =
    items.find((item) => item.supportEvaluationId === selectedId) ?? items[0]

  return (
    <section className={styles.history} aria-label="Gợi ý sau sàng lọc đã lưu">
      {selected && (
        <div className={styles.toolbar}>
          <Disclosure
            className={styles.selector}
            summaryLabel="Chọn lần sàng lọc để xem kết quả"
            summary={
              <span className={styles.selectorLabel}>
                <CalendarDays aria-hidden="true" /> Chọn lần sàng lọc
              </span>
            }
            meta={
              <time dateTime={selected.evaluatedAt}>
                {evaluationDate(selected)}
              </time>
            }
          >
            <ul className={styles.choices} aria-label="Các kết quả đã lưu">
              {items.map((item) => (
                <li key={item.supportEvaluationId}>
                  <button
                    type="button"
                    aria-pressed={
                      item.supportEvaluationId === selected.supportEvaluationId
                    }
                    aria-controls="support-meaning-view"
                    onClick={() => setSelectedId(item.supportEvaluationId)}
                  >
                    <span>
                      <time dateTime={item.evaluatedAt}>
                        {evaluationDate(item)}
                      </time>
                      <span>{tierLabels[item.supportTier]}</span>
                    </span>
                    {item.supportEvaluationId ===
                      selected.supportEvaluationId && (
                      <Check aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {loading && (
              <p className={styles.loadStatus} role="status">
                Đang tải thêm kết quả…
              </p>
            )}
            {hasMore && !error && (
              <button
                className={styles.loadMore}
                type="button"
                disabled={loading}
                onClick={() => void load(cursor)}
              >
                Tải thêm kết quả
              </button>
            )}
          </Disclosure>
          <Link
            className={styles.openResult}
            href={`/assessments/results/${selected.supportEvaluationId}`}
          >
            Mở trang kết quả <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      )}

      {error && (
        <div className={styles.state} role="alert">
          <strong>
            {items.length
              ? 'Chưa thể tải thêm kết quả'
              : 'Chưa thể tải kết quả đã lưu'}
          </strong>
          <p>Kết quả đã lưu không bị thay đổi. Bạn có thể thử tải lại.</p>
          <button type="button" onClick={() => void load(error.cursor)}>
            Thử lại
          </button>
        </div>
      )}

      {!selected && loading && (
        <MamAnLoadingState
          title="Đang mở kết quả sau sàng lọc"
          description="Mầm An đang tìm đúng cặp PHQ-9 và GAD-7 đã lưu của bạn."
          headingLevel="h2"
          preview="meaning"
        />
      )}

      {!selected && !loading && !error && (
        <div className={styles.state}>
          <h2>Chưa có kết quả tổng hợp</h2>
          <p>
            Hoàn thành PHQ-9 và GAD-7 trong cùng một lượt sàng lọc để xem ý
            nghĩa kết quả và bước tiếp theo.
          </p>
          <Link href="/initial-check">Làm bài sàng lọc</Link>
        </div>
      )}

      {selected && (
        <div id="support-meaning-view">
          <HistoricalCombinedMeaning
            key={selected.supportEvaluationId}
            supportEvaluationId={selected.supportEvaluationId}
            embedded
          />
        </div>
      )}
    </section>
  )
}
