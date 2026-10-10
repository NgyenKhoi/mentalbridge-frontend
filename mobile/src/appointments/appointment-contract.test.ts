import {
  appointmentListSchema,
  appointmentSchema,
  bookableSlotsSchema,
  creditAccountSchema,
  requestAppointmentSchema,
} from './appointment-contract'
import { appointment, cancelled, credits, slot } from './appointment-fixtures'
import {
  appointmentLabel,
  changeCandidate,
  matchesFilter,
  sessionLabels,
} from './appointment-model'

describe('MB-630 public appointment/credit contracts', () => {
  it('accepts exact authoritative balance/cap without recalculating package or ledger', () => {
    const oldPolicy = {
      ...credits,
      policyVersion: 'consultation-credit-v1',
      balance: { ...credits.balance, total: 1, available: 1 },
      reservationCapacity: { active: 0, maximum: 1, remaining: 1 },
    }
    expect(
      creditAccountSchema.parse(oldPolicy).reservationCapacity.maximum,
    ).toBe(1)
    expect(
      creditAccountSchema.safeParse({ ...credits, actorId: credits.accountId })
        .success,
    ).toBe(false)
  })
  it('rejects non-60-minute/private/disabled-video and malformed snapshots', () => {
    expect(appointmentSchema.parse(cancelled).cancellationCreditOutcome).toBe(
      'RELEASED',
    )
    expect(
      appointmentSchema.safeParse({
        ...appointment,
        scheduledEndAt: appointment.scheduledStartAt,
      }).success,
    ).toBe(false)
    expect(
      appointmentSchema.safeParse({ ...appointment, status: 'RESCHEDULED' })
        .success,
    ).toBe(false)
    expect(
      appointmentSchema.safeParse({ ...appointment, version: -1 }).success,
    ).toBe(false)
    expect(
      bookableSlotsSchema.safeParse({
        items: [{ ...slot, modality: 'IN_APP_VIDEO' }],
        count: 1,
        generatedAt: credits.generatedAt,
        videoEnabled: false,
      }).success,
    ).toBe(false)
    expect(
      appointmentListSchema.safeParse({
        items: [appointment, appointment],
        count: 2,
        generatedAt: credits.generatedAt,
      }).success,
    ).toBe(false)
  })
  it.each([
    'actorId',
    'accountId',
    'creditId',
    'status',
    'score',
    'packageCode',
  ])('does not accept %s in submission', (field) => {
    expect(
      requestAppointmentSchema.safeParse({
        slotId: slot.id,
        modality: slot.modality,
        [field]: 'forged',
      }).success,
    ).toBe(false)
  })
  it.each(Object.keys(sessionLabels))(
    'renders authoritative session outcome %s',
    (value) => {
      const result = appointmentSchema.parse({
        ...appointment,
        status: 'SESSION_ENDED',
        sessionOutcome: value,
      })
      expect(sessionLabels[result.sessionOutcome!]).toBeTruthy()
      expect(matchesFilter(result, 'history')).toBe(true)
    },
  )
  it('uses server list time and lifecycle facts, not client time, for change candidates', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2099-01-01T00:00:00Z'))
    expect(
      changeCandidate(appointment, {
        items: [appointment],
        count: 1,
        generatedAt: credits.generatedAt,
      }),
    ).toBe(true)
    expect(
      changeCandidate(appointment, {
        items: [appointment],
        count: 1,
        generatedAt: '2026-10-16T00:00:00Z',
      }),
    ).toBe(false)
    expect(
      changeCandidate(cancelled, {
        items: [cancelled],
        count: 1,
        generatedAt: credits.generatedAt,
      }),
    ).toBe(false)
    expect(
      appointmentLabel({
        ...cancelled,
        cancellationReason: 'USER_RESCHEDULED',
      }),
    ).toBe('Đã đổi lịch')
    jest.restoreAllMocks()
  })
})
