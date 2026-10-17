import { describe, expect, it } from 'vitest'
import {
  ConsultationInputError,
  parseAppointmentDispute,
  parseOpenAppointmentDisputeInput,
  parseResolveAppointmentDisputeInput,
} from './consultation-validation'

const dispute = {
  id: '40a7e5d8-7960-42fb-9706-e642f849b78f',
  appointmentId: '10a7e5d8-7960-42fb-9706-e642f849b78f',
  appointmentVersion: 4,
  status: 'OPEN',
  openedByRole: 'USER',
  reasonCode: 'OUTCOME_INCORRECT',
  evidenceType: null,
  evidenceOccurredAt: null,
  openedAt: '2099-09-27T04:00:00Z',
  eligibleUntil: '2099-09-28T04:00:00Z',
  settlementGated: true,
  resolutionOutcome: null,
  resolutionReason: null,
  resolvedAt: null,
  priorAppointmentStatus: null,
  priorSessionOutcome: null,
  resultingAppointmentStatus: null,
  resultingSessionOutcome: null,
  creditAction: null,
  version: 0,
}

describe('appointment dispute validation', () => {
  it('accepts the exact metadata-only response and rejects sensitive drift', () => {
    expect(parseAppointmentDispute(dispute)).toEqual(dispute)
    expect(parseAppointmentDispute({ ...dispute, notes: 'private' })).toBeNull()
    expect(
      parseAppointmentDispute({
        ...dispute,
        evidenceType: 'ACCESS_LOG',
        evidenceOccurredAt: null,
      }),
    ).toBeNull()
  })

  it('allows only bounded open and consistent resolution commands', () => {
    expect(
      parseOpenAppointmentDisputeInput({ reasonCode: 'TECHNICAL_FAILURE' }),
    ).toEqual({
      reasonCode: 'TECHNICAL_FAILURE',
      evidenceType: null,
      evidenceOccurredAt: null,
    })
    expect(() =>
      parseOpenAppointmentDisputeInput({
        reasonCode: 'TECHNICAL_FAILURE',
        notes: 'free text',
      }),
    ).toThrow(ConsultationInputError)
    expect(() =>
      parseResolveAppointmentDisputeInput({
        outcome: 'UPHOLD_RECORDED_OUTCOME',
        reasonCode: 'TECHNICAL_FAILURE_CONFIRMED',
      }),
    ).toThrow(ConsultationInputError)
  })
})
