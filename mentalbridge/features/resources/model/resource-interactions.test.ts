import { describe, expect, it } from 'vitest'

import type { PublicResourceDetail } from '../api/browser-resources'
import { resourceInteraction } from './resource-interactions'

function resource(
  interactionType: PublicResourceDetail['interactionType'],
  interactionConfig: Record<string, unknown> = {},
): PublicResourceDetail {
  return {
    id: '00000000-0000-4000-8000-000000000201',
    category: 'MEDITATION',
    resourceKind: 'PRACTICE',
    interactionType,
    repeatability: 'REPEATABLE',
    completionMode: 'STEPS',
    streakEligible: true,
    expectedDurationMinutes: 5,
    cooldownDays: 0,
    recommendedFrequencyPerWeek: 7,
    planTags: ['ANXIETY_SYMPTOMS'],
    locale: 'vi-VN',
    title: 'Test',
    summary: 'Test',
    externalUrl: null,
    sourceOrganization: null,
    status: 'PUBLISHED',
    reviewedAt: '2026-09-30T00:00:00.000Z',
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z',
    contentVersion: '1',
    contentBody: 'Test',
    sourceTitle: null,
    sourceUrl: null,
    sourceReviewNote: null,
    effectiveAt: null,
    expiresAt: null,
    structuredContent: {},
    interactionConfig,
    safetyNotes: [],
    sourceRetrievedAt: null,
    sourceContentHash: null,
    contentVersionLabel: 'test',
    sourceReviewStatus: 'REVIEWED',
  }
}

describe('resourceInteraction', () => {
  it('never renders an unknown or grounding interaction as breathing', () => {
    expect(resourceInteraction(resource('GROUNDING_GUIDE')).mode).toBe('reader')
    expect(resourceInteraction(resource('STRUCTURED_READER')).mode).toBe(
      'reader',
    )
  })

  it('uses reviewed configured steps for a grounding guide', () => {
    const interaction = resourceInteraction(
      resource('GROUNDING_GUIDE', {
        steps: [{ id: 'see', label: 'Nhận biết điều đang thấy' }],
      }),
    )
    expect(interaction.mode).toBe('steps')
    expect(interaction.actions).toEqual([
      { id: 'see', label: 'Nhận biết điều đang thấy' },
    ])
  })
})
