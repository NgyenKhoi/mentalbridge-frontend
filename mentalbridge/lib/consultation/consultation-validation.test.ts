import { describe, expect, it } from 'vitest'
import {
  ConsultationInputError,
  parseAvailabilitySlot,
  parseAvailabilitySlotList,
  parseProfile,
  parseProfileInput,
  parsePublishAvailabilityInput,
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
})
