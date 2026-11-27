import type {
  SpecialistAppointment,
  SpecialistAppointmentList,
} from './specialist-appointment-contract'

export const APPOINTMENT_ID = '11111111-1111-4111-8111-111111111111'
export const SPECIALIST_ID = '22222222-2222-4222-8222-222222222222'
export const USER_ID = '33333333-3333-4333-8333-333333333333'

export function makeAppointment(
  overrides: Partial<SpecialistAppointment> = {},
): SpecialistAppointment {
  return {
    id: APPOINTMENT_ID,
    slotId: '44444444-4444-4444-8444-444444444444',
    specialistAccountId: SPECIALIST_ID,
    specialistDisplayName: 'Chuyên gia An',
    status: 'REQUESTED',
    modality: 'IN_APP_CHAT',
    scheduledStartAt: '2030-10-15T02:00:00.000Z',
    scheduledEndAt: '2030-10-15T03:00:00.000Z',
    timezone: 'Asia/Ho_Chi_Minh',
    requestedAt: '2030-10-10T02:00:00.000Z',
    decisionDeadlineAt: '2030-10-12T02:00:00.000Z',
    heldCreditId: '55555555-5555-4555-8555-555555555555',
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
    history: [],
    version: 1,
    ...overrides,
  }
}

export function makeAppointmentList(
  items: SpecialistAppointment[] = [makeAppointment()],
  generatedAt = '2030-10-10T03:00:00.000Z',
): SpecialistAppointmentList {
  return { items, count: items.length, generatedAt }
}
