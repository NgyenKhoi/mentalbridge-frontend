import { describe, expect, it } from 'vitest'

import type { CompanionCommitment } from '@/lib/companion-state/contract'
import {
  FOCUS_INVITE_LINE,
  REVIEW_LINE,
  decideMamDaily,
  type MamDecisionInput,
} from './mam-decide'
import {
  MAM_BUBBLE_CAP,
  MAM_BUBBLE_CAP_STEADY,
  mamBubbleCapped,
} from './mam-daily'

const TODAY = '2026-11-27'

const commitment = (
  patch: Partial<CompanionCommitment> = {},
): CompanionCommitment => ({
  id: '30000000-0000-4000-8000-000000000001',
  kind: 'REST',
  minutes: 5,
  dueOn: TODAY,
  source: 'HOME',
  status: 'OPEN',
  createdAt: '2026-11-26T08:00:00.000Z',
  resolvedAt: null,
  ...patch,
})

const input = (patch: Partial<MamDecisionInput> = {}): MamDecisionInput => ({
  state: 'NO_DATA',
  cheerable: true,
  companion: { focus: null, commitments: [] },
  safety: false,
  reviewDue: false,
  hasScreening: false,
  focusAskedOn: null,
  today: TODAY,
  ...patch,
})

describe('decideMamDaily', () => {
  it.each(['PERSISTENT_LOW', 'FIRST_LOW', 'DIP_AFTER_GOOD'] as const)(
    'row 1: %s comforts first, before any ask',
    (state) => {
      expect(
        decideMamDaily(
          input({
            state,
            companion: {
              focus: null,
              commitments: [commitment()],
            },
            reviewDue: true,
          }),
        ),
      ).toEqual({ kind: 'state', row: 1, state })
    },
  )

  it('row 2: asks about a lời hẹn due yesterday and one due today, in their own words', () => {
    const yesterday = decideMamDaily(
      input({
        companion: {
          focus: null,
          commitments: [commitment({ dueOn: '2026-11-26' })],
        },
      }),
    )
    expect(yesterday).toMatchObject({
      kind: 'line',
      row: 2,
      text: 'Hôm qua mình có hẹn nghỉ ngơi hoặc ngủ sớm hơn nè. Ghé thẻ Hôm nay kể Mầm nghe nhé.',
    })
    const today = decideMamDaily(
      input({
        companion: { focus: null, commitments: [commitment({ kind: 'MOVE' })] },
      }),
    )
    expect(today).toMatchObject({
      row: 2,
      text: 'Hôm nay mình hẹn vận động nhẹ nè, 5 phút thôi cũng được.',
    })
  })

  it('row 2 ignores a lời hẹn that is answered, older than yesterday or not yet due', () => {
    for (const item of [
      commitment({ status: 'DONE' }),
      commitment({ dueOn: '2026-11-25' }),
      commitment({ dueOn: '2026-11-28' }),
    ])
      expect(
        decideMamDaily(
          input({ companion: { focus: null, commitments: [item] } }),
        ),
      ).toBeNull()
  })

  it('row 3: points to the look-back when the review is due and nothing is promised', () => {
    expect(decideMamDaily(input({ reviewDue: true }))).toEqual({
      kind: 'line',
      row: 3,
      intent: 'LISTEN',
      text: REVIEW_LINE,
    })
  })

  it('row 4: invites the focus pick after a screening, not again within 3 days', () => {
    const base = { hasScreening: true }
    expect(decideMamDaily(input(base))).toMatchObject({
      row: 4,
      text: FOCUS_INVITE_LINE,
    })
    expect(decideMamDaily(input({ ...base, focusAskedOn: '2026-11-25' }))).toBe(
      null,
    )
    expect(
      decideMamDaily(input({ ...base, focusAskedOn: '2026-11-24' })),
    ).toMatchObject({ row: 4 })
    // A goal is already chosen, or there is no screening yet: nothing to ask.
    expect(
      decideMamDaily(
        input({
          ...base,
          companion: {
            focus: { goal: 'SLEEP', chosenOn: '2026-11-20' },
            commitments: [],
          },
        }),
      ),
    ).toBeNull()
    expect(decideMamDaily(input())).toBeNull()
  })

  it('rows 2 to 4 stay silent when the state could not be read or Home shows safety', () => {
    const asks = {
      reviewDue: true,
      hasScreening: true,
    }
    expect(decideMamDaily(input({ ...asks, safety: true }))).toBeNull()
    expect(
      decideMamDaily(input({ ...asks, companion: null, hasScreening: false })),
    ).toMatchObject({ row: 3 })
    expect(
      decideMamDaily(input({ hasScreening: true, companion: null })),
    ).toBeNull()
  })

  it.each(['IMPROVING', 'STEADY_GOOD', 'BOUNCE_BACK'] as const)(
    'row 5: %s cheers only when the look-back allows it',
    (state) => {
      expect(decideMamDaily(input({ state }))).toEqual({
        kind: 'state',
        row: 5,
        state,
      })
      expect(decideMamDaily(input({ state, cheerable: false }))).toBeNull()
    },
  )

  it.each(['WELCOME_BACK', 'FLAT'] as const)(
    'row 5: %s keeps its existing reaction even when not cheerable',
    (state) => {
      expect(decideMamDaily(input({ state, cheerable: false }))).toEqual({
        kind: 'state',
        row: 5,
        state,
      })
    },
  )

  it('row 2 outranks rows 3 and 4 and row 5, and row 3 outranks 4 and 5', () => {
    const all = input({
      state: 'IMPROVING',
      reviewDue: true,
      hasScreening: true,
      companion: { focus: null, commitments: [commitment()] },
    })
    expect(decideMamDaily(all)).toMatchObject({ row: 2 })
    expect(
      decideMamDaily({ ...all, companion: { focus: null, commitments: [] } }),
    ).toMatchObject({ row: 3 })
    expect(
      decideMamDaily({
        ...all,
        reviewDue: false,
        companion: { focus: null, commitments: [] },
      }),
    ).toMatchObject({ row: 4 })
  })

  it('row 6: silence when nothing applies', () => {
    expect(decideMamDaily(input())).toBeNull()
    expect(
      decideMamDaily(input({ state: 'NO_DATA', hasScreening: false })),
    ).toBe(null)
  })
})

describe('daily bubble cap', () => {
  it('is 3 by default and 1 on a steady-good day', () => {
    expect(MAM_BUBBLE_CAP).toBe(3)
    expect(MAM_BUBBLE_CAP_STEADY).toBe(1)
    expect(mamBubbleCapped(2)).toBe(false)
    expect(mamBubbleCapped(3)).toBe(true)
    expect(mamBubbleCapped(0, true)).toBe(false)
    expect(mamBubbleCapped(1, true)).toBe(true)
  })
})
