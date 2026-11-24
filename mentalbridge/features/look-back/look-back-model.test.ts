import { describe, expect, it } from 'vitest'

import {
  asOf,
  conversation,
  makeDashboard,
  makeProgress,
} from '@/tests/fixtures/look-back'
import {
  composeLookBack,
  latestPerInstrument,
  latestScreeningLevels,
  narrativeFor,
  narrativeOfDashboard,
  windowDays,
} from './look-back-model'

const moods = (first: number, second: number) => [
  ...Array(7).fill(first),
  ...Array(7).fill(second),
]
const base = { conversations: [], progress: [], degraded: false }

describe('narrativeFor', () => {
  it.each([
    [14, 3, 3.5, 'IMPROVING'],
    [14, 3, 3.49, 'STEADY'],
    [14, 3, 2.51, 'STEADY'],
    [14, 3, 2.5, 'HARDER'],
    [14, 3.2, 3.2, 'STEADY'],
    [5, 3, 4, 'IMPROVING'],
    [4, 3, 4, 'SPARSE'],
    [14, null, 3, 'SPARSE'],
    [14, 3, null, 'SPARSE'],
  ] as const)('%i record days, weeks %s then %s is %s', (days, a, b, result) =>
    expect(narrativeFor(days, a, b)).toBe(result),
  )

  it('is not thrown off by floating point at the 0.5 edge', () => {
    expect(narrativeFor(14, 2.8, 3.3)).toBe('IMPROVING')
    expect(narrativeFor(14, 3.3, 2.8)).toBe('HARDER')
  })
})

describe('composeLookBack', () => {
  it('keeps the last 14 local days, split into two weeks', () => {
    const view = composeLookBack({
      ...base,
      dashboard: makeDashboard(moods(2, 4), { 0: { journals: 1 } }),
    })
    expect(view.days).toHaveLength(14)
    expect(view.asOfLocalDate).toBe(asOf)
    expect(view.startLocalDate).toBe('2026-11-09')
    expect(view.weeks[0]).toMatchObject({ moodAverage: 2, journalDays: 1 })
    expect(view.days[0]).toMatchObject({
      emotionLevel: 2,
      journalEntries: 1,
      supportCompleted: 0,
    })
    expect(view.weeks[1]).toMatchObject({ moodAverage: 4, journalDays: 0 })
    expect(view.narrative).toBe('IMPROVING')
    expect(view.nextStep).toBe('PLAN')
  })

  it('leaves days without a check-in as gaps, never as zeros', () => {
    const view = composeLookBack({
      ...base,
      dashboard: makeDashboard([
        3,
        null,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        null,
        3,
        3,
        3,
        3,
      ]),
    })
    expect(view.days[1].emotionLevel).toBeNull()
    expect(view.weeks[0].moodAverage).toBe(3)
    expect(view.weeks[0].checkInDays).toBe(6)
  })

  it('is SPARSE with fewer than five days of records and asks for a check-in', () => {
    const view = composeLookBack({
      ...base,
      dashboard: makeDashboard([3, null, null, 3, null, null, null, 3]),
    })
    expect(view.recordDays).toBe(3)
    expect(view.narrative).toBe('SPARSE')
    expect(view.nextStep).toBe('CHECK_IN')
  })

  it('buckets companion conversations into local days of the dashboard timezone', () => {
    const view = composeLookBack({
      ...base,
      dashboard: makeDashboard(moods(3, 3)),
      conversations: [
        // 17:30 UTC on the 21st is already the 22nd in Ho Chi Minh City.
        conversation('late', 'Tối muộn', '2026-11-21T17:30:00Z'),
        conversation('old', 'Quá cũ', '2026-11-08T12:00:00Z'),
        conversation('mid', '  ', '2026-11-15T03:00:00Z'),
        conversation('future', 'Chưa tới', '2026-11-22T17:30:00Z'),
      ],
    })
    expect(view.conversations).toEqual([
      { id: 'late', title: 'Tối muộn', localDate: '2026-11-22' },
      { id: 'mid', title: null, localDate: '2026-11-15' },
    ])
  })

  it('hides the conversation section when the list is unavailable', () => {
    const view = composeLookBack({
      ...base,
      dashboard: makeDashboard(moods(3, 3)),
      conversations: null,
    })
    expect(view.conversations).toBeNull()
    expect(view.partial).toBe(false)
  })

  it('reports partial for a partial dashboard or a degraded source, without inventing zeros', () => {
    const dashboard = makeDashboard(
      moods(3, 3),
      {},
      {
        partial: true,
        sources: {
          assessments: 'available',
          journals: 'unavailable',
          emotions: 'available',
          supportPlans: 'unavailable',
          appointments: 'unavailable',
        },
      },
    )
    const view = composeLookBack({ ...base, dashboard })
    expect(view.partial).toBe(true)
    expect(view.weeks[1]).toMatchObject({
      journalDays: null,
      supportCompleted: null,
      supportSkipped: null,
      checkInDays: 7,
    })
    expect(view.appointments).toBeNull()
    expect(
      composeLookBack({
        ...base,
        dashboard: makeDashboard(moods(3, 3)),
        degraded: true,
      }).partial,
    ).toBe(true)
  })

  it('keeps a screening pair that borders the window and sends moderate-or-above to support', () => {
    const view = composeLookBack({
      ...base,
      dashboard: makeDashboard(moods(3, 3)),
      progress: [
        makeProgress(
          'PHQ9',
          ['2026-11-01T09:00:00+07:00', 'MILD', 6],
          ['2026-11-21T09:00:00+07:00', 'MODERATE', 11],
        ),
      ],
    })
    expect(view.screening).toEqual([
      expect.objectContaining({
        instrument: 'PHQ9',
        direction: 'HIGHER',
        current: expect.objectContaining({ level: 'MODERATE' }),
      }),
    ])
    expect(view.professionalPointer).toBe(true)
    expect(view.nextStep).toBe('SUPPORT')
  })

  it('drops screenings whose latest is outside the window or whose earlier one is too old', () => {
    const view = composeLookBack({
      ...base,
      dashboard: makeDashboard(moods(3, 3)),
      progress: [
        makeProgress(
          'PHQ9',
          ['2026-08-01T09:00:00+07:00', 'MILD', 6],
          ['2026-11-21T09:00:00+07:00', 'MILD', 6],
        ),
        makeProgress(
          'GAD7',
          ['2026-10-20T09:00:00+07:00', 'MILD', 6],
          ['2026-11-05T09:00:00+07:00', 'MILD', 6],
        ),
      ],
    })
    expect(view.screening).toEqual([])
    expect(view.professionalPointer).toBe(false)
  })

  it('sends a harder fortnight to support even with a mild band', () => {
    const view = composeLookBack({
      ...base,
      dashboard: makeDashboard(moods(4, 3)),
      progress: [
        makeProgress(
          'GAD7',
          ['2026-11-10T09:00:00+07:00', 'MODERATE', 11],
          ['2026-11-21T09:00:00+07:00', 'MILD', 6],
        ),
      ],
    })
    expect(view.narrative).toBe('HARDER')
    expect(view.screening[0].direction).toBe('LOWER')
    expect(view.professionalPointer).toBe(false)
    expect(view.nextStep).toBe('SUPPORT')
  })
})

describe('moods that cannot be read, and SPARSE with a screening', () => {
  it('is UNKNOWN, partial and not blaming when the mood source is unavailable', () => {
    const dashboard = makeDashboard(moods(3, 3), {}, {})
    const view = composeLookBack({
      ...base,
      dashboard: {
        ...dashboard,
        sources: { ...dashboard.sources, emotions: 'unavailable' },
      },
    })
    expect(view.narrative).toBe('UNKNOWN')
    expect(view.partial).toBe(true)
    expect(view.weeks[0].moodAverage).toBeNull()
    expect(view.nextStep).toBe('PLAN')
  })

  it('keeps the screening and the professional pointer when the mood is SPARSE', () => {
    const view = composeLookBack({
      ...base,
      dashboard: makeDashboard([3, null, null, 3]),
      progress: [
        makeProgress(
          'PHQ9',
          ['2026-11-10T09:00:00+07:00', 'MILD', 7],
          ['2026-11-21T09:00:00+07:00', 'MODERATE', 11],
        ),
      ],
    })
    expect(view.narrative).toBe('SPARSE')
    expect(view.screening).toHaveLength(1)
    expect(view.professionalPointer).toBe(true)
    expect(view.nextStep).toBe('SUPPORT')
  })
})

describe('narrativeOfDashboard', () => {
  it('matches the narrative the composed view carries', () => {
    const dashboard = makeDashboard(moods(2, 4))
    expect(narrativeOfDashboard(dashboard)).toBe('IMPROVING')
    expect(composeLookBack({ ...base, dashboard }).narrative).toBe('IMPROVING')
  })
})

describe('latestPerInstrument', () => {
  it('keeps the newest assessment of each instrument', () => {
    const item = (
      assessmentId: string,
      instrument: string,
      submittedAt: string,
    ) => ({ assessmentId, instrument, submittedAt }) as never
    expect(
      latestPerInstrument([
        item('a', 'PHQ9', '2026-11-01T00:00:00Z'),
        item('b', 'PHQ9', '2026-11-20T00:00:00Z'),
        item('c', 'GAD7', '2026-11-10T00:00:00Z'),
      ]).map((entry) => entry.assessmentId),
    ).toEqual(['b', 'c'])
  })
})

describe('the latest band, with or without something to compare', () => {
  const summary = (instrument: string, level: string, submittedAt: string) =>
    ({
      assessmentId: `${instrument}-${submittedAt}`,
      instrument,
      submittedAt,
      result: { screeningLevel: level },
    }) as never

  it('reads the newest screening of each instrument', () => {
    expect(
      latestScreeningLevels([
        summary('PHQ9', 'SEVERE', '2026-10-01T00:00:00Z'),
        summary('PHQ9', 'MILD', '2026-11-20T00:00:00Z'),
        summary('GAD7', 'MODERATE', '2026-11-10T00:00:00Z'),
      ]),
    ).toEqual({ levels: ['MILD', 'MODERATE'], unknown: false })
  })

  it('marks a level it does not know, or a missing result, instead of guessing', () => {
    expect(
      latestScreeningLevels([
        summary('PHQ9', 'EXTREME', '2026-11-20T00:00:00Z'),
      ]).unknown,
    ).toBe(true)
    expect(
      latestScreeningLevels([
        {
          assessmentId: 'x',
          instrument: 'PHQ9',
          submittedAt: '2026-11-20T00:00:00Z',
        } as never,
      ]).unknown,
    ).toBe(true)
  })

  it('a FIRST moderate screening shows the professional pointer and points to support', () => {
    const view = composeLookBack({
      dashboard: makeDashboard(moods(2, 4)),
      ...base,
      latestLevels: ['MODERATE'],
    })
    expect(view.screening).toEqual([])
    expect(view.professionalPointer).toBe(true)
    expect(view.nextStep).toBe('SUPPORT')
  })

  it('a first mild screening shows no pointer', () => {
    const view = composeLookBack({
      dashboard: makeDashboard(moods(2, 4)),
      ...base,
      latestLevels: ['MILD'],
    })
    expect(view.professionalPointer).toBe(false)
  })

  describe('a chặng window', () => {
    // The fixture's 30 days end on asOf: 24/10 to 22/11, moods only in the last 14 (9/11 to 22/11).
    const dashboard = makeDashboard(moods(2, 4))

    it('looks at the chặng days, not the last 14', () => {
      const view = composeLookBack({
        dashboard,
        ...base,
        fromLocalDate: '2026-11-09',
        toLocalDate: '2026-11-15',
      })
      expect(view.startLocalDate).toBe('2026-11-09')
      expect(view.asOfLocalDate).toBe('2026-11-15')
      expect(view.days).toHaveLength(7)
      // Only the first week of the fixture's moods falls in it.
      expect(view.weeks[0].moodAverage).toBe(2)
      expect(view.weeks[1].moodAverage).toBeNull()
    })

    it('reads the narrative of the window, not of the last 14 days', () => {
      expect(narrativeOfDashboard(dashboard)).toBe('IMPROVING')
      const early = composeLookBack({
        dashboard,
        ...base,
        fromLocalDate: '2026-10-25',
        toLocalDate: '2026-11-07',
      })
      expect(early.narrative).toBe('SPARSE')
    })

    it('keeps only conversations that fall inside the window', () => {
      const view = composeLookBack({
        dashboard,
        conversations: [
          conversation('in', 'Trong', '2026-11-10T09:00:00+07:00'),
          conversation('out', 'Ngoài', '2026-11-20T09:00:00+07:00'),
        ],
        progress: [],
        degraded: false,
        fromLocalDate: '2026-11-09',
        toLocalDate: '2026-11-15',
      })
      expect(view.conversations?.map((item) => item.id)).toEqual(['in'])
    })

    it('uses the summary screening of the chặng, with no screening days, and points to a professional on a moderate band', () => {
      const view = composeLookBack({
        dashboard,
        ...base,
        fromLocalDate: '2026-11-09',
        toLocalDate: '2026-11-15',
        chapterScreening: [
          {
            instrument: 'PHQ9',
            previous: { instrument: 'PHQ9', level: 'MILD', score: 6 },
            current: { instrument: 'PHQ9', level: 'MODERATE', score: 11 },
            direction: 'INCREASED',
          },
          {
            instrument: 'GAD7',
            previous: null,
            current: { instrument: 'GAD7', level: 'MILD', score: 6 },
            direction: 'INSUFFICIENT_DATA',
          },
        ],
      })
      expect(view.screening).toEqual([
        {
          instrument: 'PHQ9',
          previous: {
            instrument: 'PHQ9',
            level: 'MILD',
            score: 6,
            localDate: null,
          },
          current: {
            instrument: 'PHQ9',
            level: 'MODERATE',
            score: 11,
            localDate: null,
          },
          direction: 'HIGHER',
        },
      ])
      expect(view.professionalPointer).toBe(true)
    })

    it('windowDays keeps the last 14 days of a longer chặng', () => {
      const days = windowDays(dashboard.daily, '2026-10-24', '2026-11-22')
      expect(days).toHaveLength(14)
      expect(days[0].localDate).toBe('2026-11-09')
    })
  })
})
