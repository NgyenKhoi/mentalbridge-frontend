import {
  fixturePage,
  fixtureSlot,
  fixtureSpecialist,
} from '@/discovery/discovery-fixtures'
import type { SlotSelection } from '@/discovery/discovery-model'

import type { Appointment, CreditAccount } from './appointment-contract'

export const subject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const appointmentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
export const credits: CreditAccount = {
  accountId: subject,
  packageCode: 'PLUS',
  source: 'DEMO',
  sourceReference: 'synthetic-test',
  periodStart: '2026-10-01T00:00:00Z',
  periodEnd: '2026-11-01T00:00:00Z',
  policyVersion: 'consultation-credit-v2',
  balance: {
    available: 4,
    held: 0,
    consumed: 0,
    forfeited: 0,
    total: 4,
    releasedTransitions: 0,
  },
  reservationCapacity: { active: 0, maximum: 2, remaining: 2 },
  history: [],
  generatedAt: '2026-10-10T09:00:00Z',
}
export const appointment: Appointment = {
  id: appointmentId,
  slotId: fixtureSlot.id,
  specialistAccountId: fixtureSpecialist.specialistAccountId,
  specialistDisplayName: fixtureSpecialist.displayName,
  status: 'REQUESTED',
  modality: 'IN_APP_CHAT',
  scheduledStartAt: fixtureSlot.startAt,
  scheduledEndAt: fixtureSlot.endAt,
  timezone: fixtureSlot.timezone,
  requestedAt: '2026-10-10T09:00:00Z',
  decisionDeadlineAt: '2026-10-11T09:00:00Z',
  heldCreditId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  replacesAppointmentId: null,
  replacedByAppointmentId: null,
  decidedAt: null,
  decisionReason: null,
  cancelledAt: null,
  cancellationReason: null,
  cancellationActor: null,
  cancellationCreditOutcome: null,
  sessionOutcome: null,
  sessionOutcomeReason: null,
  sessionPolicyVersion: null,
  sessionEndedAt: null,
  sessionSettledAt: null,
  completionFactId: null,
  creditState: 'HELD',
  version: 0,
  history: [
    {
      eventId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      fromStatus: null,
      toStatus: 'REQUESTED',
      actorType: 'USER',
      actorId: subject,
      reason: 'APPOINTMENT_REQUESTED',
      creditOutcome: null,
      occurredAt: '2026-10-10T09:00:00Z',
    },
  ],
}
export const selection: SlotSelection = {
  specialist: fixtureSpecialist,
  slot: fixtureSlot,
  bookingHandoff: 'BOOKING_POLICY_CHECK_REQUIRED',
}
export const page = {
  ...fixturePage,
  packageCode: 'PLUS' as const,
  bookingHandoff: 'BOOKING_POLICY_CHECK_REQUIRED' as const,
}
export const slot = {
  id: fixtureSlot.id,
  specialistAccountId: fixtureSlot.specialistAccountId,
  specialistDisplayName: fixtureSpecialist.displayName,
  startAt: fixtureSlot.startAt,
  endAt: fixtureSlot.endAt,
  timezone: fixtureSlot.timezone,
  modality: fixtureSlot.modality,
}
export const cancelled: Appointment = {
  ...appointment,
  status: 'CANCELLED',
  cancelledAt: '2026-10-10T10:00:00Z',
  cancellationReason: 'USER_CANCELLED',
  cancellationActor: 'USER',
  cancellationCreditOutcome: 'RELEASED',
  creditState: 'AVAILABLE',
  version: 1,
}
