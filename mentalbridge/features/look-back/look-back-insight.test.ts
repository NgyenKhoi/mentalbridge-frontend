import { describe, expect, it } from 'vitest'

import { insightSentence, lookBackInsight } from './look-back-insight'
import type { LookBack } from './look-back-model'

type Day = LookBack['days'][number]
const day = (
  emotionLevel: number | null,
  supportCompleted: number | null,
  journalEntries: number | null = 0,
): Day => ({
  localDate: '2026-11-01',
  emotionLevel,
  journalEntries,
  supportCompleted,
})
const many = (n: number, ...args: Parameters<typeof day>) =>
  Array.from({ length: n }, () => day(...args))

describe('lookBackInsight', () => {
  it('PLAN: shows when both groups have 3 days and activity days are 0.5 higher', () => {
    const insight = lookBackInsight([...many(3, 4, 1), ...many(3, 3, 0)])
    expect(insight).toMatchObject({
      kind: 'PLAN',
      withDays: 3,
      withoutDays: 3,
      withMood: 'tốt',
      withoutMood: 'bình thường',
    })
    expect(insightSentence(insight!)).toBe(
      '3 ngày bạn làm ít nhất một việc trong kế hoạch, cảm xúc bạn ghi thường ở mức tốt. 3 ngày không làm: bình thường.',
    )
  })

  it('rounds the mean to the nearest level for the label', () => {
    const insight = lookBackInsight([
      ...many(2, 4, 1),
      day(5, 1),
      ...many(3, 2, 0),
    ])
    expect(insight).toMatchObject({ withMood: 'tốt', withoutMood: 'không tốt' })
  })

  it('needs 3 days in each group', () => {
    expect(lookBackInsight([...many(2, 5, 1), ...many(4, 2, 0)])).toBeNull()
    expect(lookBackInsight([...many(4, 5, 1), ...many(2, 2, 0)])).toBeNull()
  })

  it('needs a gap of 0.5 and never shows the lower direction', () => {
    expect(
      lookBackInsight([...many(3, 3, 1), ...many(2, 3, 0), day(2.5, 0)]),
    ).toBeNull()
    expect(lookBackInsight([...many(3, 2, 1), ...many(3, 4, 0)])).toBeNull()
  })

  it('skips days without a check-in or with an unreadable source', () => {
    expect(
      lookBackInsight([...many(3, 4, 1), ...many(2, 2, 0), day(null, 0)]),
    ).toBeNull()
    expect(
      lookBackInsight([...many(3, 4, null), ...many(3, 2, null)]),
    ).toBeNull()
  })

  it('falls back to journal days when plan days say nothing', () => {
    const days = [...many(3, 4, 0, 1), ...many(3, 2, 0, 0)]
    const insight = lookBackInsight(days)
    expect(insight?.kind).toBe('JOURNAL')
    expect(insightSentence(insight!)).toMatch(/^3 ngày bạn viết nhật ký, /)
  })

  it('falls through to the journal variant when the plan groups round to the same mood word', () => {
    // 3.4 and 2.5 are 0.9 apart yet both round to level 3: the word would be the same on both sides.
    const days = [
      ...many(3, 3.4, 1, 1),
      ...many(3, 2.5, 0, 0),
      ...many(3, 4, 0, 1),
      ...many(3, 2, 0, 0),
    ]
    const insight = lookBackInsight(days)
    expect(insight?.kind).toBe('JOURNAL')
  })

  it('returns null when every qualifying comparison gives the same mood word on both sides', () => {
    expect(
      lookBackInsight([...many(3, 3.4, 1, 1), ...many(3, 2.5, 0, 0)]),
    ).toBeNull()
  })

  it('prefers the plan variant when both qualify', () => {
    const days = [...many(3, 5, 1, 1), ...many(3, 2, 0, 0)]
    expect(lookBackInsight(days)?.kind).toBe('PLAN')
  })
})
