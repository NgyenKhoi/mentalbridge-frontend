'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import {
  getCurrentSupportPlanActions,
  getSupportPlanActionOccurrences,
} from '../api/browser-support-plan-actions'
import type { ActionOccurrence } from '../api/support-plan-contract'

type Activity = Readonly<{
  id: string
  title: string
  state: ActionOccurrence['displayState']
}>

function localToday(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

function stateLabel(state: Activity['state']) {
  return {
    SCHEDULED: 'Chưa ghi nhận',
    OVERDUE: 'Có thể thực hiện khi phù hợp',
    COMPLETED: 'Đã ghi nhận',
    SKIPPED: 'Đã bỏ qua',
    CANCELLED: 'Đã hủy',
  }[state]
}

export default function TodayPlanReminder() {
  const [state, setState] = useState<
    'loading' | 'ready' | 'empty' | 'locked' | 'error'
  >('loading')
  const [activities, setActivities] = useState<Activity[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    getCurrentSupportPlanActions()
      .then(async (plan) => {
        const timezone =
          plan.focuses
            .flatMap((focus) => focus.actions)
            .flatMap((action) => action.schedules)
            .find((schedule) => schedule.status !== 'ENDED')?.timezone ??
          Intl.DateTimeFormat().resolvedOptions().timeZone ??
          'Asia/Ho_Chi_Minh'
        const today = localToday(timezone)
        const result = await getSupportPlanActionOccurrences(today, today)
        if (!active) return
        if (result.supportPlanId !== plan.supportPlanId)
          throw new Error('Plan changed')
        const actions = plan.focuses.flatMap((focus) => focus.actions)
        const rows = result.occurrences
          .filter((item) => item.state !== 'CANCELLED')
          .map((item) => {
            const action = actions.find(
              (candidate) => candidate.actionId === item.actionId,
            )
            if (!action) throw new Error('Action changed')
            return {
              id: item.occurrenceId,
              title: action.presentation.title,
              state: item.displayState,
            }
          })
        setActivities(rows)
        setState('ready')
      })
      .catch((error: unknown) => {
        if (!active) return
        setActivities([])
        setState(
          error instanceof ApiError && error.status === 404
            ? 'empty'
            : error instanceof ApiError &&
                error.code === 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED'
              ? 'locked'
              : 'error',
        )
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const completed = activities.filter(
    (item) => item.state === 'COMPLETED',
  ).length

  return (
    <article className="ref-card ref-tasks" aria-labelledby="today-plan-title">
      <header>
        <h2 id="today-plan-title">Hoạt động trong kế hoạch hôm nay</h2>
        {state === 'ready' && (
          <b>
            {completed}/{activities.length}
          </b>
        )}
      </header>
      {state === 'loading' && <p role="status">Đang tải hoạt động…</p>}
      {state === 'empty' && (
        <p>
          Bạn chưa có kế hoạch đang hoạt động.{' '}
          <Link href="/support-plan">Xem kế hoạch hỗ trợ</Link>
        </p>
      )}
      {state === 'locked' && (
        <p>
          Kế hoạch hỗ trợ chưa có trong gói hiện tại.{' '}
          <Link href="/subscription">Xem quyền lợi các gói</Link>
        </p>
      )}
      {state === 'error' && (
        <p role="alert">
          Chưa tải được hoạt động đã lưu.
          <button
            type="button"
            onClick={() => {
              setState('loading')
              setReloadKey((value) => value + 1)
            }}
          >
            Thử lại
          </button>
        </p>
      )}
      {state === 'ready' && activities.length === 0 && (
        <p>
          Hôm nay chưa có hoạt động được xếp lịch.{' '}
          <Link href="/support-plan">Xem kế hoạch</Link>
        </p>
      )}
      {state === 'ready' &&
        activities.map((activity) => (
          <Link
            key={activity.id}
            href="/support-plan"
            className={activity.state === 'COMPLETED' ? 'done' : ''}
            aria-label={`${activity.title}: ${stateLabel(activity.state)}. Mở kế hoạch hỗ trợ`}
          >
            <i aria-hidden="true">
              {activity.state === 'COMPLETED' ? '✓' : ''}
            </i>
            <span>
              {activity.title}
              <small>{stateLabel(activity.state)}</small>
            </span>
          </Link>
        ))}
      {state === 'ready' && activities.length > 0 && (
        <p className="ref-tasks-note">
          Mở kế hoạch để ghi nhận hoạt động. Bỏ qua một ngày không có nghĩa là
          điều trị thất bại.
        </p>
      )}
    </article>
  )
}
