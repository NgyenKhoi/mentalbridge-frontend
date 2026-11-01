import { describe, expect, it } from 'vitest'
import type {
  ActionOccurrence,
  SupportPlanV3,
} from '../api/support-plan-contract'
import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '../testing/native-support-plan-fixture'
import {
  actionWeek,
  cycleDays,
  cycleLine,
  dayLabel,
  earlierOpenRows,
  estimateDailyMinutes,
  formatTimeIn,
  localDateIn,
  mergeOccurrences,
  msUntilNextLocalDay,
  nextOpenAfter,
  occurrenceKey,
  occurrenceWindow,
  periodCounts,
  planTimezone,
  rowCapability,
  selectTodayFocus,
  stateReasonLine,
  summarizeProgress,
  todayCounts,
  todayRows,
  weekDates,
  weeklyMinutes,
} from './workspace-model'

const actionId = nativeSupportPlanFixture().focuses[0].actions[0].actionId

function occurrence(
  overrides: Partial<ActionOccurrence> = {},
): ActionOccurrence {
  return { ...emotionOccurrenceFixture(), ...overrides } as ActionOccurrence
}
function plan(overrides: Partial<SupportPlanV3> = {}): SupportPlanV3 {
  return { ...nativeSupportPlanFixture(), ...overrides }
}
function cycle(
  overrides: Partial<NonNullable<SupportPlanV3['cycle']>> = {},
): NonNullable<SupportPlanV3['cycle']> {
  return {
    policyVersion: 'support-plan-cycle-v1',
    lengthDays: 14,
    timezone: 'Asia/Ho_Chi_Minh',
    cycleNumber: 1,
    startedOn: '2026-10-10',
    reviewDueOn: '2026-10-23',
    currentDay: 4,
    pausedDays: 0,
    state: 'IN_PROGRESS',
    ...overrides,
  }
}

describe('workspace model', () => {
  it('selectTodayFocus uses the plan timezone date', () => {
    // 17:30 UTC on 13 Oct is already 14 Oct in Ho Chi Minh City.
    expect(
      localDateIn('Asia/Ho_Chi_Minh', new Date('2026-10-13T17:30:00Z')),
    ).toBe('2026-10-14')
    const focus = selectTodayFocus(
      plan(),
      [
        occurrence({ occurrenceId: 'a', localDate: '2026-10-13' }),
        occurrence({ occurrenceId: 'b', localDate: '2026-10-14' }),
      ],
      '2026-10-14',
    )
    expect(focus.kind === 'OCCURRENCE' && focus.occurrence.occurrenceId).toBe(
      'b',
    )
  })

  it('picks the earliest open occurrence today and lists the rest', () => {
    const focus = selectTodayFocus(
      plan(),
      [
        occurrence({
          occurrenceId: 'late',
          scheduledAt: '2026-10-13T12:00:00Z',
        }),
        occurrence({
          occurrenceId: 'done',
          state: 'COMPLETED',
          scheduledAt: '2026-10-13T01:00:00Z',
        }),
        occurrence({
          occurrenceId: 'early',
          scheduledAt: '2026-10-13T02:00:00Z',
        }),
      ],
      '2026-10-13',
    )
    expect(focus.kind).toBe('OCCURRENCE')
    if (focus.kind !== 'OCCURRENCE') return
    expect(focus.occurrence.occurrenceId).toBe('early')
    expect(focus.later.map((item) => item.occurrence.occurrenceId)).toEqual([
      'late',
    ])
  })

  it('skips read-only rows when choosing the row to expand', () => {
    const base = nativeSupportPlanFixture()
    const template = base.focuses[0].actions[0]
    const ended = { ...template, actionId: 'ended', status: 'ENDED' as const }
    const routine = {
      ...template,
      actionId: 'routine',
      actionType: 'ROUTINE_SELF_MANAGEMENT' as const,
    }
    const value = {
      ...base,
      focuses: [{ ...base.focuses[0], actions: [ended, routine] }],
    }
    const early = occurrence({
      occurrenceId: 'early',
      actionId: 'ended',
      scheduledAt: '2026-10-13T01:00:00Z',
    })
    const later = occurrence({
      occurrenceId: 'later',
      actionId: 'routine',
      actionType: 'ROUTINE_SELF_MANAGEMENT',
      scheduledAt: '2026-10-13T02:00:00Z',
    })
    const focus = selectTodayFocus(value, [early, later], '2026-10-13')
    expect(focus.kind === 'OCCURRENCE' && focus.occurrence.occurrenceId).toBe(
      'later',
    )
    expect(
      focus.kind === 'OCCURRENCE' &&
        focus.later.map((item) => item.occurrence.occurrenceId),
    ).toEqual(['early'])
  })

  it('returns DONE_FOR_TODAY with the next date', () => {
    expect(
      selectTodayFocus(
        plan(),
        [
          occurrence({ occurrenceId: 'done', state: 'COMPLETED' }),
          occurrence({ occurrenceId: 'next', localDate: '2026-10-15' }),
        ],
        '2026-10-13',
      ),
    ).toEqual({ kind: 'DONE_FOR_TODAY', nextDate: '2026-10-15' })
  })

  it('returns the next upcoming day when today is empty', () => {
    expect(
      selectTodayFocus(
        plan(),
        [occurrence({ localDate: '2026-10-16' })],
        '2026-10-13',
      ),
    ).toEqual({ kind: 'NOTHING_TODAY', nextDate: '2026-10-16' })
  })

  it('ignores occurrences whose action is not in the plan', () => {
    expect(
      selectTodayFocus(
        plan(),
        [occurrence({ actionId: 'unknown-action' })],
        '2026-10-13',
      ).kind,
    ).toBe('NOTHING_TODAY')
  })

  it('never offers the 14-day review reminder as daily work', () => {
    const base = nativeSupportPlanFixture()
    const reminder = {
      ...base.focuses[0].actions[0],
      actionId: 'review-action',
      actionType: 'REASSESSMENT_SCREENING' as const,
    }
    const withReminder = {
      ...base,
      focuses: [
        { ...base.focuses[0], actions: [...base.focuses[0].actions, reminder] },
      ],
    }
    expect(
      selectTodayFocus(
        withReminder,
        [
          occurrence({
            actionId: 'review-action',
            actionType: 'REASSESSMENT_SCREENING',
          }),
        ],
        '2026-10-13',
      ).kind,
    ).toBe('NOTHING_TODAY')
  })

  it('RESUME when paused', () => {
    expect(
      selectTodayFocus(
        plan({ status: 'PAUSED' }),
        [occurrence()],
        '2026-10-13',
      ),
    ).toEqual({ kind: 'RESUME' })
  })

  it('REVIEW_DUE wins over occurrences', () => {
    expect(
      selectTodayFocus(
        plan({ cycle: cycle({ state: 'REVIEW_DUE' }) }),
        [occurrence()],
        '2026-10-13',
      ).kind,
    ).toBe('REVIEW_DUE')
  })

  it('summarizeProgress counts by type without percentages', () => {
    const summary = summarizeProgress(
      plan(),
      [
        occurrence({
          occurrenceId: 'a',
          state: 'COMPLETED',
          localDate: '2026-10-11',
        }),
        occurrence({
          occurrenceId: 'b',
          state: 'COMPLETED',
          localDate: '2026-10-11',
        }),
        occurrence({
          occurrenceId: 'c',
          state: 'COMPLETED',
          localDate: '2026-10-12',
        }),
        occurrence({
          occurrenceId: 'future',
          state: 'COMPLETED',
          localDate: '2026-10-20',
        }),
      ],
      { from: '2026-10-07', through: '2026-10-20' },
      '2026-10-13',
    )
    expect(summary).toMatchObject({
      emotionDays: 2,
      journalDays: 0,
      activities: { done: 0, skipped: 0 },
      through: '2026-10-13',
    })
    expect(JSON.stringify(summary)).not.toContain('%')
  })

  it('occurrenceWindow never exceeds 31 days', () => {
    const long = occurrenceWindow(
      plan({ cycle: cycle({ startedOn: '2026-08-01' }) }),
      '2026-10-13',
    )
    expect(long).toEqual({ from: '2026-09-20', through: '2026-10-20' })
    expect(occurrenceWindow(plan({ cycle: null }), '2026-10-13')).toEqual({
      from: '2026-10-07',
      through: '2026-10-20',
    })
  })

  it('occurrenceKey separates plans and windows so old rows are never reused', () => {
    const first = occurrenceKey(plan(), '2026-10-13')
    expect(occurrenceKey(plan(), '2026-10-13')).toBe(first)
    expect(
      occurrenceKey(plan({ supportPlanId: 'other' }), '2026-10-13'),
    ).not.toBe(first)
    expect(occurrenceKey(plan(), '2026-10-14')).not.toBe(first)
  })

  it('estimateDailyMinutes from DAILY and WEEKLY schedules', () => {
    const base = nativeSupportPlanFixture()
    const daily = base.focuses[0].actions[0]
    const weekly = {
      ...daily,
      actionId: `${actionId}-weekly`,
      schedules: [
        {
          ...daily.schedules[0],
          recurrenceType: 'WEEKLY' as const,
          daysOfWeek: [1, 4],
          estimatedDurationMinutes: 35,
        },
      ],
    }
    expect(estimateDailyMinutes(base)).toBe(5)
    // Unknown durations are never guessed.
    expect(
      estimateDailyMinutes({
        ...base,
        focuses: [
          {
            ...base.focuses[0],
            actions: [
              {
                ...daily,
                schedules: [
                  { ...daily.schedules[0], estimatedDurationMinutes: null },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(0)
    expect(
      estimateDailyMinutes({
        ...base,
        focuses: [{ ...base.focuses[0], actions: [daily, weekly] }],
      }),
    ).toBe(15)
  })

  it('mergeOccurrences keeps the newest version whichever response lands last', () => {
    const done = occurrence({ state: 'COMPLETED', version: 2 })
    const stale = occurrence({ state: 'SCHEDULED', version: 1 })
    // A command result (v2) followed by an older fetch (v1).
    expect(mergeOccurrences([done], [stale])).toEqual([done])
    // An older local row followed by a newer fetch.
    expect(mergeOccurrences([stale], [done])).toEqual([done])
    // Rows the fetch no longer returns are dropped.
    expect(mergeOccurrences([done], [])).toEqual([])
  })

  it('msUntilNextLocalDay counts to the plan-timezone midnight', () => {
    // 23:59:30 in Ho Chi Minh City is 16:59:30 UTC.
    expect(
      msUntilNextLocalDay('Asia/Ho_Chi_Minh', new Date('2026-10-13T16:59:30Z')),
    ).toBe(31_000)
  })

  it('cycleLine names every cycle state and tolerates a missing cycle', () => {
    expect(cycleLine(null)).toBeUndefined()
    expect(cycleLine(undefined)).toBeUndefined()
    expect(cycleLine(cycle())).toBe('Chu kỳ 1 · Ngày 4/14')
    expect(cycleLine(cycle({ currentDay: 20 }))).toBe('Chu kỳ 1 · Ngày 14/14')
    expect(cycleLine(cycle({ state: 'PAUSED', cycleNumber: 2 }))).toBe(
      'Chu kỳ 2 · Đang tạm dừng',
    )
    expect(cycleLine(cycle({ state: 'REVIEW_DUE' }))).toBe(
      'Chu kỳ 1 · Đến lúc xem lại',
    )
    expect(cycleLine(cycle({ state: 'NOT_STARTED' }))).toBe(
      'Chu kỳ chưa bắt đầu',
    )
    expect(cycleLine(cycle({ state: 'CLOSED' }))).toBe('Chu kỳ 1 đã kết thúc')
    // An unknown state reads as a plain cycle, never as a raw token.
    expect(cycleLine(cycle({ state: 'SOMETHING_NEW' as 'CLOSED' }))).toBe(
      'Chu kỳ 1',
    )
  })

  describe('row capability', () => {
    type Mode = 'NATIVE_V3' | 'V2_RESOURCE_ADAPTER'
    const row = (
      type: ActionOccurrence['actionType'],
      overrides: Partial<ActionOccurrence> = {},
      mode: Mode = 'NATIVE_V3',
    ) => {
      const base = nativeSupportPlanFixture()
      const action = {
        ...base.focuses[0].actions[0],
        actionType: type,
        representationMode: mode,
      }
      return {
        planValue: {
          ...base,
          representationMode: mode,
          focuses: [{ ...base.focuses[0], actions: [action] }],
        },
        item: {
          action,
          occurrence: occurrence({
            actionType: type,
            representationMode: mode,
            ...overrides,
          }),
        },
      }
    }
    const none = {
      complete: false,
      skip: false,
      reopen: false,
      rate: false,
      barrier: false,
    }

    it('offers manual completion only for Resource and Routine', () => {
      for (const type of ['RESOURCE', 'ROUTINE_SELF_MANAGEMENT'] as const) {
        const { planValue, item } = row(type)
        expect(rowCapability(planValue, item, true)).toMatchObject({
          complete: true,
          skip: true,
        })
      }
      for (const type of ['JOURNAL', 'EMOTION_CHECK_IN'] as const) {
        const { planValue, item } = row(type)
        expect(rowCapability(planValue, item, true)).toMatchObject({
          complete: false,
          skip: true,
        })
      }
      for (const type of [
        'PROFESSIONAL_SUPPORT',
        'SELF_REPORT_REVIEW',
      ] as const) {
        const { planValue, item } = row(type)
        expect(rowCapability(planValue, item, true)).toEqual(none)
      }
    })

    it('gives unknown types and states no command at all', () => {
      const { planValue, item } = row('RESOURCE')
      const unknownType = {
        ...item,
        action: { ...item.action, actionType: 'NEW_KIND' as 'RESOURCE' },
      }
      const unknownState = {
        ...item,
        occurrence: { ...item.occurrence, state: 'NEW_STATE' as 'SCHEDULED' },
      }
      expect(rowCapability(planValue, unknownType, true)).toEqual(none)
      expect(rowCapability(planValue, unknownState, true)).toEqual(none)
    })

    it('reopens only a skip, never accepted completion, and needs engagement', () => {
      const skipped = row('EMOTION_CHECK_IN', {
        state: 'SKIPPED',
        displayState: 'SKIPPED',
      })
      expect(
        rowCapability(skipped.planValue, skipped.item, true),
      ).toMatchObject({ reopen: true, barrier: true })
      expect(
        rowCapability(skipped.planValue, skipped.item, false),
      ).toMatchObject({ reopen: false, barrier: false })
      const done = row('EMOTION_CHECK_IN', {
        state: 'COMPLETED',
        displayState: 'COMPLETED',
      })
      expect(rowCapability(done.planValue, done.item, true)).toEqual({
        ...none,
        rate: true,
      })
    })

    it('never rates a completed read-only or unknown type', () => {
      const done = { state: 'COMPLETED', displayState: 'COMPLETED' } as const
      const review = row('SELF_REPORT_REVIEW', done)
      expect(rowCapability(review.planValue, review.item, true)).toEqual(none)
      const base = row('RESOURCE', done)
      const unknownType = {
        ...base.item,
        action: { ...base.item.action, actionType: 'NEW_KIND' as 'RESOURCE' },
      }
      expect(rowCapability(base.planValue, unknownType, true)).toEqual(none)
    })

    it('keeps adapter rows on the v1 path: no native barrier answer', () => {
      const adapter = row(
        'RESOURCE',
        { state: 'SKIPPED', displayState: 'SKIPPED' },
        'V2_RESOURCE_ADAPTER',
      )
      expect(
        rowCapability(adapter.planValue, adapter.item, true),
      ).toMatchObject({ reopen: true, barrier: false })
    })

    it('offers nothing on cancelled rows or a paused plan', () => {
      const cancelled = row('RESOURCE', {
        state: 'CANCELLED',
        displayState: 'CANCELLED',
      })
      expect(rowCapability(cancelled.planValue, cancelled.item, true)).toEqual(
        none,
      )
      const open = row('RESOURCE')
      expect(
        rowCapability({ ...open.planValue, status: 'PAUSED' }, open.item, true),
      ).toEqual(none)
    })
  })

  describe('today rows and counts', () => {
    const planValue = plan()
    const at = (hour: string, extra: Partial<ActionOccurrence>) =>
      occurrence({ scheduledAt: `2026-10-13T${hour}:00Z`, ...extra })
    const rows = (now: string) =>
      todayRows(
        planValue,
        [
          at('05:00', {
            occurrenceId: 'a',
            state: 'COMPLETED',
            displayState: 'COMPLETED',
          }),
          at('02:00', {
            occurrenceId: 'b',
            state: 'SKIPPED',
            displayState: 'SKIPPED',
          }),
          at('09:00', { occurrenceId: 'c' }),
          at('12:00', { occurrenceId: 'd' }),
          at('13:00', {
            occurrenceId: 'e',
            state: 'CANCELLED',
            displayState: 'CANCELLED',
          }),
          at('14:00', { occurrenceId: 'f', state: 'FUTURE' as 'SCHEDULED' }),
          occurrence({ occurrenceId: 'old', localDate: '2026-10-12' }),
        ],
        '2026-10-13',
        Date.parse(now),
      )

    it('orders today by time, marks missed versus upcoming, and ignores other days', () => {
      expect(
        rows('2026-10-13T10:00:00Z').map((item) => [
          item.occurrence.occurrenceId,
          item.status,
        ]),
      ).toEqual([
        ['b', 'skipped'],
        ['a', 'done'],
        ['c', 'missed'],
        ['d', 'upcoming'],
        ['e', 'cancelled'],
        ['f', 'unknown'],
      ])
    })

    it('counts done and skipped separately and leaves cancelled rows out', () => {
      expect(todayCounts(rows('2026-10-13T10:00:00Z'))).toEqual({
        done: 1,
        skipped: 1,
        total: 5,
      })
      expect(todayCounts([])).toEqual({ done: 0, skipped: 0, total: 0 })
    })

    it('lists earlier unresolved work newest first and finds the next open day', () => {
      const day = (id: string, date: string, extra = {}) =>
        occurrence({
          occurrenceId: id,
          localDate: date,
          scheduledAt: `${date}T12:00:00Z`,
          ...extra,
        })
      const list = [
        day('o1', '2026-10-11'),
        day('o2', '2026-10-12'),
        day('o3', '2026-10-12', { state: 'SKIPPED', displayState: 'SKIPPED' }),
        day('n2', '2026-10-15'),
        day('n1', '2026-10-14'),
      ]
      expect(
        earlierOpenRows(planValue, list, '2026-10-13').map(
          (item) => item.occurrence.occurrenceId,
        ),
      ).toEqual(['o2', 'o1'])
      expect(
        nextOpenAfter(planValue, list, '2026-10-13')?.occurrence.occurrenceId,
      ).toBe('n1')
      expect(nextOpenAfter(planValue, [], '2026-10-13')).toBeUndefined()
    })
  })

  describe('cycle days', () => {
    const planValue = plan({
      cycle: cycle({ startedOn: '2026-10-10', reviewDueOn: '2026-10-23' }),
    })
    const day = (
      id: string,
      date: string,
      extra: Partial<ActionOccurrence> = {},
    ) =>
      occurrence({
        occurrenceId: id,
        localDate: date,
        scheduledAt: `${date}T02:00:00Z`,
        ...extra,
      })
    const done = { state: 'COMPLETED', displayState: 'COMPLETED' } as const
    const skipped = { state: 'SKIPPED', displayState: 'SKIPPED' } as const

    it('gives one entry per day, marks today and the review day, and reads future days as future', () => {
      const days = cycleDays(planValue, [], '2026-10-13')
      expect(days).toHaveLength(14)
      expect(days[0]).toMatchObject({ number: 1, date: '2026-10-10' })
      expect(days[3]).toMatchObject({ date: '2026-10-13', isToday: true })
      expect(days[13]).toMatchObject({
        date: '2026-10-23',
        isReviewDay: true,
        status: 'future',
      })
      expect(days.filter((item) => item.isToday)).toHaveLength(1)
    })

    it('tells done, partial and none apart, and counts a skip as not done', () => {
      const days = cycleDays(
        planValue,
        [
          day('a', '2026-10-10', done),
          day('b', '2026-10-11', done),
          day('c', '2026-10-11', skipped),
          day('d', '2026-10-12', skipped),
          day('e', '2026-10-12', {
            state: 'CANCELLED',
            displayState: 'CANCELLED',
          }),
        ],
        '2026-10-13',
      )
      expect(
        days.slice(0, 4).map((item) => [item.status, item.done, item.total]),
      ).toEqual([
        ['done', 1, 1],
        ['partial', 1, 2],
        ['none', 0, 1],
        ['none', 0, 0],
      ])
    })

    it('reads days outside the loaded window, or before the rows are known, as unknown', () => {
      const long = plan({
        cycle: cycle({
          startedOn: '2026-08-01',
          reviewDueOn: '2026-08-14',
          currentDay: 14,
        }),
      })
      expect(
        cycleDays(long, [], '2026-10-13').every(
          (item) => item.status === 'unknown',
        ),
      ).toBe(true)
      expect(
        cycleDays(planValue, [], '2026-10-13', false)
          .filter((item) => item.date <= '2026-10-13')
          .every((item) => item.status === 'unknown'),
      ).toBe(true)
    })

    it('has no days without a cycle, before it starts or after it closes', () => {
      expect(cycleDays(plan({ cycle: null }), [], '2026-10-13')).toEqual([])
      expect(
        cycleDays(
          plan({ cycle: cycle({ state: 'NOT_STARTED', startedOn: null }) }),
          [],
          '2026-10-13',
        ),
      ).toEqual([])
      expect(
        cycleDays(
          plan({ cycle: cycle({ state: 'CLOSED' }) }),
          [],
          '2026-10-13',
        ),
      ).toEqual([])
    })

    it('stretches to the review date when paused days push it out', () => {
      const paused = plan({
        cycle: cycle({ pausedDays: 3, reviewDueOn: '2026-10-26' }),
      })
      const days = cycleDays(paused, [], '2026-10-13')
      expect(days).toHaveLength(17)
      expect(days.at(-1)).toMatchObject({
        date: '2026-10-26',
        isReviewDay: true,
      })
    })
  })

  describe('copy and formatting guards', () => {
    it('formats times in the plan timezone and shows nothing for a bad value', () => {
      expect(formatTimeIn('Asia/Ho_Chi_Minh', '2026-10-13T00:42:00Z')).toBe(
        '07:42',
      )
      expect(formatTimeIn('America/New_York', '2026-10-13T12:05:00Z')).toBe(
        '08:05',
      )
      expect(formatTimeIn('Asia/Ho_Chi_Minh', 'not a date')).toBe('')
      expect(formatTimeIn('Asia/Ho_Chi_Minh', null)).toBe('')
      // An unusable zone falls back to the default zone instead of throwing.
      expect(formatTimeIn('Not/AZone', '2026-10-13T00:42:00Z')).toBe('07:42')
    })

    it('never throws on a bad date or timezone', () => {
      expect(dayLabel('2026-10-30')).toMatch(/30\/10/)
      expect(dayLabel('nope')).toBe('')
      expect(dayLabel(null)).toBe('')
      expect(localDateIn('Not/AZone', new Date('2026-10-13T17:30:00Z'))).toBe(
        '2026-10-14',
      )
      expect(msUntilNextLocalDay('', new Date('2026-10-13T16:59:30Z'))).toBe(
        31_000,
      )
      expect(
        planTimezone(plan({ cycle: cycle({ timezone: 'Not/AZone' }) })),
      ).toBe('Asia/Ho_Chi_Minh')
      expect(
        planTimezone(plan({ cycle: cycle({ timezone: 'America/New_York' }) })),
      ).toBe('America/New_York')
    })

    it('words a cancelled reason and drops a code it does not know', () => {
      expect(stateReasonLine('PLAN_PAUSED')).toBe('Kế hoạch đang tạm dừng')
      expect(stateReasonLine('SCHEDULE_CHANGED')).toBe('Lịch đã đổi')
      expect(stateReasonLine('SOMETHING_NEW')).toBeUndefined()
      expect(stateReasonLine(null)).toBeUndefined()
    })
  })
})

describe('week grid model', () => {
  const base = nativeSupportPlanFixture().focuses[0].actions[0]
  // Effective before the week, so every day counts unless a test narrows it.
  const daily = {
    ...base,
    schedules: [{ ...base.schedules[0], effectiveFrom: '2026-10-01' }],
  }
  const withSchedule = (changes: Partial<(typeof daily.schedules)[0]>) => ({
    ...daily,
    schedules: [{ ...daily.schedules[0], ...changes }],
  })
  // Tuesday 2026-10-13: the week runs Monday 12/10 to Sunday 18/10.
  const week = weekDates('2026-10-13')

  it('weekDates is Monday first and holds today', () => {
    expect(week[0]).toBe('2026-10-12')
    expect(week[6]).toBe('2026-10-18')
    expect(weekDates('2026-10-18')[0]).toBe('2026-10-12')
    expect(weekDates('2026-10-19')[0]).toBe('2026-10-19')
  })

  it('a DAILY schedule lands on every day with its local time', () => {
    expect(actionWeek(daily, week)).toEqual(Array(7).fill('19:00'))
  })

  it('a WEEKLY schedule lands only on its days; the others stay empty', () => {
    const weekly = withSchedule({
      recurrenceType: 'WEEKLY',
      daysOfWeek: [1, 4],
    })
    expect(actionWeek(weekly, week)).toEqual([
      '19:00',
      undefined,
      undefined,
      '19:00',
      undefined,
      undefined,
      undefined,
    ])
  })

  it('falls back to recurrenceDayOfWeek and honours effective dates', () => {
    expect(
      actionWeek(
        withSchedule({
          recurrenceType: 'WEEKLY',
          daysOfWeek: [],
          recurrenceDayOfWeek: 7,
        }),
        week,
      ),
    ).toEqual([...Array(6).fill(undefined), '19:00'])
    // A rule that starts on Thursday leaves Monday to Wednesday empty.
    expect(
      actionWeek(withSchedule({ effectiveFrom: '2026-10-15' }), week).map(
        Boolean,
      ),
    ).toEqual([false, false, false, true, true, true, true])
    // A ONCE rule shows only on its own date.
    expect(
      actionWeek(
        withSchedule({ recurrenceType: 'ONCE', effectiveFrom: '2026-10-14' }),
        week,
      ).map(Boolean),
    ).toEqual([false, false, true, false, false, false, false])
  })

  it('an unusable time is scheduled but empty, and ended rules show nothing', () => {
    expect(actionWeek(withSchedule({ localTime: '' }), week)[0]).toBe('')
    expect(
      actionWeek(withSchedule({ status: 'ENDED' }), week).every(
        (cell) => cell === undefined,
      ),
    ).toBe(true)
  })

  it('weeklyMinutes sums a typical week, ignoring effective dates and one-time rules', () => {
    expect(
      weeklyMinutes([
        withSchedule({ effectiveFrom: '2026-10-15' }),
        withSchedule({
          recurrenceType: 'ONCE',
          estimatedDurationMinutes: null,
        }),
      ]),
    ).toBe(35)
    expect(weeklyMinutes([daily])).toBe(35)
    expect(
      weeklyMinutes([
        daily,
        withSchedule({ recurrenceType: 'WEEKLY', daysOfWeek: [1, 4] }),
      ]),
    ).toBe(45)
    expect(
      weeklyMinutes([withSchedule({ estimatedDurationMinutes: null })]),
    ).toBeNull()
    expect(weeklyMinutes([])).toBeNull()
  })
})

describe('periodCounts', () => {
  const today = '2026-10-13'
  const now = Date.parse('2026-10-13T08:00:00Z')
  const row = (overrides: Partial<ActionOccurrence>, id: string) =>
    occurrence({ occurrenceId: id, actionId, ...overrides })

  it('counts done, put aside and open-past-time rows of the period only', () => {
    const rows = [
      row({ state: 'COMPLETED', localDate: '2026-10-11' }, 'a'),
      row({ state: 'SKIPPED', localDate: '2026-10-12' }, 'b'),
      row(
        { scheduledAt: '2026-10-12T01:00:00Z', localDate: '2026-10-12' },
        'c',
      ),
      // Later today: not yet missed. Cancelled and out-of-period rows are not counted.
      row({ scheduledAt: '2026-10-13T12:00:00Z', localDate: today }, 'd'),
      row({ state: 'CANCELLED', localDate: '2026-10-12' }, 'e'),
      row({ state: 'COMPLETED', localDate: '2026-10-01' }, 'f'),
    ]
    expect(periodCounts(plan(), rows, '2026-10-10', today, now)).toEqual({
      done: 1,
      skipped: 1,
      missed: 1,
    })
  })
})
