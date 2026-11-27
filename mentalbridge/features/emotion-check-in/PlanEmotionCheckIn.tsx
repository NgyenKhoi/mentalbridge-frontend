'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import { localDateInTimeZone } from '@/lib/emotion-check-in/presentation'
import {
  emotionPlanHref,
  parseEmotionPlanOrigin,
  resolveEmotionPlanOrigin,
  type ResolvedEmotionPlanOrigin,
} from '@/features/support-plan/emotion-plan-origin'
import { DailyEmotionCheckIn } from './DailyEmotionCheckIn'
import styles from './DailyEmotionCheckIn.module.css'

type Context =
  | { state: 'normal' | 'loading' | 'invalid' | 'error' }
  | { state: 'ready'; value: ResolvedEmotionPlanOrigin }

export function PlanEmotionCheckIn({
  onPersisted,
}: Readonly<{ onPersisted?: () => void }>) {
  const search = useSearchParams()
  const params = new URLSearchParams()
  for (const key of ['occurrenceId', 'actionId', 'localDate'])
    search.getAll(key).forEach((value) => params.append(key, value))
  const query = params.toString()
  return (
    <PlanEmotionContent key={query} query={query} onPersisted={onPersisted} />
  )
}

function PlanEmotionContent({
  query,
  onPersisted,
}: Readonly<{ query: string; onPersisted?: () => void }>) {
  const [context, setContext] = useState<Context>(() => ({
    state: query ? 'loading' : 'normal',
  }))
  const [attempt, setAttempt] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    let active = true
    const params = new URLSearchParams(query)
    const requested = ['occurrenceId', 'actionId', 'localDate'].some((key) =>
      params.has(key),
    )
    if (!requested) {
      return () => {
        active = false
      }
    }
    const origin = parseEmotionPlanOrigin(params)
    if (!origin) {
      queueMicrotask(() => {
        if (active) setContext({ state: 'invalid' })
      })
      return () => {
        active = false
      }
    }
    void resolveEmotionPlanOrigin(origin)
      .then((value) => {
        if (active) setContext({ state: 'ready', value })
      })
      .catch((error: unknown) => {
        if (active)
          setContext({
            state:
              (error instanceof Error &&
                error.message === 'EMOTION_PLAN_ORIGIN_UNAVAILABLE') ||
              (error instanceof ApiError &&
                (error.status === 404 || error.status === 409))
                ? 'invalid'
                : 'error',
          })
      })
    return () => {
      active = false
    }
  }, [attempt, query])
  useEffect(() => {
    if (context.state !== 'ready') return
    heading.current?.focus({ preventScroll: true })
    document
      .getElementById('emotion-check-in')
      ?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [context])

  if (context.state === 'normal')
    return <DailyEmotionCheckIn onPersisted={onPersisted} />
  if (context.state === 'loading')
    return (
      <div id="emotion-check-in" className={styles.card} aria-busy="true">
        <h2 className={styles.title}>Cảm xúc hôm nay</h2>
        <p role="status">Đang tải hoạt động bạn vừa chọn…</p>
      </div>
    )
  if (context.state !== 'ready')
    return (
      <div id="emotion-check-in" className={styles.card}>
        <h2 className={styles.title}>Cảm xúc hôm nay</h2>
        <p role="alert">
          {context.state === 'error'
            ? 'Chưa tải được hoạt động. Kế hoạch và cảm xúc đã lưu không thay đổi; hãy thử lại.'
            : 'Không tìm thấy hoạt động còn phù hợp với đường dẫn này. Hãy mở lại từ kế hoạch hiện tại.'}
        </p>
        {context.state === 'error' && (
          <button
            className={styles.saveBtn}
            type="button"
            onClick={() => {
              setContext({ state: 'loading' })
              setAttempt((value) => value + 1)
            }}
          >
            Thử tải lại hoạt động
          </button>
        )}
        <Link className={styles.planReturn} href="/support-plan">
          Về kế hoạch hiện tại
        </Link>
      </div>
    )
  const value = context.value
  if (value.localDate !== localDateInTimeZone(new Date(), value.timezone))
    return (
      <div id="emotion-check-in" className={styles.card}>
        <h2 ref={heading} tabIndex={-1} className={styles.title}>
          Cảm xúc hôm nay
        </h2>
        <p>
          Hoạt động bạn chọn thuộc ngày {value.localDate}. Ở đây chỉ có thể ghi
          nhận cảm xúc của hôm nay; ghi nhận mới không được dùng thay cho ngày
          khác.
        </p>
        <Link
          className={styles.planReturn}
          href={emotionPlanHref(value, '/support-plan')}
        >
          Quay lại hoạt động để kiểm tra ghi nhận đã có
        </Link>
      </div>
    )
  return (
    <DailyEmotionCheckIn
      creationTimezone={value.timezone}
      planOrigin={value}
      onPersisted={onPersisted}
    />
  )
}
