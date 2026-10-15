'use client'

import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileWarning,
  ShieldAlert,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ApiError } from '@/lib/api/api-error'
import { getScreeningEpisodeHistory } from '../api/browser-care'
import type {
  ScreeningEpisodeHistoryItem,
  ScreeningLevel,
} from '../api/care-contract'

import styles from './ScreeningEpisodeHistory.module.css'
import { MamAnLoadingState } from './MamAnLoadingState'

type PurposeFilter = 'ALL' | 'INITIAL_CHECK' | 'REASSESSMENT'

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

const levelStyles: Record<ScreeningLevel, string> = {
  MINIMAL: styles.levelMinimal,
  MILD: styles.levelMild,
  MODERATE: styles.levelModerate,
  MODERATELY_SEVERE: styles.levelModeratelySevere,
  SEVERE: styles.levelSevere,
}

function historyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để xem lịch sử.'
    if (
      ['CARE_TIMEOUT', 'CARE_UNAVAILABLE', 'NETWORK_ERROR'].includes(error.code)
    )
      return 'Dịch vụ tạm thời chưa sẵn sàng. Lịch sử đã lưu không bị thay đổi.'
  }
  return 'Không thể tải lịch sử sàng lọc lúc này. Vui lòng thử lại.'
}

function ScoreCard({
  evidence,
}: Readonly<{
  evidence: ScreeningEpisodeHistoryItem['evidence'][number]
}>) {
  const phq9 = evidence.instrument === 'PHQ9'
  const maximum = phq9 ? 27 : 21
  const instrumentLabel = phq9 ? 'PHQ-9' : 'GAD-7'
  const subjectLabel = phq9 ? 'Dấu hiệu trầm cảm' : 'Dấu hiệu lo âu'
  const accessibleLabel = `${instrumentLabel} · ${subjectLabel}`

  if (evidence.state !== 'AVAILABLE') {
    const missing = evidence.state === 'MISSING'
    return (
      <div className={`${styles.scoreCard} ${styles.scoreUnavailable}`}>
        <div className={styles.scoreHeader}>
          <span className={styles.scoreIdentity}>
            <strong>{instrumentLabel}</strong>
            <span>{subjectLabel}</span>
          </span>
          <span className={styles.missingLevel}>
            {missing ? 'Chưa hoàn tất' : 'Không khả dụng'}
          </span>
        </div>
        <div
          className={styles.missingScore}
          aria-label={`${accessibleLabel}: chưa có điểm`}
        >
          <strong>—</strong>
          <span>
            {missing
              ? `Chưa làm ${phq9 ? 'PHQ-9' : 'GAD-7'}`
              : 'Không đọc được điểm đã lưu'}
          </span>
        </div>
      </div>
    )
  }

  const level = evidence.screeningLevel!
  const positiveSafety =
    phq9 && evidence.safetyStatus === 'POSITIVE_SAFETY_SCREEN'
  const activeBandCount =
    level === 'MINIMAL'
      ? 1
      : level === 'MILD'
        ? 2
        : level === 'MODERATE'
          ? 3
          : 4

  return (
    <div
      className={`${styles.scoreCard} ${levelStyles[level]} ${
        phq9 ? '' : styles.gadScore
      }`}
    >
      <div className={styles.scoreHeader}>
        <span className={styles.scoreIdentity}>
          <strong>{instrumentLabel}</strong>
          <span>{subjectLabel}</span>
        </span>
        <span className={styles.level}>Mức {levelLabels[level]}</span>
      </div>
      <div className={styles.scoreValue}>
        <strong>{evidence.totalScore}</strong>
        <span>/{maximum} điểm</span>
      </div>
      {positiveSafety && (
        <span className={styles.scoreSafety}>
          <ShieldAlert aria-hidden="true" /> Có thông tin an toàn cần xem
        </span>
      )}
      <div
        className={styles.scoreScale}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={maximum}
        aria-valuenow={evidence.totalScore!}
        aria-valuetext={`Mức ${levelLabels[level]}`}
        aria-label={`${instrumentLabel}: ${evidence.totalScore} trên ${maximum} điểm, mức ${levelLabels[level]}`}
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            aria-hidden="true"
            data-active={index < activeBandCount ? 'true' : 'false'}
            key={`${evidence.instrument}-range-${index}`}
          />
        ))}
      </div>
    </div>
  )
}

function EpisodeCard({
  item,
}: Readonly<{ item: ScreeningEpisodeHistoryItem }>) {
  const titleId = `screening-episode-${item.episodeId}-title`
  const displayAt = item.completedAt ?? item.updatedAt
  const occurredAt = new Date(displayAt)
  const meaning = item.meaningState === 'AVAILABLE' ? item.meaning : null
  const incomplete = item.meaningState === 'INCOMPLETE'
  const safety =
    meaning?.presentationPriority === 'SAFETY' ||
    item.evidence.some(
      (evidence) =>
        evidence.instrument === 'PHQ9' &&
        evidence.state === 'AVAILABLE' &&
        evidence.safetyStatus === 'POSITIVE_SAFETY_SCREEN',
    )
  const purposeLabel =
    item.purpose === 'REASSESSMENT' ? 'Đánh giá lại' : 'Kiểm tra ban đầu'
  const resumeHref =
    item.purpose === 'REASSESSMENT'
      ? '/initial-check?purpose=reassessment'
      : '/initial-check'

  return (
    <article
      className={`${styles.card} ${item.meaningState === 'UNAVAILABLE' ? styles.unavailable : ''} ${incomplete ? styles.incomplete : ''} ${safety ? styles.safetyCard : ''}`}
      aria-labelledby={titleId}
    >
      <h3 id={titleId} className="sr-only">
        {purposeLabel} ngày {occurredAt.toLocaleDateString('vi-VN')}
      </h3>
      <header className={styles.cardHeader}>
        <div className={styles.date}>
          <span
            className={`${styles.statusMarker} ${
              safety
                ? styles.statusSafety
                : incomplete || item.meaningState === 'UNAVAILABLE'
                  ? styles.statusIncomplete
                  : styles.statusComplete
            }`}
            aria-hidden="true"
          />
          <CalendarDays aria-hidden="true" />
          <time dateTime={displayAt}>
            <strong>{occurredAt.toLocaleDateString('vi-VN')}</strong>
            <span aria-label="Thời gian ghi nhận">
              {occurredAt.toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </time>
        </div>
        <div className={styles.badges}>
          <span className={styles.purpose}>{purposeLabel}</span>
          <span
            className={
              meaning
                ? styles.complete
                : incomplete
                  ? styles.incompleteBadge
                  : styles.legacy
            }
          >
            {meaning
              ? 'Đã hoàn thành'
              : incomplete
                ? 'Chưa hoàn tất'
                : 'Thiếu dữ liệu tương thích'}
          </span>
          {safety && (
            <span className={styles.safetyBadge}>Ưu tiên an toàn</span>
          )}
        </div>
      </header>

      <div className={styles.scores} aria-label="Kết quả của hai bài">
        {item.evidence.map((evidence) => (
          <ScoreCard
            evidence={evidence}
            key={evidence.assessmentId ?? evidence.instrument}
          />
        ))}
      </div>

      {meaning ? (
        <>
          <div className={styles.cardFooter}>
            <p>
              <strong>
                {safety ? 'Hướng dẫn cần xem trước:' : 'Ý nghĩa của lần này:'}
              </strong>{' '}
              {safety
                ? 'Kết quả này có thông tin an toàn cần được ưu tiên trước gợi ý thông thường.'
                : meaning.baseMeaning.text}
            </p>
            <div className={styles.actions}>
              {meaning.supportGuideId && (
                <Link
                  className={styles.secondaryAction}
                  href={`/support-guides/${meaning.supportGuideId}?from=screening-history&resultEvaluationId=${meaning.supportEvaluationId}`}
                >
                  <BookOpen aria-hidden="true" /> Gợi ý đã lưu
                </Link>
              )}
              <Link
                className={styles.primaryAction}
                href={`/assessments/results/${item.presentationEvaluationId}`}
              >
                {safety ? 'Xem hướng dẫn an toàn' : 'Xem kết quả'}{' '}
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </>
      ) : incomplete ? (
        <div className={styles.cardFooter}>
          <div>
            {item.status === 'READY' ? (
              <p>
                <strong>Hai bài đã được lưu cùng một lượt:</strong> MentalBridge
                chưa hoàn tất bước tổng hợp ý nghĩa. Bạn có thể tiếp tục để tạo
                kết quả từ đúng cặp PHQ-9 và GAD-7 này.
              </p>
            ) : (
              <p>
                <strong>Chưa có ý nghĩa tổng hợp:</strong> Lượt này chưa đủ cả
                PHQ-9 và GAD-7. MentalBridge chỉ ghép hai bài được lưu trong
                cùng lượt, không lấy kết quả gần nhất từ nơi khác.
              </p>
            )}
            {safety && (
              <p className={styles.safetyNote}>
                <ShieldAlert aria-hidden="true" /> PHQ-9 đã ghi nhận một câu trả
                lời cần ưu tiên xem thông tin an toàn; trạng thái này không được
                suy ra từ tổng điểm.
              </p>
            )}
          </div>
          <div className={styles.actions}>
            {safety && (
              <Link
                className={styles.secondaryAction}
                href="/safety-directory?trigger=positive-item-9"
              >
                <ShieldAlert aria-hidden="true" /> Xem hướng dẫn an toàn
              </Link>
            )}
            <Link className={styles.primaryAction} href={resumeHref}>
              {item.status === 'READY'
                ? 'Hoàn tất tổng hợp kết quả'
                : 'Làm tiếp bài còn thiếu'}{' '}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.unavailableBody}>
          <FileWarning aria-hidden="true" />
          <div>
            <strong>Không thể dựng lại ý nghĩa tổng hợp của lượt này</strong>
            <p>
              Bản ghi cũ đang thiếu một phần dữ liệu hoặc dùng phiên bản không
              còn tương thích. MentalBridge không ghép đoán từ những lần làm
              khác.
            </p>
          </div>
        </div>
      )}
    </article>
  )
}

export function ScreeningEpisodeHistory() {
  const [items, setItems] = useState<ScreeningEpisodeHistoryItem[]>([])
  const [cursor, setCursor] = useState<string>()
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [filter, setFilter] = useState<PurposeFilter>('ALL')
  const requestRef = useRef<AbortController | null>(null)

  const load = useCallback(async (next?: string) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError(undefined)
    try {
      const page = await getScreeningEpisodeHistory(next, controller.signal)
      if (controller.signal.aborted) return
      setItems((current) => {
        if (!next) return page.items
        const known = new Set(current.map((item) => item.episodeId))
        return [
          ...current,
          ...page.items.filter((item) => !known.has(item.episodeId)),
        ]
      })
      setCursor(page.nextCursor ?? undefined)
      setHasMore(page.hasMore)
    } catch (cause) {
      if (controller.signal.aborted) return
      setError(historyError(cause))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      requestRef.current?.abort()
    }
  }, [load])

  const visibleItems = useMemo(
    () =>
      filter === 'ALL'
        ? items
        : items.filter((item) => item.purpose === filter),
    [filter, items],
  )

  return (
    <section className={styles.history} aria-labelledby="episode-history-title">
      <div className={styles.intro}>
        <div className="sr-only">
          <h2 id="episode-history-title">Lịch sử theo từng lượt sàng lọc</h2>
          <p>
            Mỗi mục giữ đúng dữ liệu PHQ-9 và GAD-7 của cùng một lượt, kể cả khi
            bạn chưa hoàn tất cả hai bài.
          </p>
        </div>
        <div
          className={styles.filters}
          role="group"
          aria-label="Lọc loại lượt sàng lọc"
        >
          {(
            [
              ['ALL', 'Tất cả'],
              ['INITIAL_CHECK', 'Kiểm tra ban đầu'],
              ['REASSESSMENT', 'Đánh giá lại'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && items.length === 0 && (
        <div className={styles.state} role="alert">
          <strong>Chưa tải được lịch sử</strong>
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}

      {loading && items.length === 0 && !error && (
        <MamAnLoadingState
          title="Đang chuẩn bị lịch sử sàng lọc"
          description="Mầm An đang gom các cặp PHQ-9 và GAD-7 đã lưu để bạn xem lại đúng từng lượt."
          headingLevel="h3"
          preview="history"
        />
      )}

      {!loading && !error && items.length === 0 && (
        <div className={styles.state}>
          <strong>Chưa có lượt sàng lọc nào</strong>
          <p>
            Bắt đầu một lượt kiểm tra để lưu PHQ-9 và GAD-7 cùng nhau. Ý nghĩa
            tổng hợp chỉ xuất hiện sau khi cả hai bài hoàn tất.
          </p>
          <Link href="/initial-check">Bắt đầu kiểm tra ban đầu</Link>
        </div>
      )}

      {items.length > 0 && visibleItems.length === 0 && (
        <div className={styles.state}>
          <strong>
            {hasMore
              ? 'Chưa thấy lượt phù hợp trong các mục đã tải'
              : 'Chưa có lượt phù hợp bộ lọc'}
          </strong>
          <p>
            {hasMore
              ? 'Bạn có thể tải thêm các lượt trước hoặc chọn “Tất cả” để xem những lượt đã lưu.'
              : 'Bạn có thể chọn “Tất cả” để xem những lượt đã lưu.'}
          </p>
        </div>
      )}

      {visibleItems.length > 0 && (
        <div className={styles.list}>
          {visibleItems.map((item) => (
            <EpisodeCard item={item} key={item.episodeId} />
          ))}
        </div>
      )}

      {error && items.length > 0 && (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      )}

      {hasMore && (
        <button
          className={styles.loadMore}
          type="button"
          disabled={loading}
          aria-busy={loading}
          onClick={() => void load(cursor)}
        >
          {loading ? 'Đang tải…' : 'Xem thêm các lượt trước'}
          <ChevronDown aria-hidden="true" />
        </button>
      )}
    </section>
  )
}
