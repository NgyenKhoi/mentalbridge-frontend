'use client'

import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import styles from './resource-detail.module.css'

export type ReconcileState =
  'idle' | 'pending' | 'recorded' | 'done' | 'missing' | 'unavailable' | 'stale'

const messages: Record<Exclude<ReconcileState, 'idle'>, string> = {
  pending: 'Đã lưu bài luyện tập. Đang cập nhật kế hoạch…',
  recorded: 'Đã ghi nhận vào kế hoạch hôm nay.',
  done: 'Hoạt động này không cần xác nhận thêm trong kế hoạch.',
  missing: 'Đã lưu bài luyện tập. Bạn có thể xác nhận trong kế hoạch.',
  unavailable: 'Đã lưu bài luyện tập. Kế hoạch sẽ cập nhật khi kết nối lại.',
  stale: 'Kế hoạch vừa thay đổi.',
}

export function ResourcePlanNotice({
  state,
  returnHref,
  onRetry,
}: Readonly<{
  state: ReconcileState
  returnHref: string
  onRetry: () => void
}>) {
  const reducedMotion = useReducedMotion()
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={state === 'pending'}
    >
      <AnimatePresence initial={false} mode="wait">
        {state !== 'idle' && (
          <motion.div
            key={state}
            className={styles.planNotice}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.22,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {state === 'recorded' && (
              <svg
                className={styles.planNoticeCheck}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12l4 4L19 6" pathLength="1" />
              </svg>
            )}
            <div>{messages[state]}</div>
            {state === 'unavailable' || state === 'stale' ? (
              <button type="button" onClick={onRetry}>
                {state === 'stale' ? 'Tải lại' : 'Thử lại'}
              </button>
            ) : state !== 'pending' ? (
              <Link href={returnHref}>
                {state === 'recorded'
                  ? 'Quay lại kế hoạch'
                  : 'Xem trong kế hoạch'}
              </Link>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
