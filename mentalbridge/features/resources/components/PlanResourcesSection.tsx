'use client'

import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import { usePlanAccess } from '@/features/support-plan-access/use-plan-access'
import { getCurrentPlanResourceActions } from '@/features/support-plan/api/browser-support-plan-actions'
import type { PlanResourceActionsV1 } from '@/features/support-plan/api/support-plan-contract'
import { localDateIn } from '@/features/support-plan/workspace/workspace-model'
import {
  syncResourceBingoWithPlan,
  setResourceBingoSelfConfirmation,
  type ResourceBingoBoard,
  type ResourceBingoPlanSync,
} from '../api/browser-resource-engagement'
import { localDate } from '../model/resource-experience'
import {
  localWeekStart,
  planResourceHref,
  planResourceSchedule,
  planResourceStatus,
} from '../model/plan-resources'
import { ResourceBingoPanel } from './ResourceBingoPanel'
import styles from './plan-resources.module.css'

type Loaded = {
  plan: PlanResourceActionsV1
  board: ResourceBingoBoard | null
  etag: string
  unavailableActions: ResourceBingoPlanSync['unavailableActions']
}
type State = 'loading' | 'ready' | 'error' | 'stale'

export function PlanResourcesSection({
  onPlanChange,
}: {
  onPlanChange?: (plan: PlanResourceActionsV1 | null) => void
}) {
  const { access, retry: retryAccess } = usePlanAccess()
  const reducedMotion = useReducedMotion()
  const [state, setState] = useState<State>('loading')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [pendingPosition, setPendingPosition] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<{
    position: number
    selfConfirmed: boolean
  } | null>(null)
  const request = useRef(0)
  const mutationPending = useRef(false)
  const invalidateRequest = useCallback(() => {
    request.current++
  }, [])

  const load = useCallback(async () => {
    if (access.status !== 'paid') return
    const serial = ++request.current
    setState('loading')
    setSaveError(null)
    try {
      const browserDate = localDate()
      let plan = await getCurrentPlanResourceActions(browserDate)
      if (plan.planState !== 'NONE' && plan.timeZone) {
        const planDate = localDateIn(plan.timeZone)
        if (planDate !== plan.localDate)
          plan = await getCurrentPlanResourceActions(planDate)
      }
      // NONE still syncs: Content retires the previous board without exposing it.
      const timeZone =
        plan.planState === 'NONE'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : (plan.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
      const result = await syncResourceBingoWithPlan(
        localWeekStart(
          plan.planState === 'NONE' ? browserDate : plan.localDate,
        ),
        timeZone,
      )
      if (serial !== request.current) return
      setLoaded({
        plan,
        board: plan.planState === 'NONE' ? null : result.board,
        etag: result.etag,
        unavailableActions: result.board.unavailableActions,
      })
      setState('ready')
    } catch (error) {
      if (serial !== request.current) return
      setLoaded(null)
      setState(
        error instanceof ApiError && error.status === 412 ? 'stale' : 'error',
      )
    }
  }, [access.status])

  useEffect(() => {
    void Promise.resolve().then(load)
    return invalidateRequest
  }, [load, invalidateRequest])

  useEffect(() => {
    onPlanChange?.(
      access.status === 'paid' &&
        state === 'ready' &&
        loaded?.plan.planState !== 'NONE'
        ? (loaded?.plan ?? null)
        : null,
    )
  }, [access.status, state, loaded?.plan, onPlanChange])

  async function toggle(position: number, selfConfirmed: boolean) {
    if (
      !loaded?.board ||
      loaded.plan.planState !== 'ACTIVE' ||
      mutationPending.current
    )
      return
    mutationPending.current = true
    setPendingPosition(position)
    try {
      const result = await setResourceBingoSelfConfirmation(
        loaded.board.weekStart,
        position,
        selfConfirmed,
        loaded.etag,
      )
      setLoaded({ ...loaded, board: result.board, etag: result.etag })
      setSaveError(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 412) {
        setLoaded(null)
        setState('stale')
      } else {
        setSaveError({ position, selfConfirmed })
      }
    } finally {
      mutationPending.current = false
      setPendingPosition(null)
    }
  }

  const loading =
    access.status === 'loading' ||
    (access.status === 'paid' && state === 'loading')
  const plan = loaded?.plan
  const paused = plan?.planState === 'PAUSED'
  const actions = plan?.actions ?? []
  const unavailable = new Set(
    loaded?.unavailableActions
      ?.filter((item) => item.reason !== 'BOARD_FULL')
      .map((item) => item.actionId),
  )
  let message = ''
  let linkLabel = ''
  let showRetry = false
  if (access.status === 'free' || access.status === 'expired') {
    message = 'Kế hoạch hỗ trợ chưa được mở với tài khoản của bạn.'
    linkLabel = 'Tìm hiểu'
  } else if (access.status === 'unavailable') {
    message = 'Chưa kiểm tra được kế hoạch của bạn lúc này.'
    showRetry = true
  } else if (!loading && state === 'stale') {
    message = 'Kế hoạch vừa thay đổi.'
    showRetry = true
  } else if (!loading && state === 'error') {
    message = 'Chưa tải được kế hoạch của bạn. Danh mục bên dưới vẫn dùng được.'
    showRetry = true
  } else if (plan?.planState === 'NONE') {
    message = 'Bạn chưa có kế hoạch hỗ trợ.'
    linkLabel = 'Tạo kế hoạch'
  } else if (!loading && plan && actions.length === 0) {
    message = 'Kế hoạch hiện tại chưa có tài nguyên nào.'
    linkLabel = 'Xem trong kế hoạch'
  }

  function cards(start: number, end?: number) {
    return actions.slice(start, end).map((action, index) => (
      <motion.article
        layout="position"
        className={`${styles.resource} ${paused ? styles.muted : ''}`}
        key={action.actionId}
        style={{ animationDelay: `${Math.min(index, 5) * 40}ms` }}
      >
        <h3 id={`plan-resource-${action.actionId}`}>{action.title}</h3>
        <div className={styles.schedule}>{planResourceSchedule(action)}</div>
        {unavailable.has(action.actionId) ? (
          <div className={styles.unavailable}>
            Tài nguyên này hiện không còn khả dụng.
          </div>
        ) : (
          <>
            <div
              className={`${styles.status} ${action.today?.displayState === 'COMPLETED' ? styles.done : ''}`}
            >
              {planResourceStatus(action)}
            </div>
            <Link
              className={styles.open}
              href={planResourceHref(action, plan!.localDate)}
              aria-describedby={`plan-resource-${action.actionId}`}
            >
              Mở tài nguyên
            </Link>
          </>
        )}
        <Link
          className={styles.quiet}
          href="/support-plan"
          aria-describedby={`plan-resource-${action.actionId}`}
        >
          Xem trong kế hoạch
        </Link>
      </motion.article>
    ))
  }

  return (
    <section
      className={styles.section}
      id="plan-resources"
      aria-labelledby="plan-resources-title"
      data-testid="plan-resources-section"
      aria-busy={loading}
    >
      <div className={styles.heading}>
        <div>
          <h2 id="plan-resources-title">Trong kế hoạch của tôi</h2>
          <p>Tài nguyên kế hoạch hỗ trợ của bạn đã chọn.</p>
        </div>
      </div>
      <div
        className={styles.visuallyHidden}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {loading
          ? 'Đang tải…'
          : pendingPosition !== null
            ? 'Đang lưu đánh dấu…'
            : message ||
              (paused
                ? 'Kế hoạch đang tạm dừng. Bạn vẫn mở được tài nguyên; tiến độ tiếp tục khi kế hoạch hoạt động lại.'
                : saveError
                  ? ''
                  : 'Đã tải tài nguyên kế hoạch.')}
      </div>
      {loading ? (
        <div className={styles.grid} aria-label="Đang tải tài nguyên kế hoạch">
          {[0, 1].map((index) => (
            <div
              className={`${styles.resource} ${styles.skeleton}`}
              key={index}
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
              <i />
            </div>
          ))}
        </div>
      ) : message ? (
        <div className={styles.notice}>
          <div>{message}</div>
          {linkLabel && (
            <Link className={styles.quiet} href="/support-plan">
              {linkLabel} <span aria-hidden="true">→</span>
            </Link>
          )}
          {showRetry && (
            <button
              className={styles.retry}
              onClick={() => {
                if (access.status === 'unavailable') void retryAccess()
                else void load()
              }}
            >
              {state === 'stale' ? 'Tải lại' : 'Thử lại'}
            </button>
          )}
        </div>
      ) : plan ? (
        <>
          {paused && (
            <div className={styles.notice}>
              Kế hoạch đang tạm dừng. Bạn vẫn mở được tài nguyên; tiến độ tiếp
              tục khi kế hoạch hoạt động lại.
            </div>
          )}
          <motion.div layout="position" className={styles.grid}>
            {cards(0, 3)}
          </motion.div>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                className={`${styles.grid} ${styles.extra}`}
                id="plan-resources-extra"
                key="extra"
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { delay: 0 } }}
                transition={{
                  duration: reducedMotion ? 0 : 0.22,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {cards(3)}
              </motion.div>
            )}
          </AnimatePresence>
          {actions.length > 3 && (
            <button
              className={styles.disclosure}
              aria-expanded={expanded}
              aria-controls="plan-resources-extra"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Thu gọn' : `Xem tất cả (${actions.length})`}{' '}
              <span aria-hidden="true">{expanded ? '↑' : '↓'}</span>
            </button>
          )}
          {!!loaded?.board?.items.length && (
            <ResourceBingoPanel
              board={loaded.board}
              state="ready"
              readOnly={paused}
              pendingPosition={pendingPosition}
              saveError={saveError}
              onRetrySave={() => {
                if (saveError)
                  void toggle(saveError.position, saveError.selfConfirmed)
              }}
              onToggle={(position, value) => void toggle(position, value)}
              onRetry={() => void load()}
            />
          )}
        </>
      ) : null}
    </section>
  )
}
