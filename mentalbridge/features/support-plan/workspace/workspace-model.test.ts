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
  cycleLine,
  estimateDailyMinutes,
  localDateIn,
  mergeOccurrences,
  msUntilNextLocalDay,
  occurrenceWindow,
  selectTodayFocus,
  summarizeProgress,
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

  it('cycleLine speaks plainly and hides mechanics', () => {
    expect(cycleLine(null)).toBeUndefined()
    expect(cycleLine(cycle())).toBe('Ngày 4/14')
    expect(cycleLine(cycle({ state: 'REVIEW_DUE' }))).toBe(
      'Đến lúc xem lại kế hoạch',
    )
    expect(cycleLine(cycle({ state: 'NOT_STARTED' }))).toBeUndefined()
  })
})
