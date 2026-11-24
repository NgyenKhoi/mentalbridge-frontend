import Link from 'next/link'

import { Skeleton } from '@/components/ui/Skeleton'
import { levelLabels } from '@/features/assessment/components/assessment-meanings'
import { emotionPresentation } from '@/lib/emotion-check-in/presentation'

import type { LookBackChapter } from './look-back-chapters'
import {
  dateRange,
  dayMonth,
  dimensionLabel,
  helpfulnessLabel,
  moodLabel,
  moodTone,
} from './look-back-copy'
import { isModerateOrAbove } from './look-back-model'
import styles from './LookBack.module.css'

const count = (value: number | null) => value ?? '–'
const band = (level: keyof typeof levelLabels) =>
  `Mức ${levelLabels[level].toLowerCase()}`
const LEGEND = ['GREAT', 'GOOD', 'OKAY', 'LOW', 'VERY_LOW'] as const

function Metric({
  label,
  value,
  previous,
}: Readonly<{
  label: string
  value: number | null
  previous: number | null
}>) {
  return (
    <div className={styles.metric}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={styles.metricNum}>{count(value)}</dd>
      <dd className={styles.caption}>
        {value === null
          ? 'Chưa có số liệu'
          : `14 ngày trước đó: ${count(previous)}`}
      </dd>
    </div>
  )
}

function Mood({ chapter }: Readonly<{ chapter: LookBackChapter }>) {
  const { days } = chapter
  return (
    <section className={styles.part} aria-labelledby={`mood-${chapter.number}`}>
      <h3 id={`mood-${chapter.number}`} className={styles.h3}>
        Cảm xúc hằng ngày
      </h3>
      {days === null ? (
        <p className={styles.note}>
          Chỉ giữ chi tiết theo ngày trong 90 ngày gần nhất.
        </p>
      ) : (
        <>
          <div
            className={styles.dots}
            role="img"
            aria-label={`${chapter.checkInDays} ngày có ghi cảm xúc, ${chapter.goodDays} ngày tốt hoặc rất tốt`}
          >
            {days.map((day) => {
              const mood =
                day.emotionLevel === null ? null : moodLabel(day.emotionLevel)
              return (
                <i
                  key={day.localDate}
                  className={styles.dot}
                  data-empty={mood ? undefined : 'true'}
                  title={`${dayMonth(day.localDate)}: ${mood?.label ?? 'chưa ghi'}`}
                  style={
                    mood ? { background: moodTone[mood.key].color } : undefined
                  }
                />
              )
            })}
          </div>
          <div className={styles.note}>
            {chapter.goodDays} ngày tốt hoặc rất tốt · {chapter.checkInDays}{' '}
            ngày ghi
          </div>
          <ul
            className={styles.dotLegend}
            aria-label="Ý nghĩa màu của các chấm"
          >
            {LEGEND.map((key) => (
              <li key={key}>
                <i
                  className={styles.dot}
                  style={{ background: moodTone[key].color }}
                />
                {emotionPresentation[key].label}
              </li>
            ))}
            <li>
              <i className={styles.dot} data-empty="true" />
              Chưa ghi
            </li>
          </ul>
        </>
      )}
    </section>
  )
}

function Done({
  chapter,
  titles,
}: Readonly<{
  chapter: LookBackChapter
  titles: ReadonlyMap<string, string>
}>) {
  const { support, reflections } = chapter
  if (support.completed === null) return null
  const none = support.completed + (support.skipped ?? 0) === 0
  return (
    <section className={styles.part} aria-labelledby={`done-${chapter.number}`}>
      <h3 id={`done-${chapter.number}`} className={styles.h3}>
        Việc đã làm
      </h3>
      {none ? (
        <p className={styles.note}>Chặng này chưa có hoạt động nào được ghi.</p>
      ) : (
        <p className={styles.lead}>
          {support.completed} việc hoàn thành · {count(support.skipped)} bỏ qua
        </p>
      )}
      {reflections.length > 0 && (
        <ul className={styles.helpful}>
          {reflections.map((item) => (
            <li key={item.occurrenceId} className={styles.helpfulItem}>
              <div className={styles.helpfulTitle}>
                {(item.resourceId && titles.get(item.resourceId)) ||
                  (item.localDate
                    ? `Hoạt động ngày ${dayMonth(item.localDate)}`
                    : 'Một hoạt động trong kế hoạch')}
              </div>
              <div className={styles.helpfulKind}>
                {helpfulnessLabel[item.helpfulness]}
              </div>
              {item.reflection && (
                <blockquote className={styles.quote}>
                  “{item.reflection}”
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** One closed chapter: screening bands, three counts against the 14 days before it, daily mood and what was done. */
export function ChapterDetail({
  chapter,
  titles,
  pointer = false,
}: Readonly<{
  chapter: LookBackChapter
  titles: ReadonlyMap<string, string>
  /** Offer the specialist link when a band is moderate or higher. */
  pointer?: boolean
}>) {
  const showPointer =
    pointer && chapter.screening.some((s) => isModerateOrAbove(s.current.level))
  return (
    <div className={styles.chapter}>
      {chapter.screening.length > 0 && (
        // Clinical result: it reads still, with no entrance.
        <section
          className={styles.part}
          aria-labelledby={`screen-${chapter.number}`}
          data-page-motion="off"
        >
          <h3 id={`screen-${chapter.number}`} className={styles.h3}>
            Kết quả tự đánh giá
          </h3>
          <ul className={styles.bands}>
            {chapter.screening.map((item) => (
              <li key={item.instrument} className={styles.band}>
                <div className={styles.statLabel}>
                  {dimensionLabel[item.instrument].plain}
                </div>
                <div className={styles.transition}>
                  {!item.previous
                    ? `${band(item.current.level)}, chưa có kết quả trước để so sánh`
                    : item.previous.level === item.current.level
                      ? `${band(item.current.level)}, giữ nguyên`
                      : `${band(item.previous.level)} → ${band(item.current.level)}`}
                </div>
              </li>
            ))}
          </ul>
          <details className={styles.more}>
            <summary>Xem điểm chi tiết</summary>
            <ul className={styles.details}>
              {chapter.screening.map((item) => (
                <li key={item.instrument}>
                  {dimensionLabel[item.instrument].name}:{' '}
                  {item.previous ? `${item.previous.score} → ` : ''}
                  {item.current.score} điểm
                </li>
              ))}
            </ul>
          </details>
          {showPointer && (
            <div className={styles.pointer}>
              <div>
                Muốn được giải thích rõ hơn về kết quả? Bạn có thể trao đổi với
                chuyên gia.
              </div>
              <Link className={styles.quiet} href="/specialists">
                Tìm chuyên gia
              </Link>
            </div>
          )}
        </section>
      )}
      <dl className={styles.metrics}>
        <Metric
          label="Bài nhật ký"
          value={chapter.journal.current}
          previous={chapter.journal.previous}
        />
        <Metric
          label="Ngày ghi cảm xúc"
          value={chapter.checkInDays}
          previous={chapter.previousCheckInDays}
        />
        <Metric
          label="Việc hoàn thành"
          value={chapter.support.completed}
          previous={chapter.support.previousCompleted}
        />
      </dl>
      <Mood chapter={chapter} />
      <Done chapter={chapter} titles={titles} />
    </div>
  )
}

/** Same shapes as the detail, so the result lands without moving the page. */
export function ChapterDetailSkeleton() {
  return (
    <div className={styles.chapter} aria-hidden="true">
      <Skeleton width="100%" height="132px" />
      <div className={styles.metrics}>
        <Skeleton width="100%" height="92px" />
        <Skeleton width="100%" height="92px" />
        <Skeleton width="100%" height="92px" />
      </div>
      <Skeleton width="100%" height="148px" />
      <Skeleton width="100%" height="96px" />
    </div>
  )
}

export const chapterRange = (chapter: LookBackChapter) =>
  dateRange(chapter.startLocalDate, chapter.endLocalDate)
