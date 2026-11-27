'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { MamAnswer, MamTargetKind } from '@/features/mam/mam-targets'
import { requestSupportPlanActionCompanionExplanation } from '../api/browser-support-plan'
import { dayLabel } from './TodayPanel'
import type { TodayFocus } from './workspace-model'

export type SupportPlanTab = 'today' | 'plan' | 'progress' | 'adjust'

// Reviewed copy for "Mầm giải thích" on the page: what the tab is for and what
// to do there. Never sent to a model (ADR "Explanation sources in V1").
const TAB_EXPLANATION: Record<SupportPlanTab, string> = {
  today:
    'Tab Hôm nay cho thấy việc nên làm tiếp và những việc còn lại trong ngày. Bạn làm ngay hoặc để hôm khác.',
  plan: 'Tab Kế hoạch liệt kê các việc theo từng mục tiêu và nhịp làm. Mở một việc để xem vì sao nó có trong kế hoạch.',
  progress:
    'Tab Tiến triển tóm tắt số việc bạn đã làm và số ngày ghi cảm xúc, nhật ký trong kỳ này. Dùng nó để nhìn lại nhịp của mình.',
  adjust:
    'Tab Điều chỉnh là nơi xem lại kế hoạch, đổi lịch, tạm dừng hoặc kết thúc. Kế hoạch chỉ đổi khi bạn xác nhận.',
}

export const supportPlanTabAnswer = (tab: SupportPlanTab): MamAnswer => ({
  text: TAB_EXPLANATION[tab],
})

const nextLine = (nextDate?: string) =>
  nextDate ? ` Hoạt động tiếp theo vào ${dayLabel(nextDate)}.` : ''

/**
 * "Nên bắt đầu từ đâu?" from the same `selectTodayFocus` the Today tab renders:
 * no model, no new ranking. The lead appears only when the focus card is on the
 * page as a Mầm target.
 */
export function supportPlanStartAnswer(
  focus: TodayFocus,
  tab: SupportPlanTab,
  isRegistered: (kind: MamTargetKind) => boolean,
  occurrences: 'ready' | 'loading' | 'failed',
): MamAnswer {
  // Without the day's occurrences the focus would claim an empty day.
  if (
    occurrences !== 'ready' &&
    ['OCCURRENCE', 'DONE_FOR_TODAY', 'NOTHING_TODAY'].includes(focus.kind)
  )
    return {
      text:
        occurrences === 'failed'
          ? 'Chưa tải được việc của hôm nay.'
          : 'Việc của hôm nay đang tải. Hỏi lại sau ít giây.',
    }
  switch (focus.kind) {
    case 'OCCURRENCE': {
      const text = `Việc nên làm tiếp: “${focus.action.presentation.title}”.`
      if (isRegistered('support-plan.focus'))
        return {
          text,
          focusKind: 'support-plan.focus',
          focusLabel: 'Đến việc này',
        }
      return { text: tab === 'today' ? text : `${text} Mở tab Hôm nay để làm.` }
    }
    case 'RESUME':
      return {
        text: 'Kế hoạch đang tạm dừng. Bấm “Tiếp tục kế hoạch” ở tab Hôm nay.',
      }
    case 'REVIEW_DUE':
      return {
        text: 'Đã đến lúc xem lại kế hoạch. Bấm “Xem lại kế hoạch” ở tab Hôm nay.',
      }
    case 'DONE_FOR_TODAY':
      return {
        text: `Bạn đã xong việc của hôm nay.${nextLine(focus.nextDate)}`,
      }
    case 'NOTHING_TODAY':
      return {
        text: `Hôm nay không có hoạt động nào.${nextLine(focus.nextDate)}`,
      }
  }
}

export type MamActionExplain = Readonly<{
  /** The action whose Care request is in flight; other cards wait for it. */
  pendingActionId: string | undefined
  explain: (
    supportPlanId: string,
    actionId: string,
    surface: 'TODAY' | 'PLAN',
    signal?: AbortSignal,
  ) => Promise<MamAnswer>
}>

type Flight = {
  key: string
  promise: Promise<MamAnswer>
  controller: AbortController
}

/**
 * The Care `EXPLAIN_ACTION` request behind a card's Mầm button, with the
 * legacy Companion's serialization: one request at a time for the whole page,
 * and asking again for the same action and surface shares it. Any other
 * request meanwhile is refused (Mầm shows its fallback, no second POST). A host
 * abort (timeout, route or tab exit, close) aborts the HTTP request and frees
 * the slot at once. A failure rejects, so Mầm shows its fallback.
 */
export function useMamActionExplain(): MamActionExplain {
  const [pendingActionId, setPendingActionId] = useState<string>()
  const inFlight = useRef<Flight | null>(null)
  // Callers still waiting on it; the HTTP request stops when the last leaves.
  const waiting = useRef(0)

  const release = useCallback((flight: Flight) => {
    flight.controller.abort()
    if (inFlight.current !== flight) return
    inFlight.current = null
    setPendingActionId(undefined)
  }, [])
  useEffect(
    () => () => {
      if (inFlight.current) release(inFlight.current)
    },
    [release],
  )

  const explain = useCallback<MamActionExplain['explain']>(
    (supportPlanId, actionId, surface, signal) => {
      const key = `${actionId}:${surface}`
      if (inFlight.current && inFlight.current.key !== key)
        return Promise.reject(new Error('Another explanation is running'))
      if (signal?.aborted) return Promise.reject(new Error('Aborted'))
      let flight = inFlight.current
      if (!flight) {
        const controller = new AbortController()
        const started: Flight = {
          key,
          controller,
          promise: requestSupportPlanActionCompanionExplanation(
            supportPlanId,
            actionId,
            surface,
            controller.signal,
          )
            .then((response): MamAnswer => ({
              text: response.text,
              // A template answer is shown as is, with no AI note.
              ...(response.delivery === 'GENERATED' ? { generated: true } : {}),
            }))
            .finally(() => {
              if (inFlight.current !== started) return
              inFlight.current = null
              setPendingActionId(undefined)
            }),
        }
        flight = started
        inFlight.current = started
        waiting.current = 0
        setPendingActionId(actionId)
      }
      const joined = flight
      waiting.current += 1
      signal?.addEventListener(
        'abort',
        () => {
          if (inFlight.current !== joined) return
          waiting.current -= 1
          if (waiting.current <= 0) release(joined)
        },
        { once: true },
      )
      return joined.promise
    },
    [release],
  )
  return { pendingActionId, explain }
}
