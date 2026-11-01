import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlanAction } from '../api/support-plan-contract'
import type { TodayFocus } from './workspace-model'

const api = vi.hoisted(() => ({
  requestSupportPlanActionCompanionExplanation: vi.fn(),
}))
vi.mock('../api/browser-support-plan', () => api)

import {
  supportPlanStartAnswer,
  supportPlanTabAnswer,
  useMamActionExplain,
  type SupportPlanTab,
} from './mam-support-plan'

const focusCard = (kind: string) => kind === 'support-plan.focus'
const nowhere = () => false
const occurrence = {
  kind: 'OCCURRENCE',
  action: { presentation: { title: 'Viết vài dòng' } } as PlanAction,
  occurrence: {},
  later: [],
} as unknown as TodayFocus

describe('supportPlanTabAnswer', () => {
  it.each(['today', 'plan', 'progress', 'adjust'] as SupportPlanTab[])(
    'gives the %s tab two sentences at most, named as on screen',
    (tab) => {
      const { text } = supportPlanTabAnswer(tab)
      expect(text.split(/(?<=\.)\s/).length).toBeLessThanOrEqual(2)
      expect(text).toMatch(/Hôm nay|Kế hoạch|Tiến triển|Điều chỉnh/)
    },
  )
})

describe('supportPlanStartAnswer', () => {
  it('names the real focus action and leads to its card when it is on the page', () => {
    expect(
      supportPlanStartAnswer(occurrence, 'today', focusCard, 'ready'),
    ).toEqual({
      text: 'Việc nên làm tiếp: “Viết vài dòng”.',
      focusKind: 'support-plan.focus',
      focusLabel: 'Đến việc này',
    })
  })

  it('sends the user to Today when the focus card is elsewhere', () => {
    expect(
      supportPlanStartAnswer(occurrence, 'plan', nowhere, 'ready'),
    ).toEqual({
      text: 'Việc nên làm tiếp: “Viết vài dòng”. Mở tab Hôm nay để làm.',
    })
    // Already on Today but the action has no Mầm card: just the name.
    expect(
      supportPlanStartAnswer(occurrence, 'today', nowhere, 'ready'),
    ).toEqual({
      text: 'Việc nên làm tiếp: “Viết vài dòng”.',
    })
  })

  it.each([
    [{ kind: 'RESUME' }, /tạm dừng.*Tiếp tục kế hoạch/],
    [{ kind: 'REVIEW_DUE' }, /xem lại kế hoạch.*Xem lại kế hoạch/],
    [{ kind: 'DONE_FOR_TODAY' }, 'Bạn đã xong việc của hôm nay.'],
    [{ kind: 'NOTHING_TODAY' }, 'Hôm nay không có hoạt động nào.'],
  ] as const)('answers %j honestly, with no card to lead to', (focus, text) => {
    const answer = supportPlanStartAnswer(
      focus as TodayFocus,
      'today',
      focusCard,
      'ready',
    )
    expect(answer.focusKind).toBeUndefined()
    if (typeof text === 'string') expect(answer.text).toBe(text)
    else expect(answer.text).toMatch(text)
  })

  it('adds the next day when there is one', () => {
    expect(
      supportPlanStartAnswer(
        { kind: 'NOTHING_TODAY', nextDate: '2026-10-30' },
        'today',
        nowhere,
        'ready',
      ).text,
    ).toMatch(/^Hôm nay không có hoạt động nào\. Hoạt động tiếp theo vào .*30/)
  })

  it.each([
    ['loading', /đang tải/],
    ['failed', /Chưa tải được/],
  ] as const)(
    'does not claim an empty day while the occurrences are %s',
    (load, text) => {
      for (const kind of ['NOTHING_TODAY', 'DONE_FOR_TODAY'] as const)
        expect(
          supportPlanStartAnswer({ kind }, 'today', focusCard, load).text,
        ).toMatch(text)
      expect(
        supportPlanStartAnswer(occurrence, 'today', focusCard, load).focusKind,
      ).toBeUndefined()
      // Paused and review-due do not depend on the day's occurrences.
      expect(
        supportPlanStartAnswer({ kind: 'RESUME' }, 'today', focusCard, load)
          .text,
      ).toMatch(/tạm dừng/)
    },
  )
})

describe('useMamActionExplain', () => {
  beforeEach(() => {
    api.requestSupportPlanActionCompanionExplanation.mockReset()
  })

  it('shares one request per action, blocks others while it runs, then clears', async () => {
    let finish!: (value: unknown) => void
    api.requestSupportPlanActionCompanionExplanation.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { result } = renderHook(() => useMamActionExplain())
    expect(result.current.pendingActionId).toBeUndefined()

    let first!: Promise<unknown>
    let second!: Promise<unknown>
    act(() => {
      first = result.current.explain('plan-1', 'action-1', 'TODAY')
      second = result.current.explain('plan-1', 'action-1', 'TODAY')
    })
    expect(first).toBe(second)
    expect(result.current.pendingActionId).toBe('action-1')
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledTimes(1)

    await act(async () =>
      finish({ text: 'Giải thích.', delivery: 'GENERATED' }),
    )
    await expect(first).resolves.toEqual({
      text: 'Giải thích.',
      generated: true,
    })
    expect(result.current.pendingActionId).toBeUndefined()
  })

  it('refuses any other action or surface while one request is in flight', async () => {
    api.requestSupportPlanActionCompanionExplanation.mockReturnValue(
      new Promise(() => {}),
    )
    const { result } = renderHook(() => useMamActionExplain())
    act(() => {
      void result.current.explain('plan-1', 'action-1', 'TODAY')
    })
    await expect(
      result.current.explain('plan-1', 'action-2', 'PLAN'),
    ).rejects.toThrow()
    await expect(
      result.current.explain('plan-1', 'action-1', 'PLAN'),
    ).rejects.toThrow()
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledTimes(1)
    expect(result.current.pendingActionId).toBe('action-1')
  })

  it('aborts the HTTP request and frees the slot when the last caller aborts', async () => {
    api.requestSupportPlanActionCompanionExplanation.mockImplementation(
      () => new Promise(() => {}),
    )
    const { result } = renderHook(() => useMamActionExplain())
    const first = new AbortController()
    const second = new AbortController()
    act(() => {
      void result.current.explain('plan-1', 'action-1', 'TODAY', first.signal)
      void result.current.explain('plan-1', 'action-1', 'TODAY', second.signal)
    })
    const sent = api.requestSupportPlanActionCompanionExplanation.mock
      .calls[0][3] as AbortSignal
    // One caller leaving keeps the shared request for the other.
    act(() => first.abort())
    expect(sent.aborted).toBe(false)
    expect(result.current.pendingActionId).toBe('action-1')
    act(() => second.abort())
    expect(sent.aborted).toBe(true)
    expect(result.current.pendingActionId).toBeUndefined()

    // The next request starts at once and is not blocked by the aborted one.
    act(() => {
      void result.current.explain('plan-1', 'action-2', 'PLAN')
    })
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledTimes(2)
  })

  it('refuses an already aborted caller and aborts the request on unmount', async () => {
    api.requestSupportPlanActionCompanionExplanation.mockImplementation(
      () => new Promise(() => {}),
    )
    const { result, unmount } = renderHook(() => useMamActionExplain())
    const gone = new AbortController()
    gone.abort()
    await expect(
      result.current.explain('plan-1', 'action-1', 'TODAY', gone.signal),
    ).rejects.toThrow()
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).not.toHaveBeenCalled()

    act(() => {
      void result.current.explain('plan-1', 'action-1', 'TODAY')
    })
    const sent = api.requestSupportPlanActionCompanionExplanation.mock
      .calls[0][3] as AbortSignal
    unmount()
    expect(sent.aborted).toBe(true)
  })

  it('clears after a failure so the next press asks again', async () => {
    api.requestSupportPlanActionCompanionExplanation
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ text: 'Mẫu.', delivery: 'TEMPLATE' })
    const { result } = renderHook(() => useMamActionExplain())
    await act(async () => {
      await expect(
        result.current.explain('plan-1', 'action-1', 'PLAN'),
      ).rejects.toThrow('offline')
    })
    expect(result.current.pendingActionId).toBeUndefined()
    await act(async () => {
      await expect(
        result.current.explain('plan-1', 'action-1', 'PLAN'),
      ).resolves.toEqual({ text: 'Mẫu.' })
    })
    expect(
      api.requestSupportPlanActionCompanionExplanation,
    ).toHaveBeenCalledTimes(2)
  })
})
