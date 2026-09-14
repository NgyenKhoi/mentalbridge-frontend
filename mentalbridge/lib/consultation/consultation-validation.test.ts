import { describe, expect, it } from 'vitest'
import {
  ConsultationInputError,
  parseProfile,
  parseProfileInput,
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
})
