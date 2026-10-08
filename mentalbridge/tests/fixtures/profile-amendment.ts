import type {
  ProfileAmendment,
  SpecialistProfile,
} from '@/lib/consultation/consultation-validation'

export const approvedProfile: SpecialistProfile = {
  accountId: 'f5297ec9-bbc9-4d51-8212-62778245335c',
  displayName: 'Chuyên gia An',
  bio: 'Đồng hành sức khỏe tinh thần.',
  supportAreas: ['ANXIETY_SYMPTOMS'],
  languages: ['vi'],
  yearsOfExperience: 4,
  timezone: 'Asia/Ho_Chi_Minh',
  approvalStatus: 'APPROVED',
  submittedAt: '2026-10-01T03:00:00Z',
  reviewedAt: '2026-10-02T03:00:00Z',
  reviewedBy: 'f5297ec9-bbc9-4d51-8212-627782453350',
  decisionReasonCode: null,
  createdAt: '2026-09-30T03:00:00Z',
  updatedAt: '2026-10-02T03:00:00Z',
  version: 2,
  publishedVersion: 1,
}
export const draftAmendment: ProfileAmendment = {
  id: 'f5297ec9-bbc9-4d51-8212-627782453351',
  specialistAccountId: approvedProfile.accountId,
  basePublishedVersion: 1,
  status: 'DRAFT',
  proposedProfile: {
    displayName: 'Chuyên gia Bình',
    bio: approvedProfile.bio,
    supportAreas: approvedProfile.supportAreas,
    languages: ['vi'],
    yearsOfExperience: 5,
    timezone: approvedProfile.timezone,
  },
  submittedAt: null,
  reviewedAt: null,
  reviewedBy: null,
  reasonCode: null,
  createdAt: '2026-10-07T03:00:00Z',
  updatedAt: '2026-10-07T03:00:00Z',
  version: 0,
}
