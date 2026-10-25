'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ActionOccurrence } from '../api/support-plan-contract'
import { dayLabel } from './TodayPanel'
import type { ProgressSummary } from './workspace-model'
import { hasContentCompletion } from '../resource-plan-origin'

const helpfulLabels = {
  VERY_HELPFUL: 'rất hữu ích',
  HELPFUL: 'hữu ích',
  A_LITTLE_HELPFUL: 'hơi hữu ích',
  NOT_HELPFUL: 'chưa hợp',
} as const

function helpfulness(occurrences: ActionOccurrence[]) {
  const counts = new Map<string, number>()
  for (const item of occurrences)
    if (item.helpfulness)
      counts.set(item.helpfulness, (counts.get(item.helpfulness) ?? 0) + 1)
  return (Object.keys(helpfulLabels) as Array<keyof typeof helpfulLabels>)
    .filter((key) => counts.has(key))
    .map((key) => `${counts.get(key)} lần ${helpfulLabels[key]}`)
    .join(', ')
}

function Row({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="mbw-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export default function ProgressPanel({
  summary,
  occurrences,
  loadError,
  onRetry,
}: Readonly<{
  summary?: ProgressSummary
  occurrences: ActionOccurrence[]
  loadError: boolean
  onRetry: () => void
}>) {
  const rated = helpfulness(occurrences)
  const contentCompletions = occurrences.filter(
    (item) =>
      hasContentCompletion(item) &&
      summary &&
      item.localDate >= summary.from &&
      item.localDate <= summary.through,
  )
  return (
    <div className="mbw-progress">
      <section className="mbw-tile" aria-labelledby="mbw-progress-title">
        <h2 id="mbw-progress-title">Những gì bạn đã làm</h2>
        {summary ? (
          <>
            <p className="mbw-quiet">
              Từ {dayLabel(summary.from)} đến hôm nay.
            </p>
            <dl className="mbw-facts">
              <Row label="Hoạt động">
                {summary.activities.done} lần đã làm
                {summary.activities.skipped > 0 &&
                  `, ${summary.activities.skipped} lần để hôm khác`}
              </Row>
              {contentCompletions.length > 0 && (
                <Row label="Đã ghi nhận từ bài luyện tập">
                  {contentCompletions.length} lần đã làm
                </Row>
              )}
              <Row label="Ghi lại cảm xúc">{summary.emotionDays} ngày</Row>
              <Row label="Nhật ký">{summary.journalDays} ngày</Row>
              <Row label="Mức hữu ích bạn chọn">
                {rated ||
                  'Chưa có. Bạn có thể chọn sau khi làm xong một hoạt động.'}
              </Row>
              <Row label="Các lần kiểm tra">
                <Link href="/assessments">Xem và so sánh các lần kiểm tra</Link>
              </Row>
            </dl>
          </>
        ) : (
          <p className="mbw-quiet" role={loadError ? 'alert' : 'status'}>
            {loadError ? 'Chưa tải được phần này.' : 'Đang tải…'}
            {loadError && (
              <>
                {' '}
                <button
                  type="button"
                  className="mbw-link-button"
                  onClick={onRetry}
                >
                  Thử lại
                </button>
              </>
            )}
          </p>
        )}
      </section>
    </div>
  )
}
