import { ChevronDown } from 'lucide-react'
import type { CSSProperties } from 'react'

import { ChapterDetail } from './ChapterDetail'
import type { LookBackChapter } from './look-back-chapters'
import { dateRange } from './look-back-copy'
import styles from './LookBack.module.css'

/** Closed chapters, newest first: the newest is open, the rest fold away until asked for. */
export function ChapterList({
  chapters,
  titles,
  pointer,
}: Readonly<{
  chapters: readonly LookBackChapter[]
  titles: ReadonlyMap<string, string>
  /** Offer the specialist link under the newest chapter. */
  pointer: boolean
}>) {
  return (
    <section
      className={`${styles.chapters} ${styles.rise}`}
      style={{ '--d': '200ms' } as CSSProperties}
      aria-labelledby="look-back-chapters"
    >
      <h2 id="look-back-chapters" className={styles.h2}>
        Các chặng đã qua
      </h2>
      {[...chapters].reverse().map((chapter, index) => (
        <details
          key={chapter.summaryId}
          className={styles.chapterItem}
          open={index === 0}
        >
          <summary>
            <strong className={styles.chapterName}>
              Chặng {chapter.number}
            </strong>
            <span className={styles.chapterDates}>
              {dateRange(chapter.startLocalDate, chapter.endLocalDate)}
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <ChapterDetail
            chapter={chapter}
            titles={titles}
            pointer={pointer && index === 0}
          />
        </details>
      ))}
    </section>
  )
}
