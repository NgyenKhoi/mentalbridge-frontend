'use client'

import { useEffect, useRef, useState } from 'react'

import { listReassessmentSummaries } from '../api/browser-care'
import type { ReassessmentSummary } from '../api/care-contract'
import { ReassessmentReview } from './ReassessmentReview'
import { formatDayMonth } from './reassessment-review-model'

const PAGE_SIZE = 10
// Bounded: at most this many reviews are listed; older ones stay in Care.
const MAX_LISTED = 100

const dayMonth = (iso: string) => formatDayMonth(iso)
// Periods are half-open, so the last day shown is the day before endAt.
const rangeLabel = (summary: ReassessmentSummary) =>
  `${dayMonth(summary.previousPeriod.startAt)}–${dayMonth(
    new Date(Date.parse(summary.currentPeriod.endAt) - 1).toISOString(),
  )}`

/** The newest review first, then the earlier ones; picking one shows it as it was composed. */
export function ReassessmentReviewTab({
  planReview = false,
}: Readonly<{ planReview?: boolean }>) {
  const [latest, setLatest] = useState<ReassessmentSummary>()
  const [others, setOthers] = useState<ReassessmentSummary[]>([])
  const [selected, setSelected] = useState<ReassessmentSummary>()
  const [listFailed, setListFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    listReassessmentSummaries(PAGE_SIZE)
      .then((page) => {
        if (!active) return
        setOthers(page.items)
        setNextCursor(page.hasMore ? page.nextCursor : null)
        setListFailed(false)
      })
      .catch(() => active && setListFailed(true))
    return () => {
      active = false
    }
  }, [attempt])

  // After opening an earlier review, bring it into view and move focus to its heading.
  useEffect(() => {
    if (!selected) return
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
    body.current?.querySelector<HTMLElement>('.rr-header h2')?.focus()
  }, [selected])

  function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    listReassessmentSummaries(PAGE_SIZE, nextCursor)
      .then((page) => {
        setOthers((current) => [
          ...current,
          ...page.items.filter(
            (item) => !current.some((old) => old.summaryId === item.summaryId),
          ),
        ])
        setNextCursor(page.hasMore ? page.nextCursor : null)
        setListFailed(false)
      })
      .catch(() => setListFailed(true))
      .finally(() => setLoadingMore(false))
  }

  const earlier = others.filter((item) => item.summaryId !== latest?.summaryId)

  return (
    <div className="rr-tab-body" ref={body}>
      {selected ? (
        <>
          <button
            type="button"
            className="rr-link"
            onClick={() => setSelected(undefined)}
          >
            Quay lại lần nhìn lại mới nhất
          </button>
          <ReassessmentReview
            key={selected.summaryId}
            variant="tab"
            summary={selected}
          />
        </>
      ) : (
        <ReassessmentReview
          variant="tab"
          planReview={planReview}
          onReady={setLatest}
        />
      )}
      {listFailed && (
        <div className="rr-gate" role="alert">
          <p>Chưa tải được các lần nhìn lại trước.</p>
          <button
            type="button"
            className="rr-link"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Thử lại
          </button>
        </div>
      )}
      {earlier.length > 0 && (
        <section className="rr-history" aria-labelledby="rr-history-title">
          <h3 id="rr-history-title">Các lần nhìn lại trước</h3>
          <ul>
            {earlier.map((item) => (
              <li key={item.summaryId}>
                <button
                  type="button"
                  className="rr-history-row"
                  aria-pressed={selected?.summaryId === item.summaryId}
                  onClick={() => setSelected(item)}
                >
                  <span>{rangeLabel(item)}</span>
                  <span>Tạo ngày {formatDayMonth(item.composedAt, true)}</span>
                </button>
              </li>
            ))}
          </ul>
          {nextCursor && others.length < MAX_LISTED && (
            <button
              type="button"
              className="rr-link"
              disabled={loadingMore}
              onClick={loadMore}
            >
              {loadingMore ? 'Đang tải…' : 'Xem thêm'}
            </button>
          )}
        </section>
      )}
    </div>
  )
}
