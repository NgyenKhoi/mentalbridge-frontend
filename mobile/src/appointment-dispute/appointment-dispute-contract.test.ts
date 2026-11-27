import {
  appointmentDisputeSchema,
  openAppointmentDisputeSchema,
} from './appointment-dispute-contract'
import { disputeFixture } from './appointment-dispute-fixtures'

describe('MB-726 appointment dispute contracts', () => {
  it('accepts the exact metadata-only response and rejects sensitive drift', () => {
    expect(appointmentDisputeSchema.parse(disputeFixture)).toEqual(
      disputeFixture,
    )
    for (const privateField of ['notes', 'chatExcerpt', 'openedByAccountId']) {
      expect(
        appointmentDisputeSchema.safeParse({
          ...disputeFixture,
          [privateField]: 'private',
        }).success,
      ).toBe(false)
    }
    expect(
      appointmentDisputeSchema.safeParse({
        ...disputeFixture,
        evidenceType: 'ACCESS_LOG',
      }).success,
    ).toBe(false)
  })

  it('requires complete and internally consistent resolution facts', () => {
    const resolved = {
      ...disputeFixture,
      status: 'RESOLVED',
      resolutionOutcome: 'RELEASE_USER_CREDIT',
      resolutionReason: 'TECHNICAL_FAILURE_CONFIRMED',
      resolvedAt: '2026-10-12T09:00:00Z',
      priorAppointmentStatus: 'COMPLETED',
      priorSessionOutcome: 'COMPLETED',
      resultingAppointmentStatus: 'COMPLETED',
      resultingSessionOutcome: 'COMPLETED',
      creditAction: 'ADJUSTED_RELEASED',
      version: 1,
    } as const
    expect(appointmentDisputeSchema.parse(resolved)).toEqual(resolved)
    for (const incomplete of [
      { resolutionOutcome: null },
      { resolutionReason: null },
      { resolvedAt: null },
      { creditAction: null },
    ]) {
      expect(
        appointmentDisputeSchema.safeParse({ ...resolved, ...incomplete })
          .success,
      ).toBe(false)
    }
    expect(
      appointmentDisputeSchema.safeParse({
        ...disputeFixture,
        resolutionOutcome: 'UPHOLD_RECORDED_OUTCOME',
      }).success,
    ).toBe(false)
  })

  it('accepts only a fixed reason with explicit null evidence', () => {
    expect(
      openAppointmentDisputeSchema.parse({
        reasonCode: 'TECHNICAL_FAILURE',
        evidenceType: null,
        evidenceOccurredAt: null,
      }),
    ).toEqual({
      reasonCode: 'TECHNICAL_FAILURE',
      evidenceType: null,
      evidenceOccurredAt: null,
    })
    for (const invalid of [
      { reasonCode: 'FREE_TEXT', evidenceType: null, evidenceOccurredAt: null },
      {
        reasonCode: 'TECHNICAL_FAILURE',
        evidenceType: null,
        evidenceOccurredAt: null,
        notes: 'private',
      },
      { reasonCode: 'TECHNICAL_FAILURE' },
      {
        reasonCode: 'TECHNICAL_FAILURE',
        evidenceType: 'ACCESS_LOG',
        evidenceOccurredAt: '2026-10-10T16:30:00Z',
      },
    ]) {
      expect(openAppointmentDisputeSchema.safeParse(invalid).success).toBe(
        false,
      )
    }
  })
})
