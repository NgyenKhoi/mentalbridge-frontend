import { ArrowDown, ArrowUp, Equal } from 'lucide-react'
import type { CSSProperties } from 'react'

import type { Instrument } from '@/features/assessment/api/care-contract'
import { levelLabels } from '@/features/assessment/components/assessment-meanings'

import type { ChapterBand, LookBackJourney } from './look-back-chapters'
import { dateRange, dimensionLabel } from './look-back-copy'
import { levelRank } from './look-back-model'
import styles from './LookBack.module.css'

const INSTRUMENTS: readonly Instrument[] = ['PHQ9', 'GAD7']
const count = (value: number | null) => value ?? '–'

// Neutral on purpose: a higher band is not "worse" or "better" to a screen reader or the eye, just different.
const direction = {
  up: { Icon: ArrowUp, text: 'cao hơn' },
  flat: { Icon: Equal, text: 'giữ nguyên' },
  down: { Icon: ArrowDown, text: 'thấp hơn' },
} as const

function Bands({
  bands,
  before,
  against = 'chặng trước',
}: Readonly<{
  bands: ReadonlyMap<Instrument, ChapterBand>
  /** The column to the left; without it no direction is drawn. */
  before?: ReadonlyMap<Instrument, ChapterBand>
  against?: string
}>) {
  return (
    <dl className={styles.stripBands}>
      {INSTRUMENTS.map((instrument) => {
        const now = bands.get(instrument)
        const earlier = before?.get(instrument)
        const change =
          now && earlier
            ? levelRank(now.level) > levelRank(earlier.level)
              ? direction.up
              : levelRank(now.level) < levelRank(earlier.level)
                ? direction.down
                : direction.flat
            : null
        return (
          <div key={instrument} className={styles.stripBand}>
            <dt className={styles.statLabel}>
              {dimensionLabel[instrument].plain}
            </dt>
            <dd className={styles.stripLevel}>
              {now ? levelLabels[now.level] : 'Chưa có'}
              {change && (
                <>
                  <change.Icon size={14} aria-hidden="true" />
                  <span className="sr-only">
                    , {change.text} so với {against}
                  </span>
                </>
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

const byInstrument = (bands: readonly ChapterBand[]) =>
  new Map(bands.map((band) => [band.instrument, band]))

/** One column per chapter, oldest first, so bands and counts read across; no score and no verdict. */
export function JourneyStrip({
  journey,
}: Readonly<{ journey: LookBackJourney }>) {
  const { baseline, chapters, running } = journey
  const columns = chapters.map((chapter) =>
    byInstrument(chapter.screening.map((s) => s.current)),
  )
  const start = byInstrument(baseline)
  // Stagger by column position (pure, so a StrictMode double render keeps the same delays).
  const offset = baseline.length > 0 ? 1 : 0
  const rise = (column: number) =>
    ({ '--d': `${column * 70}ms` }) as CSSProperties
  return (
    <section
      className={`${styles.block} ${styles.rise}`}
      style={{ '--d': '120ms' } as CSSProperties}
      aria-labelledby="look-back-strip"
    >
      <h2 id="look-back-strip" className={styles.h2}>
        Hành trình của bạn
      </h2>
      <div
        className={styles.stripScroll}
        tabIndex={0}
        role="region"
        aria-label="Các chặng, từ cũ đến mới"
      >
        <ol className={styles.strip}>
          {baseline.length > 0 && (
            <li className={`${styles.stripCol} ${styles.rise}`} style={rise(0)}>
              <div className={styles.stripTitle}>Lúc bắt đầu</div>
              <Bands bands={start} />
            </li>
          )}
          {chapters.map((chapter, position) => (
            <li
              key={chapter.summaryId}
              className={`${styles.stripCol} ${styles.rise}`}
              style={rise(offset + position)}
            >
              <div className={styles.stripTitle}>Chặng {chapter.number}</div>
              <div className={styles.stripDates}>
                {dateRange(chapter.startLocalDate, chapter.endLocalDate)}
              </div>
              <Bands
                bands={columns[position]}
                before={position === 0 ? start : columns[position - 1]}
                against={position === 0 ? 'lúc bắt đầu' : undefined}
              />
              <dl className={styles.stripFacts}>
                <div>
                  <dt>Ngày tốt</dt>
                  <dd>{count(chapter.goodDays)}</dd>
                </div>
                <div>
                  <dt>Việc đã làm</dt>
                  <dd>{count(chapter.support.completed)}</dd>
                </div>
              </dl>
            </li>
          ))}
          {running && (
            <li
              className={`${styles.stripCol} ${styles.rise}`}
              style={rise(offset + chapters.length)}
              data-running="true"
            >
              <div className={styles.stripTitle}>Chặng {running.number}</div>
              <div className={styles.stripDates}>Đang diễn ra</div>
              <div className={styles.note}>Chưa đánh giá lại</div>
              <dl className={styles.stripFacts}>
                <div>
                  <dt>Ngày tốt</dt>
                  <dd>{count(running.goodDays)}</dd>
                </div>
                <div>
                  <dt>Việc đã làm</dt>
                  <dd>{count(running.supportCompleted)}</dd>
                </div>
              </dl>
            </li>
          )}
        </ol>
      </div>
    </section>
  )
}
