import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { MamDockSlot } from './MamDockSlot'
import { mamSpeaks } from './use-mam-trajectory'
import {
  MAM_DEDUPE_MS,
  dispatchMamEvent,
  mamBandChange,
  mamEventIsNew,
  mamEventName,
  mamEventReaction,
  parseMamEvent,
  type MamEvent,
  type MamEventDetail,
} from './mam-events'

const ACCOUNT = 'acct-1'
const base = { accountId: ACCOUNT, localDate: '2026-11-20' }

function heard(type: Parameters<typeof mamEventName>[0], fire: () => void) {
  const seen: unknown[] = []
  const listener = (event: Event) => seen.push((event as CustomEvent).detail)
  window.addEventListener(mamEventName(type), listener)
  fire()
  window.removeEventListener(mamEventName(type), listener)
  return seen
}

describe('dispatchMamEvent', () => {
  it('sends nothing without a signed-in slot', () => {
    expect(
      heard('support-done', () => dispatchMamEvent({ type: 'support-done' })),
    ).toEqual([])
  })

  it('stamps the account and the local date, and carries enums and dates only', () => {
    const view = render(createElement(MamDockSlot, { accountId: ACCOUNT }))
    const seen = heard('checkin-saved', () =>
      dispatchMamEvent({
        type: 'checkin-saved',
        emotion: 'LOW',
        intensity: 4,
        localDate: '2026-11-20',
      }),
    )
    expect(seen).toEqual([
      {
        type: 'checkin-saved',
        emotion: 'LOW',
        intensity: 4,
        localDate: '2026-11-20',
        accountId: ACCOUNT,
      },
    ])
    const journal = heard('journal-saved', () =>
      dispatchMamEvent({ type: 'journal-saved' }),
    )[0] as MamEventDetail
    expect(journal).toMatchObject({ accountId: ACCOUNT })
    expect(journal.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    view.unmount()
  })
})

describe('parseMamEvent', () => {
  it('drops an event stamped with another account', () => {
    expect(
      parseMamEvent('support-done', { ...base, accountId: 'other' }, ACCOUNT),
    ).toBeNull()
    expect(
      parseMamEvent('support-done', { localDate: base.localDate }, ACCOUNT),
    ).toBeNull()
  })

  it('accepts only the declared shape and never passes a stray field on', () => {
    expect(
      parseMamEvent(
        'checkin-saved',
        { ...base, emotion: 'GOOD', intensity: 3, note: 'secret text' },
        ACCOUNT,
      ),
    ).toEqual({ ...base, type: 'checkin-saved', emotion: 'GOOD', intensity: 3 })
    expect(
      parseMamEvent(
        'checkin-saved',
        { ...base, emotion: 'ECSTATIC', intensity: 3 },
        ACCOUNT,
      ),
    ).toBeNull()
    expect(
      parseMamEvent(
        'checkin-saved',
        { ...base, emotion: 'GOOD', intensity: 'x' },
        ACCOUNT,
      ),
    ).toBeNull()
    expect(
      parseMamEvent('support-done', { ...base, localDate: 'today' }, ACCOUNT),
    ).toBeNull()
    expect(parseMamEvent('support-done', null, ACCOUNT)).toBeNull()
    expect(
      parseMamEvent(
        'journal-saved',
        { ...base, text: 'dear diary', mood: 'LOW' },
        ACCOUNT,
      ),
    ).toEqual({ ...base, type: 'journal-saved', mood: 'LOW' })
    expect(
      parseMamEvent('journal-saved', { ...base, mood: 'SAD' }, ACCOUNT),
    ).toEqual({ ...base, type: 'journal-saved' })
    expect(
      parseMamEvent(
        'reassessment-done',
        { ...base, band: 'LOWER', moderatePlus: false },
        ACCOUNT,
      ),
    ).toBeNull()
    expect(
      parseMamEvent(
        'reassessment-done',
        { ...base, band: 'LOWER', moderatePlus: false, id: 's1' },
        ACCOUNT,
      ),
    ).toMatchObject({ band: 'LOWER', id: 's1' })
  })
})

describe('mamEventIsNew', () => {
  const event = (over: Record<string, unknown> = {}) =>
    ({ ...base, type: 'support-done', ...over }) as MamEventDetail

  it('plays the same type and date once within 10 s, again after', () => {
    const seen = new Map<string, number>()
    expect(mamEventIsNew(seen, event(), 1000)).toBe(true)
    expect(mamEventIsNew(seen, event(), 1000 + MAM_DEDUPE_MS - 1)).toBe(false)
    expect(mamEventIsNew(seen, event(), 1000 + MAM_DEDUPE_MS)).toBe(true)
  })

  it('keeps different types and different dates apart', () => {
    const seen = new Map<string, number>()
    expect(mamEventIsNew(seen, event(), 0)).toBe(true)
    expect(mamEventIsNew(seen, event({ type: 'resource-done' }), 1)).toBe(true)
    expect(mamEventIsNew(seen, event({ localDate: '2026-11-21' }), 2)).toBe(
      true,
    )
  })

  it('plays a reassessment id once for good', () => {
    const seen = new Map<string, number>()
    const one = event({
      type: 'reassessment-done',
      band: 'LOWER',
      moderatePlus: false,
      id: 's1',
    })
    expect(mamEventIsNew(seen, one, 0)).toBe(true)
    expect(
      mamEventIsNew(seen, { ...one, localDate: '2026-11-25' }, 5 * 60_000),
    ).toBe(false)
    expect(mamEventIsNew(seen, { ...one, id: 's2' } as never, 5 * 60_000)).toBe(
      true,
    )
  })
})

const trend = (previous: string | null, current: string, state = 'AVAILABLE') =>
  ({
    state,
    previous: previous ? { screeningLevel: previous } : null,
    current: { screeningLevel: current },
  }) as never
const summary = (...trends: unknown[]) =>
  ({ screening: { state: 'AVAILABLE', trends } }) as never

describe('mamBandChange', () => {
  it('reads LOWER, SAME and HIGHER from the band levels', () => {
    expect(mamBandChange(summary(trend('MODERATE', 'MILD')))).toEqual({
      band: 'LOWER',
      moderatePlus: false,
    })
    expect(mamBandChange(summary(trend('MILD', 'MILD')))).toEqual({
      band: 'SAME',
      moderatePlus: false,
    })
    expect(mamBandChange(summary(trend('MILD', 'MODERATE')))).toEqual({
      band: 'HIGHER',
      moderatePlus: true,
    })
  })

  it('lets any instrument that rose win, and flags a moderate-or-higher band that fell', () => {
    expect(
      mamBandChange(
        summary(trend('MODERATE', 'MILD'), trend('MINIMAL', 'MILD')),
      ),
    ).toMatchObject({ band: 'HIGHER' })
    expect(mamBandChange(summary(trend('SEVERE', 'MODERATE')))).toEqual({
      band: 'LOWER',
      moderatePlus: true,
    })
  })

  it('counts a moderate-or-higher band without a previous point, so a lower band elsewhere never cheers', () => {
    expect(
      mamBandChange(summary(trend(null, 'MODERATE'), trend('MILD', 'MINIMAL'))),
    ).toEqual({ band: 'LOWER', moderatePlus: true })
    expect(mamBandChange(summary(trend(null, 'SEVERE')))).toEqual({
      band: 'SAME',
      moderatePlus: true,
    })
    expect(
      mamBandChange(summary(trend(null, 'MODERATE', 'INSUFFICIENT_DATA'))),
    ).toEqual({ band: 'SAME', moderatePlus: true })
  })

  it('is silent, never LOWER, when a level is not one it knows', () => {
    expect(mamBandChange(summary(trend('MILD', 'EXTREME')))).toBeNull()
    expect(mamBandChange(summary(trend('MODERATE', 'MYSTERY')))).toBeNull()
    expect(
      mamBandChange(
        summary(trend('UNKNOWN', 'MINIMAL'), trend('MILD', 'MILD')),
      ),
    ).toBeNull()
  })

  it('is silent when no instrument has both points', () => {
    expect(mamBandChange(summary())).toBeNull()
    expect(mamBandChange(summary(trend(null, 'MILD')))).toBeNull()
    expect(
      mamBandChange(summary(trend('MILD', 'MILD', 'INSUFFICIENT_DATA'))),
    ).toBeNull()
  })
})

describe('mamEventReaction', () => {
  const ctx = { calm: true, supportToday: 1, daysSinceJournal: null }

  it('journal: a nod, or encouragement for the first entry in 3 days or more', () => {
    const event: MamEvent = { type: 'journal-saved' }
    expect(mamEventReaction(event, ctx)).toEqual({
      intent: 'LISTEN',
      line: 'JOURNAL_SAVED',
    })
    expect(
      mamEventReaction(event, { ...ctx, daysSinceJournal: 2 }),
    ).toMatchObject({ intent: 'LISTEN' })
    expect(mamEventReaction(event, { ...ctx, daysSinceJournal: 3 })).toEqual({
      intent: 'ENCOURAGE',
      line: 'JOURNAL_RETURN',
    })
  })

  it('journal: a low picked mood comforts, as a dip after a good previous entry', () => {
    const low: MamEvent = { type: 'journal-saved', mood: 'LOW' }
    expect(mamEventReaction(low, ctx)).toEqual({
      intent: 'COMFORT',
      line: 'FIRST_LOW',
    })
    expect(
      mamEventReaction(
        { type: 'journal-saved', mood: 'VERY_LOW' },
        { ...ctx, previousJournalMood: 'GREAT', daysSinceJournal: 13 },
      ),
    ).toEqual({ intent: 'COMFORT', line: 'DIP_AFTER_GOOD' })
    expect(
      mamEventReaction(low, { ...ctx, previousJournalMood: 'OKAY' }),
    ).toMatchObject({ line: 'FIRST_LOW' })
    expect(
      mamEventReaction({ type: 'journal-saved', mood: 'OKAY' }, ctx),
    ).toMatchObject({ intent: 'LISTEN' })
  })

  it('support: encouragement, a soft celebration on every 3rd of the day only on a known calm', () => {
    const at = (supportToday: number, calm: boolean | null) =>
      mamEventReaction({ type: 'support-done' }, { ...ctx, supportToday, calm })
    expect(at(1, true)).toMatchObject({ intent: 'ENCOURAGE' })
    expect(at(2, true)).toMatchObject({ intent: 'ENCOURAGE' })
    expect(at(3, true)).toEqual({
      intent: 'CELEBRATE',
      grade: 'soft',
      line: 'SUPPORT_THIRD',
    })
    expect(at(6, true)).toMatchObject({ intent: 'CELEBRATE' })
    expect(at(3, false)).toMatchObject({ intent: 'ENCOURAGE' })
    expect(at(3, null)).toMatchObject({ intent: 'ENCOURAGE' })
  })

  it('resource: encouragement', () => {
    expect(mamEventReaction({ type: 'resource-done' }, ctx)).toEqual({
      intent: 'ENCOURAGE',
      line: 'RESOURCE_DONE',
    })
  })

  it('reassessment: lower cheers softly, equal listens, higher or moderate+ comforts and points to the guide', () => {
    const at = (
      band: 'LOWER' | 'SAME' | 'HIGHER',
      moderatePlus: boolean,
      calm: boolean | null = true,
    ) =>
      mamEventReaction(
        { type: 'reassessment-done', band, moderatePlus, id: 's' },
        { ...ctx, calm },
      )
    expect(at('LOWER', false)).toEqual({
      intent: 'CELEBRATE',
      grade: 'soft',
      line: 'REASSESSMENT_LOWER',
    })
    // An unknown calm never celebrates.
    expect(at('LOWER', false, null)).toEqual({
      intent: 'LISTEN',
      line: 'REASSESSMENT_SAME',
    })
    expect(at('LOWER', false, false)).toEqual({
      intent: 'LISTEN',
      line: 'REASSESSMENT_SAME',
    })
    expect(at('SAME', false)).toEqual({
      intent: 'LISTEN',
      line: 'REASSESSMENT_SAME',
    })
    expect(at('HIGHER', false)).toEqual({
      intent: 'COMFORT',
      line: 'REASSESSMENT_CARE',
    })
    // Moderate or higher never cheers, even when the band fell.
    expect(at('LOWER', true)).toEqual({
      intent: 'COMFORT',
      line: 'REASSESSMENT_CARE',
    })
    expect(at('SAME', true)).toEqual({
      intent: 'COMFORT',
      line: 'REASSESSMENT_CARE',
    })
  })

  it('leaves a check-in to the trajectory', () => {
    expect(
      mamEventReaction(
        {
          type: 'checkin-saved',
          emotion: 'LOW',
          intensity: 3,
          localDate: '2026-11-20',
        },
        ctx,
      ),
    ).toBeNull()
  })
})

describe('mamSpeaks', () => {
  it('answers on FULL and QUIET routes; a celebration needs FULL', () => {
    expect(mamSpeaks('quiet', 'COMFORT')).toBe(true)
    expect(mamSpeaks('quiet', 'ENCOURAGE')).toBe(true)
    expect(mamSpeaks('quiet', 'CELEBRATE')).toBe(false)
    expect(mamSpeaks('full', 'CELEBRATE')).toBe(true)
    expect(mamSpeaks('hidden', 'COMFORT')).toBe(false)
  })
})
