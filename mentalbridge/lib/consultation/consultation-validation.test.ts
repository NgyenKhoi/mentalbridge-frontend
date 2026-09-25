import { describe, expect, it } from 'vitest'
import {
  ConsultationInputError,
  parseAvailabilitySlot,
  parseAvailabilitySlotList,
  parseAppointment,
  parseAppointmentList,
  parseAppointmentRequestInput,
  parseBookableSlotList,
  parseProfile,
  parseProfileInput,
  parsePublishAvailabilityInput,
  parseServiceCreditAccount,
} from './consultation-validation'

const profile = {
  accountId: 'f5297ec9-bbc9-4d51-8212-62778245335c',
  displayName: 'Nguyễn An',
  bio: 'Hỗ trợ phi lâm sàng',
  supportAreas: ['DEPRESSIVE_SYMPTOMS'],
  languages: ['vi'],
  yearsOfExperience: 4,
  timezone: 'Asia/Ho_Chi_Minh',
  approvalStatus: 'PENDING',
  submittedAt: null,
  reviewedAt: null,
  reviewedBy: null,
  decisionReasonCode: null,
  createdAt: '2026-09-14T03:00:00Z',
  updatedAt: '2026-09-14T03:00:00Z',
  version: 0,
}

describe('Consultation contract validation', () => {
  it('accepts only the approved specialist profile fields and enums', () => {
    expect(parseProfile(profile)).toEqual(profile)
    expect(
      parseProfile({ ...profile, supportAreas: ['CLINICAL_DIAGNOSIS'] }),
    ).toBeNull()
  })

  it('rejects unsupported language input before calling Consultation', () => {
    expect(() => parseProfileInput({ ...profile, languages: ['fr'] })).toThrow(
      ConsultationInputError,
    )
  })

  it('accepts exact 60-minute online availability and rejects contract drift', () => {
    const slot = {
      id: '1c12df8c-bdd7-4a14-9cd1-e9ce9d35d7f8',
      startAt: '2026-09-18T02:00:00Z',
      endAt: '2026-09-18T03:00:00Z',
      timezone: 'Asia/Ho_Chi_Minh',
      modality: 'IN_APP_CHAT',
      status: 'ACTIVE',
      readiness: 'AVAILABLE',
      withdrawnAt: null,
      createdAt: '2026-09-17T01:00:00Z',
      updatedAt: '2026-09-17T01:00:00Z',
      version: 0,
    }
    expect(parseAvailabilitySlot(slot)).toEqual(slot)
    expect(
      parseAvailabilitySlot({ ...slot, endAt: '2026-09-18T02:45:00Z' }),
    ).toBeNull()
    expect(parseAvailabilitySlot({ ...slot, modality: 'PHONE' })).toBeNull()
    expect(
      parseAvailabilitySlot({ ...slot, startAt: '2026-09-18T02:00:00+00:00' }),
    ).toBeNull()
    expect(
      parseAvailabilitySlotList({
        items: [slot],
        count: 1,
        generatedAt: '2026-09-17T01:00:00Z',
        videoPublishingEnabled: false,
      }),
    ).not.toBeNull()
  })

  it('rejects non-UTC, non-60-minute, and unsupported publish input', () => {
    const input = {
      startAt: '2026-09-18T02:00:00Z',
      endAt: '2026-09-18T03:00:00Z',
      timezone: 'Asia/Ho_Chi_Minh',
      modality: 'IN_APP_VIDEO',
    }
    expect(parsePublishAvailabilityInput(input)).toEqual(input)
    expect(() =>
      parsePublishAvailabilityInput({
        ...input,
        endAt: '2026-09-18T03:30:00Z',
      }),
    ).toThrow(ConsultationInputError)
    expect(() =>
      parsePublishAvailabilityInput({ ...input, modality: 'PHONE' }),
    ).toThrow(ConsultationInputError)
  })

  it('accepts a coherent authoritative credit balance and rejects derived drift', () => {
    const account = {
      accountId: 'f5297ec9-bbc9-4d51-8212-62778245335c',
      packageCode: 'PREMIUM',
      source: 'DEMO',
      sourceReference: 'controlled-demo-377',
      periodStart: '2026-09-20T00:00:00Z',
      periodEnd: '2026-10-20T00:00:00Z',
      policyVersion: 'consultation-credit-v2',
      balance: {
        available: 9,
        held: 1,
        consumed: 0,
        forfeited: 0,
        total: 10,
        releasedTransitions: 1,
      },
      reservationCapacity: {
        active: 2,
        maximum: 4,
        remaining: 2,
      },
      history: [
        {
          eventId: 'bb2a8b90-cbe9-4f1c-8a04-ef957fb9c673',
          creditId: '98435d70-438e-4fa5-b642-0456ea3f8747',
          eventType: 'HELD',
          source: 'DEMO',
          packageCode: 'PREMIUM',
          policyVersion: 'consultation-credit-v2',
          appointmentId: 'aa310a3a-209b-4698-9c24-42157bc345c7',
          occurredAt: '2026-09-20T01:00:00Z',
        },
      ],
      generatedAt: '2026-09-20T01:00:01Z',
    }
    expect(parseServiceCreditAccount(account)).toEqual(account)
    expect(
      parseServiceCreditAccount({
        ...account,
        balance: { ...account.balance, total: 2 },
      }),
    ).toBeNull()
    expect(
      parseServiceCreditAccount({ ...account, source: 'DEFAULT_FREE' }),
    ).toBeNull()
  })

  it('accepts online appointment snapshots and rejects physical or external modes', () => {
    const appointment = {
      id: '10a7e5d8-7960-42fb-9706-e642f849b78f',
      slotId: '43b7dbb4-021e-4c75-ae48-bfa7126c7256',
      specialistAccountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
      specialistDisplayName: 'Chuyên gia An',
      status: 'IN_PROGRESS',
      modality: 'IN_APP_CHAT',
      scheduledStartAt: '2026-09-25T02:00:00Z',
      scheduledEndAt: '2026-09-25T03:00:00Z',
      timezone: 'Asia/Ho_Chi_Minh',
      requestedAt: '2026-09-23T02:00:00Z',
      decisionDeadlineAt: '2026-09-24T02:00:00Z',
      heldCreditId: '96de7b84-14ae-46cd-bfa1-8314d1366b02',
      replacesAppointmentId: null,
    }
    expect(parseAppointment(appointment)).toEqual(appointment)
    expect(
      parseAppointment({ ...appointment, modality: 'IN_PERSON' }),
    ).toBeNull()
    expect(
      parseAppointmentList({
        items: [appointment],
        count: 1,
        generatedAt: '2026-09-23T02:00:01Z',
      }),
    ).not.toBeNull()
    expect(
      parseAppointmentRequestInput({
        slotId: appointment.slotId,
        modality: 'IN_APP_CHAT',
        replacesAppointmentId: appointment.id,
      }),
    ).toEqual({
      slotId: appointment.slotId,
      modality: 'IN_APP_CHAT',
      replacesAppointmentId: appointment.id,
    })
    expect(() =>
      parseAppointmentRequestInput({
        slotId: appointment.slotId,
        modality: 'PHONE',
      }),
    ).toThrow(ConsultationInputError)
  })

  it('accepts only exact online bookable slots', () => {
    const slot = {
      id: '43b7dbb4-021e-4c75-ae48-bfa7126c7256',
      specialistAccountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
      specialistDisplayName: 'Chuyên gia An',
      startAt: '2026-09-25T02:00:00Z',
      endAt: '2026-09-25T03:00:00Z',
      timezone: 'Asia/Ho_Chi_Minh',
      modality: 'IN_APP_CHAT',
    }
    expect(
      parseBookableSlotList({
        items: [slot],
        count: 1,
        generatedAt: '2026-09-23T02:00:00Z',
        videoEnabled: false,
      }),
    ).not.toBeNull()
    expect(
      parseBookableSlotList({
        items: [{ ...slot, modality: 'EXTERNAL_LINK' }],
        count: 1,
        generatedAt: '2026-09-23T02:00:00Z',
        videoEnabled: false,
      }),
    ).toBeNull()
  })
})
