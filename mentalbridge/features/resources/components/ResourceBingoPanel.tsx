'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { ResourceBingoBoard } from '../api/browser-resource-engagement'
import styles from './plan-resources.module.css'

type Props = Readonly<{
  board: ResourceBingoBoard | null
  state: 'idle' | 'loading' | 'ready' | 'missing' | 'error' | 'stale'
  readOnly?: boolean
  pendingPosition: number | null
  onToggle: (position: number, selfConfirmed: boolean) => void
  onRetry: () => void
  saveError?: { position: number; selfConfirmed: boolean } | null
  onRetrySave?: () => void
}>

export function ResourceBingoPanel({
  board,
  readOnly = false,
  pendingPosition,
  onToggle,
  saveError = null,
  onRetrySave,
}: Props) {
  const reducedMotion = useReducedMotion()
  const retryRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (saveError) retryRef.current?.focus()
  }, [saveError])
  if (!board?.items.length) return null
  return (
    <section className={styles.bingo} aria-labelledby="plan-bingo-title">
      <div className={styles.bingoHeading}>
        <h3 id="plan-bingo-title">Bingo hoạt động trong kế hoạch</h3>
        <div className={styles.week}>
          Tuần{' '}
          {new Intl.DateTimeFormat('vi-VN', {
            day: 'numeric',
            month: 'numeric',
            timeZone: 'UTC',
          }).format(new Date(`${board.weekStart}T00:00:00Z`))}
        </div>
      </div>
      <p className={styles.bingoHint}>
        Bạn có thể tự đánh dấu hoặc bỏ đánh dấu hoạt động đã làm.
      </p>
      <div
        className={styles.bingoGrid}
        role="list"
        aria-label="Hoạt động trong kế hoạch tuần này"
      >
        {board.items.map((item) => {
          const verified = item.evidence === 'CONTENT_VERIFIED'
          const selfConfirmed =
            Boolean(item.selfConfirmedAt) || item.evidence === 'SELF_CONFIRMED'
          const marked = verified || selfConfirmed
          const retired = item.retired
          const pending = pendingPosition === item.position
          const interactive =
            !retired && !readOnly && (!verified || selfConfirmed)
          const content = (
            <>
              <span className={styles.check} aria-hidden="true">
                <AnimatePresence initial={false} mode="wait">
                  {marked ? (
                    <motion.svg
                      key="check"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--rs-moss, #1c4a3c)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      initial={
                        reducedMotion ? false : { opacity: 0, scale: 0.8 }
                      }
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <motion.path
                        d="M5 12l4 4L19 6"
                        initial={reducedMotion ? false : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: reducedMotion ? 0 : 0.22 }}
                      />
                    </motion.svg>
                  ) : (
                    <motion.span
                      key="circle"
                      className={styles.circle}
                      initial={reducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  )}
                </AnimatePresence>
              </span>
              <strong className={styles.tileTitle}>{item.label}</strong>
              {(pending || retired || marked) && (
                <span className={styles.tileStatus}>
                  {pending
                    ? 'Đang lưu…'
                    : retired
                      ? 'Không còn trong kế hoạch'
                      : verified
                        ? 'Đã ghi nhận'
                        : 'Bạn đã đánh dấu'}
                </span>
              )}
            </>
          )
          return (
            <div
              role="listitem"
              key={`${item.position}:${item.resourceId}`}
              className={styles.tileItem}
            >
              <div
                className={`${styles.tile} ${marked ? styles.marked : ''} ${retired ? styles.retired : ''}`}
              >
                {interactive ? (
                  <button
                    className={styles.tileToggle}
                    type="button"
                    aria-pressed={selfConfirmed}
                    aria-label={`Tự đánh dấu ${item.label}`}
                    aria-disabled={pendingPosition !== null}
                    onClick={() => {
                      if (pendingPosition !== null) return
                      onToggle(item.position, !selfConfirmed)
                    }}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={styles.tileContent}>{content}</div>
                )}
              </div>
              {saveError?.position === item.position && (
                <div role="alert" className={styles.saveError}>
                  <div>Chưa lưu được đánh dấu của bạn.</div>
                  <button
                    ref={retryRef}
                    type="button"
                    className={styles.retry}
                    aria-disabled={pendingPosition !== null}
                    onClick={() => {
                      if (pendingPosition !== null) return
                      onRetrySave?.()
                    }}
                  >
                    Thử lại
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
