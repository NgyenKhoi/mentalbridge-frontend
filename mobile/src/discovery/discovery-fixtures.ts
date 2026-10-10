import type {
  DiscoveryItem,
  DiscoveryPage,
  DiscoverySlot,
} from './discovery-contract'

export const specialistId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
export const fixtureSlot: DiscoverySlot = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  specialistAccountId: specialistId,
  startAt: '2026-10-15T09:00:00Z',
  endAt: '2026-10-15T10:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  modality: 'IN_APP_CHAT',
  version: 0,
}
export const fixtureSpecialist: DiscoveryItem = {
  specialistAccountId: specialistId,
  displayName: 'Chuyên gia tổng hợp',
  bio: 'Hồ sơ tổng hợp chỉ dùng trong kiểm thử.',
  supportAreas: ['ANXIETY_SYMPTOMS'],
  languages: ['vi'],
  yearsOfExperience: 5,
  timezone: 'Asia/Ho_Chi_Minh',
  ratingAggregate: null,
  explanation: {
    compatibility: 'NEUTRAL',
    languageMatched: null,
    hasSelectableSlot: true,
    earliestSelectableStartAt: fixtureSlot.startAt,
    timezoneMatch: 'NOT_REQUESTED',
    timezoneOffsetDistanceMinutes: null,
    ratingTieBreakerApplied: false,
    codes: [
      'NO_SCREENING_CONTEXT',
      'NO_REQUESTED_LANGUAGE',
      'SELECTABLE_SLOT_AVAILABLE',
      'NO_REQUESTED_TIMEZONE',
    ],
  },
  selectableSlots: [fixtureSlot],
}
export const fixturePage: DiscoveryPage = {
  items: [fixtureSpecialist],
  count: 1,
  nextCursor: null,
  rankingPolicyVersion: 'specialist-discovery-v2',
  generatedAt: '2026-10-10T09:00:00Z',
  contextState: 'NOT_REQUESTED',
  packageCode: 'FREE',
  bookingHandoff: 'BROWSE_ONLY',
  videoEnabled: false,
}
