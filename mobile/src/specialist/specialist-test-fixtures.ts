import type {
  AvailabilitySlot,
  AvailabilitySlotList,
  SpecialistProfile,
} from './specialist-contract'

export function makeSpecialistProfile(
  overrides: Partial<SpecialistProfile> = {},
): SpecialistProfile {
  return {
    accountId: '11111111-1111-4111-8111-111111111111',
    displayName: 'Chuyên gia An',
    bio: 'Đồng hành dựa trên trải nghiệm và thực hành hỗ trợ an toàn.',
    supportAreas: ['ANXIETY_SYMPTOMS'],
    languages: ['vi'],
    yearsOfExperience: 5,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'PENDING',
    submittedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    decisionReasonCode: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    version: 1,
    ...overrides,
  }
}

export function makeAvailabilitySlot(
  overrides: Partial<AvailabilitySlot> = {},
): AvailabilitySlot {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    startAt: '2030-10-15T02:00:00.000Z',
    endAt: '2030-10-15T03:00:00.000Z',
    timezone: 'Asia/Ho_Chi_Minh',
    modality: 'IN_APP_CHAT',
    status: 'ACTIVE',
    readiness: 'AVAILABLE',
    withdrawnAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    version: 2,
    ...overrides,
  }
}

export function makeAvailabilityList(
  items: readonly AvailabilitySlot[] = [],
  videoPublishingEnabled = true,
): AvailabilitySlotList {
  return {
    items: [...items],
    count: items.length,
    generatedAt: '2026-10-09T00:00:00.000Z',
    videoPublishingEnabled,
  }
}
