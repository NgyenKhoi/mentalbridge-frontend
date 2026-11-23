import { describe, expect, it } from 'vitest'

import {
  MAM_CELEBRATORY_STATES,
  MAM_STATE_REACTION,
  MAM_TRAJECTORY_STATES,
  daysBetween,
  mamTrajectory,
  type MamDayLevel,
} from './mam-trajectory'

const TODAY = '2026-11-20'
const shift = (days: number) =>
  new Date(Date.parse(`${TODAY}T00:00:00.000Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10)

// Levels oldest to newest, the last one on `today`; null is a day with no check-in.
const series = (levels: readonly (number | null)[], end = 0): MamDayLevel[] =>
  levels.map((level, index) => ({
    localDate: shift(end - (levels.length - 1 - index)),
    level,
  }))
const state = (levels: readonly (number | null)[], end = 0) =>
  mamTrajectory(series(levels, end), TODAY)

describe('mamTrajectory', () => {
  it('has no data below 2 records, and gaps are not records', () => {
    expect(state([])).toBe('NO_DATA')
    expect(state([1])).toBe('NO_DATA')
    expect(state([null, null, 1, null])).toBe('NO_DATA')
    expect(state([3, 2])).not.toBe('NO_DATA')
  })

  it('FIRST_LOW: today low, the previous 3 recorded days not low', () => {
    expect(state([3, 4, 3, 2])).toBe('FIRST_LOW')
    expect(state([3, 2])).toBe('FIRST_LOW')
    // A gap is skipped, not read as low.
    expect(state([4, null, null, 3, 2])).toBe('FIRST_LOW')
    // A low day 4 recorded days back is outside "the previous 3".
    expect(state([2, 3, 3, 3, 2])).toBe('FIRST_LOW')
    // A low today after mixed days (one low among the last three) is answered the same way, not left silent.
    expect(state([3, 2, 3, 2])).toBe('FIRST_LOW')
    expect(state([4, 2, 4, 2])).toBe('FIRST_LOW')
  })

  it('DIP_AFTER_GOOD: a good streak of 3 or more, then low today', () => {
    expect(state([4, 5, 4, 2])).toBe('DIP_AFTER_GOOD')
    expect(state([3, 4, 4, 4, 1])).toBe('DIP_AFTER_GOOD')
    // Two good days are not a streak: it is a first low.
    expect(state([3, 4, 4, 2])).toBe('FIRST_LOW')
  })

  it('PERSISTENT_LOW: low on 3 of the last 4 recorded days, latest included', () => {
    expect(state([2, 2, 1])).toBe('PERSISTENT_LOW')
    expect(state([4, 2, 1, 2])).toBe('PERSISTENT_LOW')
    expect(state([2, 3, 2, 2])).toBe('PERSISTENT_LOW')
    // 2 of 4 is not enough (it is a low after mixed days).
    expect(state([4, 2, 4, 2])).not.toBe('PERSISTENT_LOW')
    // The latest day is not low: that is a bounce back, not a persistent low.
    expect(state([2, 1, 2, 4])).toBe('BOUNCE_BACK')
    // With no check-in today the latest low day still counts as one of the recent days.
    expect(state([2, 2, 1], -1)).toBe('PERSISTENT_LOW')
  })

  it('BOUNCE_BACK: a low record dated yesterday, today neutral+1 or better', () => {
    expect(state([3, 2, 4])).toBe('BOUNCE_BACK')
    expect(state([4, 1, 5])).toBe('BOUNCE_BACK')
    expect(state([2, 3, 2, 4])).toBe('BOUNCE_BACK')
    // Yesterday was not low: a low streak before it does not count.
    expect(state([2, 2, 3, 4])).not.toBe('BOUNCE_BACK')
    // The previous record is not yesterday's (a gap day, or an old low streak).
    expect(state([2, 2, null, 4])).not.toBe('BOUNCE_BACK')
    expect(state([2, 2, null, null, null, null, null, null, 4])).not.toBe(
      'BOUNCE_BACK',
    )
    // Neutral is not enough.
    expect(state([3, 2, 3])).not.toBe('BOUNCE_BACK')
    // The low day is 4 days back: not yesterday.
    expect(state([2, null, null, null, 4])).not.toBe('BOUNCE_BACK')
    // Needs a record dated today.
    expect(state([3, 2, 4], -1)).not.toBe('BOUNCE_BACK')
  })

  it('IMPROVING: the last 3 recorded days average 0.7 or more above the 3 before', () => {
    // 2,2,2 -> 3,3,3: +1.0
    expect(state([2, 2, 2, 3, 3, 3])).toBe('IMPROVING')
    // Whole levels move the 3-day mean in thirds: +0.667 is below 0.7, +1.0 is above, so both sides are pinned.
    expect(state([3, 3, 3, 3, 4, 4])).not.toBe('IMPROVING')
    expect(state([3, 3, 3, 3, 4, 5])).toBe('IMPROVING')
    // Fewer than 6 recorded days cannot compare two windows.
    expect(state([2, 2, 3, 3, 4])).not.toBe('IMPROVING')
    // Gaps stay gaps: the windows count recorded days.
    expect(state([2, null, 2, null, 2, 3, null, 3, 3])).toBe('IMPROVING')
    // A low latest day never reads as improving.
    expect(state([1, 1, 1, 3, 3, 2])).not.toBe('IMPROVING')
  })

  it('STEADY_GOOD: the latest good and at least 4 good days of the last 5', () => {
    expect(state([4, 4, 5, 4])).toBe('STEADY_GOOD')
    expect(state([3, 4, 4, 5, 4])).toBe('STEADY_GOOD')
    expect(state([4, 3, 4, 4, 4])).toBe('STEADY_GOOD')
    expect(state([4, 3, 3, 4, 4])).not.toBe('STEADY_GOOD')
    // 3 good days only.
    expect(state([4, 4, 4])).not.toBe('STEADY_GOOD')
  })

  it('FLAT: spread of 1 or less over 5 recorded days with a middle level', () => {
    expect(state([3, 3, 3, 3, 3])).toBe('FLAT')
    expect(state([2, 3, 3, 3, 3])).toBe('FLAT')
    expect(state([3, 4, 3, 4, 3])).toBe('FLAT')
    // Spread of 2.
    expect(state([2, 3, 4, 3, 3])).not.toBe('FLAT')
    // Four records are not enough.
    expect(state([3, 3, 3, 3])).toBe('NO_DATA')
    // A flat low run is a persistent low, a flat good run a steady good one, never FLAT.
    expect(state([2, 2, 2, 2, 2])).toBe('PERSISTENT_LOW')
    expect(state([4, 4, 4, 4, 4])).toBe('STEADY_GOOD')
  })

  it('WELCOME_BACK: no record for 3 or more days, whatever came before', () => {
    expect(state([3, 3, 3], -3)).toBe('WELCOME_BACK')
    expect(state([2, 2, 2, 2], -5)).toBe('WELCOME_BACK')
    expect(state([4, 4, 4, 4], -10)).toBe('WELCOME_BACK')
    // 2 days is still "these days".
    expect(state([2, 2, 1], -2)).toBe('PERSISTENT_LOW')
    // Records older than 14 days are not in the window.
    expect(state([3, 3, 3], -14)).toBe('NO_DATA')
  })

  it('applies the precedence when several rules hold', () => {
    // PERSISTENT_LOW over DIP_AFTER_GOOD and FIRST_LOW
    expect(state([4, 4, 4, 2, 2, 1])).toBe('PERSISTENT_LOW')
    // DIP_AFTER_GOOD over FIRST_LOW (both hold for 4,4,4,2)
    expect(state([4, 4, 4, 2])).toBe('DIP_AFTER_GOOD')
    // BOUNCE_BACK over IMPROVING (the means rise by 1.67)
    expect(state([1, 1, 2, 2, 1, 5])).toBe('BOUNCE_BACK')
    // IMPROVING over STEADY_GOOD: 3,3,3 then 4,4,5 (+1.33), and 4 good of the last 5.
    expect(state([3, 3, 3, 4, 4, 5])).toBe('IMPROVING')
    // STEADY_GOOD over FLAT: 4,4,4,4,4 is within a spread of 1 but not a middle level.
    expect(state([4, 4, 4, 4, 4])).toBe('STEADY_GOOD')
  })

  it('reads the series in any order and ignores duplicate-free future days', () => {
    const days = series([4, 4, 4, 2]).reverse()
    expect(mamTrajectory(days, TODAY)).toBe('DIP_AFTER_GOOD')
    expect(
      mamTrajectory(
        [...series([3, 3]), { localDate: shift(2), level: 1 }],
        TODAY,
      ),
    ).toBe('NO_DATA')
  })

  it('says nothing when data exists but none of the states fit', () => {
    // Middling days with no low today and no trend.
    expect(state([3, 4, 3, 3])).toBe('NO_DATA')
  })
})

describe('state reactions', () => {
  it('maps every state to an intent, and NO_DATA to none', () => {
    for (const name of MAM_TRAJECTORY_STATES)
      expect(name in MAM_STATE_REACTION).toBe(true)
    expect(MAM_STATE_REACTION.NO_DATA).toBeNull()
    expect(MAM_STATE_REACTION.FIRST_LOW?.intent).toBe('COMFORT')
    expect(MAM_STATE_REACTION.DIP_AFTER_GOOD?.intent).toBe('COMFORT')
    expect(MAM_STATE_REACTION.PERSISTENT_LOW?.intent).toBe('COMFORT')
    expect(MAM_STATE_REACTION.BOUNCE_BACK).toEqual({
      intent: 'CELEBRATE',
      grade: 'soft',
    })
    expect(MAM_STATE_REACTION.STEADY_GOOD?.intent).toBe('HAPPY')
    expect(MAM_STATE_REACTION.FLAT?.intent).toBe('LISTEN')
  })

  it('never cheers on a low state', () => {
    for (const low of [
      'FIRST_LOW',
      'DIP_AFTER_GOOD',
      'PERSISTENT_LOW',
    ] as const)
      expect(MAM_CELEBRATORY_STATES.has(low)).toBe(false)
    expect([...MAM_CELEBRATORY_STATES].sort()).toEqual([
      'BOUNCE_BACK',
      'IMPROVING',
      'STEADY_GOOD',
    ])
  })

  it('counts days between local dates across a month end', () => {
    expect(daysBetween('2026-11-30', '2026-12-02')).toBe(2)
    expect(daysBetween('2026-11-20', '2026-11-20')).toBe(0)
  })
})
