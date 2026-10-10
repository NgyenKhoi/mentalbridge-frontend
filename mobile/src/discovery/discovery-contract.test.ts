import {
  discoveryCriteriaSchema,
  discoveryItemSchema,
  discoveryPageSchema,
  discoverySlotSchema,
} from './discovery-contract'
import {
  fixturePage,
  fixtureSlot,
  fixtureSpecialist,
} from './discovery-fixtures'
import { selectedHandoff } from './discovery-model'

describe('Consultation v1.12.0 public discovery boundary', () => {
  it('accepts neutral FREE browsing without inferring booking eligibility', () => {
    expect(discoveryPageSchema.parse(fixturePage)).toEqual(fixturePage)
    expect(
      selectedHandoff(fixtureSpecialist, fixtureSlot, fixturePage)
        ?.bookingHandoff,
    ).toBe('BROWSE_ONLY')
  })
  it.each([
    'approvalStatus',
    'accountId',
    'credentials',
    'price',
    'location',
    'phone',
  ])('rejects private or unsupported field %s', (field) => {
    expect(
      discoveryItemSchema.safeParse({
        ...fixtureSpecialist,
        [field]: 'private',
      }).success,
    ).toBe(false)
  })
  it('requires public slot provenance and exactly 60 minutes', () => {
    expect(
      discoveryItemSchema.safeParse({
        ...fixtureSpecialist,
        selectableSlots: [
          { ...fixtureSlot, specialistAccountId: fixtureSlot.id },
        ],
      }).success,
    ).toBe(false)
    expect(
      discoverySlotSchema.safeParse({
        ...fixtureSlot,
        endAt: '2026-10-15T09:30:00Z',
      }).success,
    ).toBe(false)
    expect(
      discoveryItemSchema.safeParse({
        ...fixtureSpecialist,
        selectableSlots: [],
      }).success,
    ).toBe(false)
  })
  it('accepts capability-enabled video, rejects unsupported or disabled modalities', () => {
    const video = {
      ...fixtureSpecialist,
      selectableSlots: [{ ...fixtureSlot, modality: 'IN_APP_VIDEO' }],
    }
    expect(
      discoveryPageSchema.safeParse({
        ...fixturePage,
        items: [video],
        videoEnabled: true,
      }).success,
    ).toBe(true)
    expect(
      discoveryPageSchema.safeParse({ ...fixturePage, items: [video] }).success,
    ).toBe(false)
    expect(
      discoverySlotSchema.safeParse({ ...fixtureSlot, modality: 'PHONE' })
        .success,
    ).toBe(false)
  })
  it('rejects forged rating aggregates, counts and ranking versions', () => {
    expect(
      discoveryItemSchema.safeParse({
        ...fixtureSpecialist,
        ratingAggregate: { averageRating: 5, ratingCount: 0 },
      }).success,
    ).toBe(false)
    expect(
      discoveryPageSchema.safeParse({ ...fixturePage, count: 2 }).success,
    ).toBe(false)
    expect(
      discoveryPageSchema.safeParse({
        ...fixturePage,
        rankingPolicyVersion: 'local-ranking',
      }).success,
    ).toBe(false)
  })
  it('only accepts supported filter criteria, not health payloads or actor IDs', () => {
    expect(
      discoveryCriteriaSchema.parse({
        language: 'vi',
        modality: 'IN_APP_CHAT',
      }),
    ).toEqual({ language: 'vi', modality: 'IN_APP_CHAT' })
    for (const field of [
      'actorId',
      'accountId',
      'supportEvaluationId',
      'score',
      'journal',
      'q',
    ])
      expect(
        discoveryCriteriaSchema.safeParse({ [field]: 'private' }).success,
      ).toBe(false)
    expect(
      discoveryCriteriaSchema.safeParse({ timezone: 'invalid-zone' }).success,
    ).toBe(false)
  })
  it.each(['version', 'startAt', 'endAt', 'modality', 'timezone'])(
    'does not hand off changed slot %s',
    (field) => {
      const altered = {
        ...fixtureSlot,
        [field]: field === 'version' ? 1 : 'changed',
      }
      expect(
        selectedHandoff(
          { ...fixtureSpecialist, selectableSlots: [altered] },
          fixtureSlot,
          fixturePage,
        ),
      ).toBeNull()
    },
  )
})
