import type { ResourceDetail } from './resource-contract'
import {
  localDateInTimeZone,
  recentLocalDates,
  resourceActions,
  resourceFormat,
  resourceTimerSeconds,
  structuredResourceContent,
} from './resource-model'

function detail(overrides: Partial<ResourceDetail> = {}): ResourceDetail {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    category: 'ARTICLE',
    resourceKind: 'LEARNING',
    interactionType: 'STRUCTURED_READER',
    repeatability: 'ONE_TIME',
    completionMode: 'EXPLICIT',
    streakEligible: false,
    expectedDurationMinutes: 7,
    cooldownDays: 0,
    recommendedFrequencyPerWeek: 1,
    planTags: ['DEPRESSIVE_SYMPTOMS'],
    locale: 'vi-VN',
    title: 'Bài đọc đã duyệt',
    summary: 'Tóm tắt đã duyệt.',
    externalUrl: null,
    sourceOrganization: 'MentalBridge',
    status: 'PUBLISHED',
    reviewedAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    contentVersion: '4',
    contentBody: 'Nội dung dự phòng.',
    sourceTitle: null,
    sourceUrl: null,
    sourceReviewNote: null,
    structuredContent: {},
    interactionConfig: {},
    safetyNotes: [],
    sourceRetrievedAt: null,
    sourceContentHash: null,
    contentVersionLabel: 'reviewed-v4',
    sourceReviewStatus: 'REVIEWED',
    effectiveAt: '2026-10-01T00:00:00.000Z',
    expiresAt: null,
    ...overrides,
  }
}

describe('reviewed resource presentation model', () => {
  it('renders only supported structured article content with a safe fallback', () => {
    const resource = detail({
      structuredContent: {
        overview: 'Tổng quan.',
        whenUseful: 'Khi cần một bước nhỏ.',
        keyIdeas: ['Ý chính 1', 42, 'Ý chính 2'],
        cautions: ['Dừng nếu không thoải mái.'],
        nextStep: 'Chọn bước phù hợp.',
        unsupportedAdminField: 'must not render',
      },
    })

    expect(structuredResourceContent(resource)).toEqual({
      overview: 'Tổng quan.',
      whenUseful: 'Khi cần một bước nhỏ.',
      keyIdeas: ['Ý chính 1', 'Ý chính 2'],
      steps: [],
      cautions: ['Dừng nếu không thoải mái.'],
      nextStep: 'Chọn bước phù hợp.',
    })
    expect(resourceFormat(resource)).toBe('Bài đọc')
  })

  it('uses only validated server step ids and bounded timer values', () => {
    const resource = detail({
      category: 'MEDITATION',
      resourceKind: 'PRACTICE',
      interactionType: 'PROGRESSIVE_RELAXATION',
      repeatability: 'REPEATABLE',
      completionMode: 'TIMED',
      interactionConfig: {
        durationSeconds: 120,
        steps: [
          { id: 'hands', label: 'Bàn tay', seconds: 20 },
          { id: 'unsafe id', label: 'Không hợp lệ' },
          { id: 'face', label: '', seconds: 20 },
        ],
      },
    })

    expect(resourceActions(resource)).toEqual([
      { id: 'hands', label: 'Bàn tay', seconds: 20 },
    ])
    expect(resourceTimerSeconds(resource)).toBe(120)
    expect(resourceFormat(resource)).toBe('Thực hành')
  })

  it('derives a bounded breathing timer from reviewed configuration', () => {
    const resource = detail({
      category: 'BREATHING',
      resourceKind: 'PRACTICE',
      interactionType: 'BREATHING_PACER',
      repeatability: 'REPEATABLE',
      completionMode: 'TIMED',
      interactionConfig: {
        inhaleSeconds: 4,
        holdSeconds: 0,
        exhaleSeconds: 5,
        cycles: 8,
      },
    })

    expect(resourceTimerSeconds(resource)).toBe(72)
  })

  it('keeps seven local dates stable across month boundaries', () => {
    expect(
      localDateInTimeZone(
        new Date('2026-10-01T00:30:00.000Z'),
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe('2026-10-01')
    expect(recentLocalDates('2026-10-01')).toEqual([
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ])
  })
})
