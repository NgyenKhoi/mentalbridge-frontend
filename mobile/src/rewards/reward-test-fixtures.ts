import type {
  AchievementCollection,
  ResourceBingoBoard,
  ResourceBookmark,
  ResourceReward,
} from './reward-contract'

export const resourceId = '30000000-0000-4000-8000-000000000001'
export const secondResourceId = '30000000-0000-4000-8000-000000000002'

export const bookmark: ResourceBookmark = {
  resourceId,
  contentVersion: '4',
  savedAt: '2026-11-03T01:00:00.000Z',
  version: '1',
}

export const rewards: ResourceReward = {
  totalXp: 120,
  level: 2,
  nextLevelXp: 180,
  visibilityState: 'VISIBLE',
  preferenceVersion: '3',
  policyVersion: 'resource-reward-rules-v1',
  sourceAvailability: 'AVAILABLE',
  calculatedAt: '2026-11-03T02:00:00.000Z',
  recentGrants: [
    {
      grantId: 'grant-1',
      kind: 'VERIFIED_PRACTICE',
      xp: 20,
      resourceId,
      contentVersion: '4',
      localDate: '2026-11-03',
      grantedAt: '2026-11-03T02:00:00.000Z',
      sourceReference: 'practice-session-1',
      ruleVersion: 'resource-reward-rules-v1',
    },
  ],
}

export const achievements: AchievementCollection = {
  visibilityState: 'VISIBLE',
  preferenceVersion: '2',
  policyVersion: 'achievement-rules-v1',
  calculatedAt: '2026-11-03T02:00:00.000Z',
  sources: [
    {
      domain: 'RESOURCE',
      availability: 'AVAILABLE',
      asOfLocalDate: '2026-11-03',
    },
    {
      domain: 'JOURNAL',
      availability: 'UNAVAILABLE',
      asOfLocalDate: null,
    },
  ],
  items: [
    {
      definitionId: 'resource.first-completion',
      domain: 'RESOURCE',
      kind: 'MILESTONE',
      tier: 'FIRST_STEP',
      title: 'Tài nguyên đầu tiên',
      description: 'Một hoạt động đã được Content xác minh.',
      status: 'EARNED',
      evidenceClass: 'OWNER_SOURCE_FACT',
      unlockedAt: '2026-11-03T02:00:00.000Z',
      ruleVersion: 'achievement-rules-v1',
      privacy: 'PRIVATE',
      progress: null,
    },
    {
      definitionId: 'journal.first-entry',
      domain: 'JOURNAL',
      kind: 'MILESTONE',
      tier: 'FIRST_STEP',
      title: 'Trang viết đầu tiên',
      description: 'Nguồn Journal chưa thể xác minh.',
      status: 'SOURCE_UNAVAILABLE',
      evidenceClass: 'OWNER_SOURCE_FACT',
      unlockedAt: null,
      ruleVersion: 'achievement-rules-v1',
      privacy: 'PRIVATE',
      progress: null,
    },
  ],
}

export const bingo: ResourceBingoBoard = {
  weekStart: '2026-11-02',
  timeZone: 'Asia/Ho_Chi_Minh',
  version: '5',
  updatedAt: '2026-11-03T03:00:00.000Z',
  items: [
    {
      position: 1,
      resourceId,
      actionId: 'action-1',
      retired: false,
      contentVersion: '4',
      label: 'Thở chậm ba phút',
      evidence: 'NONE',
      selfConfirmedAt: null,
      verifiedAt: null,
      verificationSource: null,
    },
    {
      position: 2,
      resourceId: secondResourceId,
      actionId: 'action-2',
      retired: false,
      contentVersion: '2',
      label: 'Đi bộ nhẹ',
      evidence: 'CONTENT_VERIFIED',
      selfConfirmedAt: null,
      verifiedAt: '2026-11-03T03:00:00.000Z',
      verificationSource: 'PRACTICE_SESSION',
    },
    {
      position: 3,
      resourceId: '30000000-0000-4000-8000-000000000003',
      actionId: 'action-3',
      retired: true,
      contentVersion: '1',
      label: 'Hoạt động kế hoạch cũ',
      evidence: 'SELF_CONFIRMED',
      selfConfirmedAt: '2026-11-02T04:00:00.000Z',
      verifiedAt: null,
      verificationSource: null,
    },
  ],
}
