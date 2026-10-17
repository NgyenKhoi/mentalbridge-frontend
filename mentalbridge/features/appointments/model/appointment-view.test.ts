import { describe, expect, it } from 'vitest'

import type { Appointment } from '@/lib/consultation/consultation-validation'
import {
  appointmentTimingCopy,
  matchesAppointmentFilter,
  nextAppointment,
  orderAppointmentsForDisplay,
} from './appointment-view'

const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: '11111111-1111-4111-8111-111111111111',
  slotId: '22222222-2222-4222-8222-222222222222',
  specialistAccountId: '33333333-3333-4333-8333-333333333333',
  specialistDisplayName: 'Chuyên gia',
  status: 'CONFIRMED',
  modality: 'IN_APP_CHAT',
  scheduledStartAt: '2026-10-03T07:00:00Z',
  scheduledEndAt: '2026-10-03T08:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requestedAt: '2026-10-01T07:00:00Z',
  decisionDeadlineAt: '2026-10-02T07:00:00Z',
  heldCreditId: '44444444-4444-4444-8444-444444444444',
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
  version: 0,
  ...overrides,
})

describe('appointment view', () => {
  const now = Date.parse('2026-10-02T08:00:00Z')

  it('groups business statuses into the four user-facing filters', () => {
    expect(matchesAppointmentFilter(appointment(), 'upcoming', now)).toBe(true)
    expect(
      matchesAppointmentFilter(
        appointment({ status: 'REQUESTED' }),
        'requested',
        now,
      ),
    ).toBe(true)
    expect(
      matchesAppointmentFilter(
        appointment({ status: 'CANCELLED' }),
        'history',
        now,
      ),
    ).toBe(true)
  })

  it('selects the nearest confirmed or active appointment', () => {
    const later = appointment({
      id: '55555555-5555-4555-8555-555555555555',
      scheduledStartAt: '2026-10-04T07:00:00Z',
      scheduledEndAt: '2026-10-04T08:00:00Z',
    })
    expect(nextAppointment([later, appointment()], now)?.id).toBe(
      appointment().id,
    )
  })

  it('uses the appointment status instead of inferring chat authority locally', () => {
    expect(appointmentTimingCopy(appointment())).toBe(
      'Buổi tư vấn đã được xác nhận',
    )
    expect(appointmentTimingCopy(appointment({ status: 'IN_PROGRESS' }))).toBe(
      'Phiên nhắn tin đang diễn ra',
    )
  })

  it('orders actionable appointments first and history from newest to oldest', () => {
    const requested = appointment({
      id: '55555555-5555-4555-8555-555555555555',
      status: 'REQUESTED',
      scheduledStartAt: '2026-10-02T10:00:00Z',
    })
    const olderHistory = appointment({
      id: '66666666-6666-4666-8666-666666666666',
      status: 'COMPLETED',
      scheduledStartAt: '2026-09-01T07:00:00Z',
    })
    const newerHistory = appointment({
      id: '77777777-7777-4777-8777-777777777777',
      status: 'CANCELLED',
      scheduledStartAt: '2026-09-12T07:00:00Z',
    })

    expect(
      orderAppointmentsForDisplay([
        olderHistory,
        appointment(),
        newerHistory,
        requested,
      ]).map((item) => item.id),
    ).toEqual([
      requested.id,
      appointment().id,
      newerHistory.id,
      olderHistory.id,
    ])
  })
})
