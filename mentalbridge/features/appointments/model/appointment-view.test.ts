import { describe, expect, it } from 'vitest'

import type { Appointment } from '@/lib/consultation/consultation-validation'
import {
  appointmentCreditLabel,
  appointmentModalityLabel,
  appointmentTimingCopy,
  canOpenChat,
  matchesAppointmentFilter,
  nextAppointment,
  orderAppointmentsForDisplay,
  orderSpecialistAppointments,
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

  it('keeps an ended session active only until its outcome is known', () => {
    const pending = appointment({
      id: 'p',
      status: 'SESSION_ENDED',
      scheduledStartAt: '2026-10-04T07:00:00Z',
    })
    const settled = appointment({
      id: 's',
      status: 'SESSION_ENDED',
      sessionOutcome: 'USER_NO_SHOW',
      scheduledStartAt: '2026-10-05T07:00:00Z',
    })
    const completed = appointment({
      id: 'c',
      status: 'COMPLETED',
      scheduledStartAt: '2026-10-01T07:00:00Z',
    })

    expect(
      orderAppointmentsForDisplay([completed, settled, pending]).map(
        (item) => item.id,
      ),
    ).toEqual(['p', 's', 'c'])
  })

  it('words the credit the same way for every viewer', () => {
    const label = (creditState: Appointment['creditState']) =>
      appointmentCreditLabel(appointment({ creditState }))

    expect(label('CONSUMED')).toBe('Đã dùng 1 buổi tư vấn')
    expect(label('HELD')).toBe('Buổi tư vấn đang được giữ cho lịch hẹn')
    expect(label('AVAILABLE')).toBe('Buổi tư vấn đã được hoàn lại')
  })

  it('opens a chat only for chat appointments that were confirmed', () => {
    const confirmedEvent = {
      eventId: 'e',
      fromStatus: 'REQUESTED',
      toStatus: 'CONFIRMED',
      actorType: 'SPECIALIST',
      actorId: null,
      reason: 'SPECIALIST_ACCEPTED',
      creditOutcome: null,
      occurredAt: '2026-10-01T09:00:00Z',
    } as const

    expect(canOpenChat(appointment({ status: 'REQUESTED' }))).toBe(false)
    expect(canOpenChat(appointment({ status: 'EXPIRED' }))).toBe(false)
    expect(
      canOpenChat(
        appointment({ status: 'CANCELLED', history: [confirmedEvent] }),
      ),
    ).toBe(true)
    expect(canOpenChat(appointment({ modality: 'IN_APP_VIDEO' }))).toBe(false)
  })

  it('orders the specialist list: in progress, upcoming, requests by deadline, ended, history', () => {
    const at = (id: string, over: Partial<Appointment>) =>
      appointment({ id, ...over })
    const ended = at('e', {
      status: 'SESSION_ENDED',
      scheduledStartAt: '2026-10-01T07:00:00Z',
    })
    const historyOld = at('h1', {
      status: 'COMPLETED',
      scheduledStartAt: '2026-09-01T07:00:00Z',
    })
    const historyNew = at('h2', {
      status: 'REJECTED',
      scheduledStartAt: '2026-09-20T07:00:00Z',
    })
    const lateRequest = at('r2', {
      status: 'REQUESTED',
      decisionDeadlineAt: '2026-10-05T07:00:00Z',
    })
    const soonRequest = at('r1', {
      status: 'REQUESTED',
      scheduledStartAt: '2026-12-01T07:00:00Z',
      decisionDeadlineAt: '2026-10-04T07:00:00Z',
    })
    const later = at('c2', {
      status: 'CONFIRMED',
      scheduledStartAt: '2026-10-09T07:00:00Z',
    })
    const sooner = at('c1', {
      status: 'CONFIRMED',
      scheduledStartAt: '2026-10-06T07:00:00Z',
    })
    const live = at('p', {
      status: 'IN_PROGRESS',
      scheduledStartAt: '2026-10-07T07:00:00Z',
    })

    expect(
      orderSpecialistAppointments([
        historyOld,
        ended,
        lateRequest,
        later,
        historyNew,
        soonRequest,
        sooner,
        live,
      ]).map((item) => item.id),
    ).toEqual(['p', 'c1', 'c2', 'r1', 'r2', 'e', 'h2', 'h1'])
  })
})

describe('appointmentModalityLabel', () => {
  it('maps every modality to Vietnamese and never echoes the enum', () => {
    expect(appointmentModalityLabel('IN_APP_CHAT')).toBe('Chat trực tuyến')
    expect(appointmentModalityLabel('IN_APP_VIDEO')).toBe('Gọi video')
    expect(appointmentModalityLabel(undefined)).toBe('Chat trực tuyến')
  })
})
