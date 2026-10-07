import { describe, expect, it } from 'vitest'
import {
  approvedProfile,
  draftAmendment,
} from '@/tests/fixtures/profile-amendment'
import {
  parseProfileAmendment,
  parseProfileAmendmentDetail,
  parseProfileAmendments,
} from './consultation-validation'

describe('profile amendment provider validation', () => {
  it('validates the full private draft and approved snapshot independently', () => {
    expect(parseProfileAmendment(draftAmendment)).toEqual(draftAmendment)
    expect(
      parseProfileAmendmentDetail({ approvedProfile, amendment: null }),
    ).not.toBeNull()
    expect(
      parseProfileAmendmentDetail({
        approvedProfile,
        amendment: draftAmendment,
      }),
    ).not.toBeNull()
  })
  it('rejects malformed review provenance, mismatched owners and incomplete drafts', () => {
    expect(
      parseProfileAmendment({ ...draftAmendment, status: 'APPROVED' }),
    ).toBeNull()
    expect(
      parseProfileAmendment({
        ...draftAmendment,
        reviewedAt: '2026-10-08T03:00:00Z',
      }),
    ).toBeNull()
    expect(
      parseProfileAmendment({
        ...draftAmendment,
        proposedProfile: { displayName: 'Name' },
      }),
    ).toBeNull()
    expect(
      parseProfileAmendmentDetail({
        approvedProfile: { ...approvedProfile, accountId: draftAmendment.id },
        amendment: draftAmendment,
      }),
    ).toBeNull()
    expect(
      parseProfileAmendments({
        items: [draftAmendment],
        count: 1,
        hasMore: false,
      }),
    ).toBeNull()
  })
})
