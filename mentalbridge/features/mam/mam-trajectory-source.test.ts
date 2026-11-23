import { describe, expect, it } from 'vitest'

import type { LookBack } from '@/features/look-back/look-back-model'

import { mamCheerable, toMamTrajectoryView } from './mam-trajectory-source'

const lookBack = (over: Partial<LookBack> = {}) =>
  ({
    asOfLocalDate: '2026-11-22',
    days: [{ localDate: '2026-11-22', emotionLevel: 4 }],
    narrative: 'STEADY',
    professionalPointer: false,
    screening: [],
    partial: false,
    conversations: [{ id: 'c', title: 'private chat title', localDate: 'x' }],
    ...over,
  }) as unknown as LookBack

describe('toMamTrajectoryView', () => {
  it('carries the level series and the band status, and nothing the user wrote', () => {
    const view = toMamTrajectoryView(lookBack(), false)
    expect(Object.keys(view).sort()).toEqual([
      'asOfLocalDate',
      'band',
      'days',
      'narrative',
      'partial',
    ])
    expect(JSON.stringify(view)).not.toContain('private chat title')
    expect(view.band).toEqual({
      readable: true,
      moderatePlus: false,
      transition: null,
    })
  })

  it('reports the last transition, with HIGHER over LOWER', () => {
    const screening = (direction: string) => ({ direction })
    const of = (...directions: string[]) =>
      toMamTrajectoryView(
        lookBack({ screening: directions.map(screening) as never }),
        false,
      ).band.transition
    expect(of('LOWER', 'SAME')).toBe('LOWER')
    expect(of('LOWER', 'HIGHER')).toBe('HIGHER')
    expect(of('SAME')).toBe('SAME')
  })
})

describe('mamCheerable', () => {
  const view = (over: Partial<LookBack> = {}, degraded = false) =>
    toMamTrajectoryView(lookBack(over), degraded)

  it('is true only for a readable, calm and complete look-back', () => {
    expect(mamCheerable(view())).toBe(true)
    expect(mamCheerable(view({ narrative: 'IMPROVING' }))).toBe(true)
  })

  it.each([
    ['harder', { narrative: 'HARDER' }],
    ['unreadable mood', { narrative: 'UNKNOWN' }],
    ['a moderate-or-higher band', { professionalPointer: true }],
    ['partial data', { partial: true }],
  ] as const)('is false for %s', (_name, over) => {
    expect(mamCheerable(view(over as Partial<LookBack>))).toBe(false)
  })

  it('is false when the band could not be read', () => {
    expect(mamCheerable(view({}, true))).toBe(false)
  })
})

describe('a first moderate screening', () => {
  it('is moderate-or-higher in the view and never cheerable', () => {
    // composeLookBack sets professionalPointer from the latest band, with nothing to compare.
    const view = toMamTrajectoryView(
      lookBack({ professionalPointer: true, screening: [] }),
      false,
    )
    expect(view.band).toEqual({
      readable: true,
      moderatePlus: true,
      transition: null,
    })
    expect(mamCheerable(view)).toBe(false)
  })
})
