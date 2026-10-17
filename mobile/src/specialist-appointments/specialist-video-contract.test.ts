import { specialistAppointmentSchema } from './specialist-appointment-contract'
import {
  makeAppointment,
  APPOINTMENT_ID,
} from './specialist-appointment-test-fixtures'

it('accepts authoritative pending/verified video without accepting chat policy or releasing unverified credit', () => {
  const pending = makeAppointment({
    modality: 'IN_APP_VIDEO',
    status: 'SESSION_ENDED',
    sessionPolicyVersion: 'livekit-video-completion-v1',
    sessionEndedAt: '2030-10-15T02:30:00.000Z',
    creditState: 'HELD',
  })
  expect(specialistAppointmentSchema.safeParse(pending).success).toBe(true)
  expect(
    specialistAppointmentSchema.safeParse({
      ...pending,
      creditState: 'AVAILABLE',
    }).success,
  ).toBe(false)
  expect(
    specialistAppointmentSchema.safeParse({
      ...pending,
      sessionPolicyVersion: 'chat-session-completion-v1',
    }).success,
  ).toBe(false)
  const completed = {
    ...pending,
    status: 'COMPLETED',
    sessionOutcome: 'COMPLETED',
    sessionSettledAt: '2030-10-15T02:35:00.000Z',
    completionFactId: APPOINTMENT_ID,
    creditState: 'CONSUMED',
  }
  expect(specialistAppointmentSchema.safeParse(completed).success).toBe(true)
  expect(
    specialistAppointmentSchema.safeParse({
      ...completed,
      completionFactId: null,
    }).success,
  ).toBe(false)
})
