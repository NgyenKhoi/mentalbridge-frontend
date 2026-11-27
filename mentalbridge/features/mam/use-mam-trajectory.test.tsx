import { act, renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getHomeNextStep } from '@/features/home/browser-home-next-step'
import { mockServer } from '@/tests/mocks/server'
import { getMamTrajectory } from './browser-mam-trajectory'
import { resetCompanionStateForTests } from './companion-state'
import type { MamBandStatus, MamTrajectoryView } from './mam-trajectory-source'
import { mamDailyKey, readMamDaily, resetMamDailyMemory } from './mam-daily'
import { MAM_LINES, resetMamLines } from './mam-lines'
import { mamEventName, type MamEvent } from './mam-events'
import { useMamTrajectory } from './use-mam-trajectory'

vi.mock('./browser-mam-trajectory', () => ({
  getMamTrajectory: vi.fn(),
}))
vi.mock('@/features/home/browser-home-next-step', () => ({
  getHomeNextStep: vi.fn().mockRejectedValue(new Error('no home')),
}))
const lookBack = vi.mocked(getMamTrajectory)

const TODAY = '2026-11-20'
const ACCOUNT = 'acct-1'
const shift = (days: number) =>
  new Date(Date.parse(`${TODAY}T00:00:00.000Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10)

// Levels oldest to newest, the last on today.
function view(
  levels: (number | null)[],
  over: Partial<Omit<MamTrajectoryView, 'band'>> & {
    band?: Partial<MamBandStatus>
  } = {},
): MamTrajectoryView {
  const { band, ...rest } = over
  return {
    asOfLocalDate: TODAY,
    days: levels.map((emotionLevel, index) => ({
      localDate: shift(index - (levels.length - 1)),
      emotionLevel,
    })),
    narrative: 'STEADY',
    partial: false,
    ...rest,
    band: { readable: true, moderatePlus: false, transition: null, ...band },
  }
}

type Props = {
  accountId: string | null
  mode: 'full' | 'quiet' | 'hidden'
  hard: boolean
  ready: boolean
}
const FULL: Props = {
  accountId: ACCOUNT,
  mode: 'full',
  hard: false,
  ready: true,
}

const mount = (props: Partial<Props> = {}) =>
  renderHook((current: Props) => useMamTrajectory(current), {
    initialProps: { ...FULL, ...props },
  })

const flush = () => act(async () => {})
const fire = (
  event: Omit<MamEvent, never> & Record<string, unknown>,
  over: Record<string, unknown> = {},
) =>
  act(() => {
    window.dispatchEvent(
      new CustomEvent(mamEventName(event.type as MamEvent['type']), {
        detail: { accountId: ACCOUNT, localDate: TODAY, ...event, ...over },
      }),
    )
  })

describe('useMamTrajectory', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${TODAY}T09:00:00`))
    window.localStorage.clear()
    resetMamDailyMemory()
    resetMamLines()
    lookBack.mockReset()
    lookBack.mockResolvedValue(view([4, 4, 4, 4]))
  })
  afterEach(() => vi.useRealTimers())

  describe('the daily decision table (mam-v3)', () => {
    const serveState = (state: { focus?: unknown; commitments?: unknown[] }) =>
      mockServer.use(
        http.get('/api/companion-state', () =>
          HttpResponse.json({
            focus: null,
            chapters: [],
            commitments: [],
            ui: { guide: null, seen: [] },
            revision: 1,
            ...state,
          }),
        ),
      )
    const open = (patch: object = {}) => ({
      id: '30000000-0000-4000-8000-000000000001',
      kind: 'REST',
      minutes: 5,
      dueOn: shift(-1),
      source: 'HOME',
      status: 'OPEN',
      createdAt: '2026-11-19T08:00:00.000Z',
      resolvedAt: null,
      ...patch,
    })
    const home = (patch: object = {}) =>
      ({
        journey: { stage: 'GUIDE_READY', nextAction: 'OPEN_GUIDE' },
        plan: null,
        ...patch,
      }) as never
    beforeEach(() => {
      resetCompanionStateForTests()
      vi.mocked(getHomeNextStep).mockReset()
      vi.mocked(getHomeNextStep).mockResolvedValue(home())
    })
    afterEach(() =>
      vi.mocked(getHomeNextStep).mockRejectedValue(new Error('no home')),
    )

    it('a failed Home read counts as safety: no lời hẹn, review or focus line speaks', async () => {
      serveState({ commitments: [open()] })
      vi.mocked(getHomeNextStep).mockRejectedValue(new Error('no home'))
      const { result } = mount()
      await flush()
      expect(result.current.reaction?.text ?? '').not.toMatch(/hẹn|14 ngày/)
    })

    it('records the focus invite as asked only when the bubble is really shown', async () => {
      serveState({})
      const askKey = mamDailyKey('focus-ask', ACCOUNT)
      const waiting = mount({ ready: false })
      await flush()
      expect(waiting.result.current.reaction).toBeNull()
      expect(readMamDaily(askKey)).toBeNull()
      waiting.rerender({ ...FULL, ready: true })
      await flush()
      expect(waiting.result.current.reaction?.text).toMatch(/^14 ngày tới/)
      expect(readMamDaily(askKey)).toBe(TODAY)
    })

    it('asks about yesterday lời hẹn instead of cheering a good week', async () => {
      serveState({ commitments: [open()] })
      const { result } = mount()
      await flush()
      expect(result.current.reaction).toMatchObject({ intent: 'LISTEN' })
      expect(result.current.reaction?.text).toBe(
        'Hôm qua mình có hẹn nghỉ ngơi hoặc ngủ sớm hơn nè. Ghé thẻ Hôm nay kể Mầm nghe nhé.',
      )
    })

    it('still comforts first when the day is low, whatever is promised', async () => {
      lookBack.mockResolvedValue(view([4, 5, 4, 2]))
      serveState({ commitments: [open()] })
      const { result } = mount()
      await flush()
      expect(result.current.reaction).toMatchObject({ intent: 'COMFORT' })
    })

    it('points to the look-back when Care says the review is due', async () => {
      serveState({})
      vi.mocked(getHomeNextStep).mockResolvedValue(
        home({ plan: { focus: 'REVIEW_DUE' } }),
      )
      const { result } = mount()
      await flush()
      expect(result.current.reaction?.text).toBe(
        'Tròn 14 ngày rồi nè. Mình cùng nhìn lại nhé?',
      )
    })

    it('invites the focus pick after a screening, and not again within 3 days', async () => {
      serveState({})
      vi.mocked(getHomeNextStep).mockResolvedValue(home())
      const first = mount()
      await flush()
      expect(first.result.current.reaction?.text).toBe(
        '14 ngày tới bạn muốn điều gì nhẹ đi? Chọn ở thẻ Hôm nay nhé.',
      )
      first.unmount()

      // The next day it is 1 day since the invite: Mầm keeps quiet instead of nagging.
      vi.setSystemTime(new Date('2026-11-21T09:00:00'))
      lookBack.mockResolvedValue(
        view([4, null, null, null, null], { asOfLocalDate: '2026-11-21' }),
      )
      const second = mount()
      await flush()
      expect(second.result.current.reaction).toBeNull()
    })

    it('stays silent with the focus chosen, no screening, or a safety Home', async () => {
      lookBack.mockResolvedValue(view([4, null, null]))
      serveState({ focus: { goal: 'SLEEP', chosenOn: shift(-2) } })
      vi.mocked(getHomeNextStep).mockResolvedValue(home())
      const chosen = mount()
      await flush()
      expect(chosen.result.current.reaction).toBeNull()
      chosen.unmount()

      window.localStorage.clear()
      resetMamDailyMemory()
      resetCompanionStateForTests()
      serveState({ commitments: [open()] })
      vi.mocked(getHomeNextStep).mockResolvedValue(
        home({
          journey: {
            stage: 'GUIDE_READY',
            nextAction: 'REVIEW_SAFETY_SUPPORT',
          },
        }),
      )
      const safety = mount()
      await flush()
      expect(safety.result.current.reaction).toBeNull()
    })

    it('speaks once on a steady-good day, but comfort keeps its full allowance', async () => {
      vi.useRealTimers()
      vi.useFakeTimers()
      vi.setSystemTime(new Date(`${TODAY}T09:00:00`))
      serveState({ focus: { goal: 'SLEEP', chosenOn: shift(-2) } })
      const { result } = mount()
      await flush()
      expect(result.current.reaction).toMatchObject({ intent: 'HAPPY' })
      act(() => result.current.dismiss())

      // 61 s later: an ordinary reaction is past the one-a-day cap and is dropped...
      vi.setSystemTime(new Date(`${TODAY}T09:01:01`))
      fire({ type: 'resource-done' })
      await flush()
      expect(result.current.reaction).toBeNull()

      // ...a low journal mood still gets its comfort.
      vi.setSystemTime(new Date(`${TODAY}T09:03:00`))
      fire({ type: 'journal-saved' }, { mood: 'LOW' })
      await flush()
      expect(result.current.reaction).toMatchObject({ intent: 'COMFORT' })
    })
  })

  describe('the daily moment', () => {
    it('answers the first FULL visit of the day once, with a line of its state and the intent', async () => {
      lookBack.mockResolvedValue(view([4, 5, 4, 2]))
      const { result } = mount()
      await flush()
      expect(lookBack).toHaveBeenCalledTimes(1)
      expect(result.current.reaction).toMatchObject({ intent: 'COMFORT' })
      expect(MAM_LINES.DIP_AFTER_GOOD).toContain(result.current.reaction?.text)
      act(() => result.current.dismiss())
      expect(result.current.reaction).toBeNull()
    })

    it('reads the new day without a remount when a tab stays on FULL routes across midnight', async () => {
      lookBack.mockResolvedValue(view([4, 4, 4, 4]))
      const { result, rerender } = mount()
      await flush()
      act(() => result.current.dismiss())
      expect(lookBack).toHaveBeenCalledTimes(1)
      vi.setSystemTime(new Date('2026-11-21T00:05:00'))
      lookBack.mockResolvedValue(
        view([4, 4, 4, 4, 2], { asOfLocalDate: '2026-11-21' }),
      )
      rerender({ ...FULL })
      await flush()
      expect(lookBack).toHaveBeenCalledTimes(2)
    })

    it('does not read again the same day: another mount, another visit', async () => {
      lookBack.mockResolvedValue(view([4, 4, 4, 4]))
      const first = mount()
      await flush()
      expect(first.result.current.reaction).toMatchObject({ intent: 'HAPPY' })
      first.unmount()
      const second = mount()
      await flush()
      expect(lookBack).toHaveBeenCalledTimes(1)
      expect(second.result.current.reaction).toBeNull()
    })

    it('reads again on the next local day', async () => {
      const first = mount()
      await flush()
      first.unmount()
      vi.setSystemTime(new Date('2026-11-21T09:00:00'))
      lookBack.mockResolvedValue(
        view([4, 4, 4, 4], { asOfLocalDate: '2026-11-21' }),
      )
      mount()
      await flush()
      expect(lookBack).toHaveBeenCalledTimes(2)
    })

    it('stays quiet and waits on a QUIET route, and reads on the first FULL one', async () => {
      const { result, rerender } = mount({ mode: 'quiet' })
      await flush()
      expect(lookBack).not.toHaveBeenCalled()
      expect(result.current.reaction).toBeNull()
      rerender({ ...FULL })
      await flush()
      expect(lookBack).toHaveBeenCalledTimes(1)
      expect(result.current.reaction).not.toBeNull()
    })

    it('never reads while hidden, away, in a safety zone or muted (hard)', async () => {
      const { result } = mount({ hard: true })
      await flush()
      expect(lookBack).not.toHaveBeenCalled()
      expect(result.current.reaction).toBeNull()
    })

    it('waits for the host to be ready, then shows', async () => {
      const { result, rerender } = mount({ ready: false })
      await flush()
      expect(lookBack).toHaveBeenCalledTimes(1)
      expect(result.current.reaction).toBeNull()
      rerender({ ...FULL })
      await flush()
      expect(result.current.reaction).not.toBeNull()
    })

    it('a failed read shows nothing and is not retried in this page load', async () => {
      lookBack.mockRejectedValue(new Error('down'))
      const { result, rerender } = mount()
      await flush()
      rerender({ ...FULL, mode: 'quiet' })
      rerender({ ...FULL })
      await flush()
      expect(lookBack).toHaveBeenCalledTimes(1)
      expect(result.current.reaction).toBeNull()
    })

    it('a read cut short by leaving the FULL route is tried again on the next one', async () => {
      let release: (value: MamTrajectoryView) => void = () => {}
      lookBack.mockImplementationOnce(
        () => new Promise<MamTrajectoryView>((resolve) => (release = resolve)),
      )
      const { result, rerender } = mount()
      rerender({ ...FULL, mode: 'quiet' })
      await act(async () => release(view([4, 5, 4, 2])))
      expect(result.current.reaction).toBeNull()
      lookBack.mockResolvedValue(view([4, 5, 4, 2]))
      rerender({ ...FULL })
      await flush()
      expect(lookBack).toHaveBeenCalledTimes(2)
      expect(result.current.reaction).toMatchObject({ intent: 'COMFORT' })
    })

    it('does not cheer on a harder look-back, a moderate-or-higher band or an unreadable mood', async () => {
      for (const over of [
        { narrative: 'HARDER' },
        { band: { moderatePlus: true } },
        { band: { readable: false } },
        { partial: true },
        { narrative: 'UNKNOWN' },
      ] as const) {
        window.localStorage.clear()
        resetMamDailyMemory()
        lookBack.mockResolvedValue(view([2, 3, 2, 4], over))
        const { result, unmount } = mount()
        await flush()
        // BOUNCE_BACK is a celebration: held back, nothing shown.
        expect(result.current.reaction).toBeNull()
        unmount()
      }
    })

    it('still comforts on a harder look-back', async () => {
      lookBack.mockResolvedValue(view([4, 5, 4, 2], { narrative: 'HARDER' }))
      const { result } = mount()
      await flush()
      expect(result.current.reaction).toMatchObject({ intent: 'COMFORT' })
    })

    it('a persistent low comforts with a different line each day', async () => {
      const seen: string[] = []
      for (const day of ['2026-11-20', '2026-11-21', '2026-11-22']) {
        vi.setSystemTime(new Date(`${day}T09:00:00`))
        lookBack.mockResolvedValue(
          view([2, 1, 2], {
            asOfLocalDate: day,
            days: [-2, -1, 0].map((offset, index) => ({
              localDate: new Date(
                Date.parse(`${day}T00:00:00.000Z`) + offset * 86_400_000,
              )
                .toISOString()
                .slice(0, 10),
              emotionLevel: [2, 1, 2][index],
            })),
          }),
        )
        const { result, unmount } = mount()
        await flush()
        expect(result.current.reaction).toMatchObject({ intent: 'COMFORT' })
        seen.push(result.current.reaction?.text ?? '')
        unmount()
      }
      expect(seen[1]).not.toBe(seen[0])
      expect(seen[2]).not.toBe(seen[1])
    })
  })

  describe('verified events', () => {
    it('a check-in save recomputes from the saved series and answers the new state', async () => {
      // The daily read was already done today.
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      lookBack.mockResolvedValue(view([4, 5, 4, 2]))
      const { result } = mount()
      await flush()
      expect(lookBack).not.toHaveBeenCalled()
      fire({ type: 'checkin-saved', emotion: 'VERY_LOW', intensity: 3 })
      await flush()
      expect(lookBack).toHaveBeenCalledTimes(1)
      expect(result.current.reaction).toMatchObject({ intent: 'COMFORT' })
      expect(MAM_LINES.DIP_AFTER_GOOD).toContain(result.current.reaction?.text)
    })

    it('uses the saved emotion for today when the series has not caught up', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      // The series ends yesterday: the save is today's only record.
      lookBack.mockResolvedValue(view([4, 4, 4, 4, null]))
      const { result } = mount()
      fire({ type: 'checkin-saved', emotion: 'LOW', intensity: 2 })
      await flush()
      expect(result.current.reaction).toMatchObject({ intent: 'COMFORT' })
    })

    it('a failed read after a save shows nothing', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      lookBack.mockRejectedValue(new Error('down'))
      const { result } = mount()
      fire({ type: 'checkin-saved', emotion: 'LOW', intensity: 2 })
      await flush()
      expect(result.current.reaction).toBeNull()
    })

    it.each([
      ['rating', 'LIGHTER', false, 'HAPPY'],
      ['rating', 'LIGHTER', true, 'LISTEN'],
      ['rating', 'HEAVIER', false, 'COMFORT'],
      ['rating', 'SAME', false, 'LISTEN'],
      ['obstacle', 'BUSY', false, 'LISTEN'],
      ['connected', 'NOT_YET', false, 'LISTEN'],
    ])(
      'a look-back %s answer %s (band moderate or higher: %s) plays %s, never a celebration',
      async (kind, value, moderatePlus, intent) => {
        window.localStorage.setItem(
          `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
          '1',
        )
        const { result } = mount()
        fire({ type: 'lookback-answer', kind, value, moderatePlus })
        await flush()
        expect(result.current.reaction).toMatchObject({ intent })
        expect(result.current.reaction?.intent).not.toBe('CELEBRATE')
      },
    )

    it('a support step answers with encouragement; every 3rd cheers softly once cheering is known', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      const { result } = mount()
      const done = async (offsetMs: number) => {
        vi.setSystemTime(new Date(Date.parse(`${TODAY}T09:00:00`) + offsetMs))
        fire({ type: 'support-done' })
        await flush()
        const reaction = result.current.reaction
        act(() => result.current.dismiss())
        return reaction
      }
      expect(await done(0)).toMatchObject({ intent: 'ENCOURAGE' })
      expect(await done(61_000)).toMatchObject({ intent: 'ENCOURAGE' })
      // No daily read happened in this page load: the third asks Care for the series, then cheers.
      expect(lookBack).not.toHaveBeenCalled()
      expect(await done(122_000)).toMatchObject({
        intent: 'CELEBRATE',
        grade: 'soft',
      })
      expect(lookBack).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['a failed read', () => lookBack.mockRejectedValue(new Error('down'))],
      [
        'partial data',
        () => lookBack.mockResolvedValue(view([4, 4, 4, 4], { partial: true })),
      ],
      [
        'a moderate-or-higher band',
        () =>
          lookBack.mockResolvedValue(
            view([4, 4, 4, 4], { band: { moderatePlus: true } }),
          ),
      ],
    ])(
      'the third support step stays encouragement on %s',
      async (_name, set) => {
        window.localStorage.setItem(
          `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
          '1',
        )
        window.localStorage.setItem(
          `mentalbridge_mam_support:${ACCOUNT}:${TODAY}`,
          '2',
        )
        set()
        const { result } = mount()
        fire({ type: 'support-done' })
        await flush()
        expect(result.current.reaction).toMatchObject({ intent: 'ENCOURAGE' })
      },
    )

    it('counts a second step done within 10 s toward the third, though it plays no line', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      window.localStorage.setItem(
        `mentalbridge_mam_support:${ACCOUNT}:${TODAY}`,
        '1',
      )
      const { result } = mount()
      fire({ type: 'support-done' })
      fire({ type: 'support-done' })
      await flush()
      expect(
        window.localStorage.getItem(
          `mentalbridge_mam_support:${ACCOUNT}:${TODAY}`,
        ),
      ).toBe('3')
      expect(result.current.reaction).toMatchObject({ intent: 'ENCOURAGE' })
    })

    it('plays a duplicate once (same date within 10 s)', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      const { result } = mount()
      fire({ type: 'resource-done' })
      await flush()
      const first = result.current.reaction
      act(() => result.current.dismiss())
      vi.setSystemTime(new Date(`${TODAY}T09:00:05`))
      fire({ type: 'resource-done' })
      await flush()
      expect(first).not.toBeNull()
      expect(result.current.reaction).toBeNull()
    })

    it('drops an event from another account and from before an account switch', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      // The new account's own daily read is done too: only the stale reactions are in question.
      window.localStorage.setItem(`mentalbridge_mam_daily:acct-2:${TODAY}`, '1')
      const { result, rerender } = mount({ mode: 'quiet' })
      // Another account's event, then this account's own, waiting for a FULL route.
      fire({ type: 'resource-done' }, { accountId: 'someone-else' })
      fire({ type: 'journal-saved' })
      rerender({ ...FULL, accountId: 'acct-2' })
      await flush()
      expect(result.current.reaction).toBeNull()
      // The previous account's pending reaction never reaches the new one.
      rerender({ ...FULL, accountId: 'acct-2', mode: 'quiet' })
      rerender({ ...FULL, accountId: 'acct-2' })
      await flush()
      expect(result.current.reaction).toBeNull()
    })

    it('a QUIET-route event plays there; one from a hidden route waits and is dropped after 10 minutes', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      const quiet = mount({ mode: 'quiet' })
      fire({ type: 'journal-saved', mood: 'LOW' })
      await flush()
      expect(quiet.result.current.reaction).toMatchObject({ intent: 'COMFORT' })
      quiet.unmount()

      const late = mount({ mode: 'hidden' })
      fire({ type: 'resource-done' })
      vi.setSystemTime(new Date(`${TODAY}T09:11:00`))
      late.rerender({ ...FULL })
      await flush()
      expect(late.result.current.reaction).toBeNull()
    })

    it('safety and hide zones drop an event, even one that was waiting', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      const { result, rerender } = mount({ ready: false })
      fire({ type: 'journal-saved' })
      rerender({ ...FULL, hard: true })
      await flush()
      rerender({ ...FULL })
      await flush()
      expect(result.current.reaction).toBeNull()
      fire({ type: 'resource-done' }, { localDate: '2026-11-21' })
      rerender({ ...FULL, hard: true })
      fire({ type: 'support-done' })
      await flush()
      rerender({ ...FULL })
      await flush()
      expect(result.current.reaction).toBeNull()
    })

    it('a band that rose, or a moderate-or-higher band, comforts and never cheers', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      const { result } = mount()
      fire({
        type: 'reassessment-done',
        band: 'LOWER',
        moderatePlus: true,
        id: 's1',
      })
      await flush()
      expect(result.current.reaction).toMatchObject({ intent: 'COMFORT' })
      expect(MAM_LINES.REASSESSMENT_CARE).toContain(
        result.current.reaction?.text,
      )
    })

    it.each([
      ['partial data', () => view([4, 4, 4, 4], { partial: true })],
      [
        'a band that could not be read',
        () => view([4, 4, 4, 4], { band: { readable: false } }),
      ],
      ['a harder look-back', () => view([4, 4, 4, 4], { narrative: 'HARDER' })],
    ])('a lower band does not cheer on %s', async (_name, make) => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      lookBack.mockResolvedValue(make())
      const { result } = mount()
      fire({
        type: 'reassessment-done',
        band: 'LOWER',
        moderatePlus: false,
        id: 's3',
      })
      await flush()
      expect(result.current.reaction).toMatchObject({ intent: 'LISTEN' })
    })

    it('a lower band does not cheer when the series cannot be read', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      lookBack.mockRejectedValue(new Error('down'))
      const { result } = mount()
      fire({
        type: 'reassessment-done',
        band: 'LOWER',
        moderatePlus: false,
        id: 's4',
      })
      await flush()
      expect(result.current.reaction).toMatchObject({ intent: 'LISTEN' })
    })

    it('answers one reassessment once, also after a remount (a reload or another review)', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      const event = {
        type: 'reassessment-done',
        band: 'HIGHER',
        moderatePlus: false,
        id: 's5',
      } as const
      const first = mount()
      fire(event)
      await flush()
      expect(first.result.current.reaction).toMatchObject({ intent: 'COMFORT' })
      first.unmount()
      vi.setSystemTime(new Date(`${TODAY}T11:00:00`))
      const second = mount()
      fire(event)
      await flush()
      expect(second.result.current.reaction).toBeNull()
      fire({ ...event, id: 's6' })
      await flush()
      expect(second.result.current.reaction).toMatchObject({
        intent: 'COMFORT',
      })
    })

    it('remembers the last 5 reassessments, so reviewing an earlier one still does not replay', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      const first = mount()
      for (const id of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']) {
        vi.setSystemTime(
          new Date(
            Date.parse(`${TODAY}T09:00:00`) + Number(id.slice(1)) * 11_000,
          ),
        )
        fire({
          type: 'reassessment-done',
          band: 'SAME',
          moderatePlus: false,
          id,
        })
        await flush()
      }
      first.unmount()
      expect(
        JSON.parse(
          window.localStorage.getItem(
            `mentalbridge_mam_reassessment:${ACCOUNT}`,
          ) ?? '[]',
        ),
      ).toEqual(['r2', 'r3', 'r4', 'r5', 'r6'])
      window.localStorage.removeItem(
        `mentalbridge_mam_bubbles:${ACCOUNT}:${TODAY}`,
      )
      const second = mount()
      // r2 is still known (an earlier review of it does not replay); r1 fell out of the last 5.
      fire({
        type: 'reassessment-done',
        band: 'SAME',
        moderatePlus: false,
        id: 'r2',
      })
      await flush()
      expect(second.result.current.reaction).toBeNull()
      fire({
        type: 'reassessment-done',
        band: 'SAME',
        moderatePlus: false,
        id: 'r1',
      })
      await flush()
      expect(second.result.current.reaction).not.toBeNull()
    })

    it('reads an id stored by an older build as plain text', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      window.localStorage.setItem(
        `mentalbridge_mam_reassessment:${ACCOUNT}`,
        'old-id',
      )
      const { result } = mount()
      fire({
        type: 'reassessment-done',
        band: 'SAME',
        moderatePlus: false,
        id: 'old-id',
      })
      await flush()
      expect(result.current.reaction).toBeNull()
    })

    it('a lower band cheers softly with the approved line', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      const { result } = mount()
      fire({
        type: 'reassessment-done',
        band: 'LOWER',
        moderatePlus: false,
        id: 's2',
      })
      await flush()
      expect(result.current.reaction).toMatchObject({
        intent: 'CELEBRATE',
        grade: 'soft',
      })
      expect(result.current.reaction?.text).toContain('thấp hơn')
    })
  })

  describe('caps', () => {
    const answer = async (
      result: { current: ReturnType<typeof useMamTrajectory> },
      type: 'support-done' | 'resource-done' | 'journal-saved',
      at: string,
      localDate = TODAY,
    ) => {
      vi.setSystemTime(new Date(`${TODAY}T${at}`))
      fire({ type }, { localDate })
      await flush()
      const reaction = result.current.reaction
      act(() => result.current.dismiss())
      return reaction
    }

    it('a reaction inside the 60 s spacing waits for it and then shows, never two at once', async () => {
      vi.useRealTimers()
      vi.useFakeTimers()
      vi.setSystemTime(new Date(`${TODAY}T09:00:00`))
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      const { result } = mount()
      expect(await answer(result, 'resource-done', '09:00:00')).not.toBeNull()
      vi.setSystemTime(new Date(`${TODAY}T09:00:20`))
      fire({ type: 'journal-saved' })
      await flush()
      expect(result.current.reaction).toBeNull()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(39_000)
      })
      expect(result.current.reaction).toBeNull()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      expect(result.current.reaction).toMatchObject({ intent: 'LISTEN' })
    })

    it('a daily line followed by a check-in inside the minute still answers the check-in (acceptance: low after good days)', async () => {
      vi.useRealTimers()
      vi.useFakeTimers()
      vi.setSystemTime(new Date(`${TODAY}T09:00:00`))
      lookBack.mockResolvedValue(view([4, 4, 4, 4, null]))
      const { result } = mount()
      await flush()
      expect(result.current.reaction).toMatchObject({ intent: 'HAPPY' })
      act(() => result.current.dismiss())
      vi.setSystemTime(new Date(`${TODAY}T09:00:10`))
      lookBack.mockResolvedValue(view([4, 4, 4, 1]))
      fire({ type: 'checkin-saved', emotion: 'VERY_LOW', intensity: 3 })
      await flush()
      expect(result.current.reaction).toBeNull()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(51_000)
      })
      expect(result.current.reaction).toMatchObject({ intent: 'COMFORT' })
      expect(MAM_LINES.DIP_AFTER_GOOD).toContain(result.current.reaction?.text)
    })

    it('drops a reaction past the daily cap instead of deferring it', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      window.localStorage.setItem(
        `mentalbridge_mam_bubbles:${ACCOUNT}:${TODAY}`,
        '3',
      )
      const { result } = mount()
      expect(await answer(result, 'resource-done', '09:00:00')).toBeNull()
    })

    it('shows at most 3 a day, and the daily line counts', async () => {
      lookBack.mockResolvedValue(view([4, 5, 4, 2]))
      const { result } = mount()
      await flush()
      expect(result.current.reaction).not.toBeNull()
      act(() => result.current.dismiss())
      expect(await answer(result, 'resource-done', '09:02:00')).not.toBeNull()
      expect(await answer(result, 'journal-saved', '09:04:00')).not.toBeNull()
      expect(await answer(result, 'support-done', '09:06:00')).toBeNull()
    })

    it('a new day starts the count again', async () => {
      window.localStorage.setItem(
        `mentalbridge_mam_bubbles:${ACCOUNT}:${TODAY}`,
        '3',
      )
      window.localStorage.setItem(
        `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
        '1',
      )
      const { result } = mount()
      expect(await answer(result, 'resource-done', '09:00:00')).toBeNull()
      vi.setSystemTime(new Date('2026-11-21T09:00:00'))
      fire({ type: 'resource-done' }, { localDate: '2026-11-21' })
      await flush()
      expect(result.current.reaction).not.toBeNull()
    })
  })

  it('ends what is on screen when the route becomes hidden, not when it turns QUIET', async () => {
    window.localStorage.setItem(
      `mentalbridge_mam_daily:${ACCOUNT}:${TODAY}`,
      '1',
    )
    const { result, rerender } = mount()
    fire({ type: 'resource-done' })
    await flush()
    expect(result.current.reaction).not.toBeNull()
    rerender({ ...FULL, mode: 'quiet' })
    expect(result.current.reaction).not.toBeNull()
    rerender({ ...FULL, mode: 'hidden' })
    expect(result.current.reaction).toBeNull()
    rerender({ ...FULL })
    expect(result.current.reaction).toBeNull()
  })
})
