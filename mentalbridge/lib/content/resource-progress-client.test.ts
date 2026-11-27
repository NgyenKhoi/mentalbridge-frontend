import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  contentResourceJourneyClient,
  contentResourceProgressClient,
  contentResourceRewardClient,
  type ContentServiceError,
} from './content-client'

const resourceId = '00000000-0000-4000-8000-000000000201'
const otherResourceId = '00000000-0000-4000-8000-000000000202'
const localDate = '2026-09-29'

const progress = {
  resourceId,
  localDate,
  contentVersion: '7',
  status: 'COMPLETED',
  completedActionIds: ['overview-complete'],
  completedAt: '2026-09-29T02:15:00.000Z',
  updatedAt: '2026-09-29T02:15:00.000Z',
  version: '3',
}

const journey = {
  assignmentId: '00000000-0000-4000-8000-000000000301',
  localDate,
  planId: '00000000-0000-4000-8000-000000000302',
  planVersion: 7,
  planDay: 10,
  planStage: 'MAINTENANCE',
  items: [],
  progress: {
    dailyCompleted: 1,
    dailyTotal: 1,
    learningCompleted: 0,
    learningTotal: 0,
    practiceStreakDays: 4,
  },
  weekStart: '2026-09-28',
  bingo: [],
}

const reward = {
  totalXp: 15,
  level: 1,
  nextLevelXp: 40,
  visibilityState: 'VISIBLE',
  preferenceVersion: '0',
  policyVersion: 'resource-reward-v1',
  sourceAvailability: 'AVAILABLE',
  calculatedAt: '2026-09-29T02:16:00.000Z',
  recentGrants: [
    {
      grantId: 'a'.repeat(64),
      kind: 'RESOURCE_COMPLETION',
      xp: 10,
      resourceId,
      contentVersion: '7',
      localDate,
      grantedAt: '2026-09-29T02:15:00.000Z',
      sourceReference: `resource-progress:${resourceId}:${localDate}`,
      ruleVersion: 'resource-reward-v1',
    },
  ],
}

function upstream(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('content resource progress identity binding', () => {
  beforeEach(() => {
    process.env.CONTENT_SERVICE_URL = 'http://content.local:3003'
    process.env.CONTENT_SERVICE_TIMEOUT_MS = '5000'
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['another resource', { ...progress, resourceId: otherResourceId }],
    ['another local date', { ...progress, localDate: '2026-09-28' }],
  ])('fails closed when a save returns %s', async (_case, response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(response)))

    await expect(
      contentResourceProgressClient.save(
        'owner-token',
        resourceId,
        localDate,
        {
          status: 'COMPLETED',
          completedActionIds: ['overview-complete'],
        },
        'correlation',
      ),
    ).rejects.toMatchObject({
      code: 'CONTENT_MALFORMED_RESPONSE',
      status: 502,
    } satisfies Partial<ContentServiceError>)
  })

  it('fails closed when a journey returns another local date', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(upstream({ ...journey, localDate: '2026-09-28' })),
    )

    await expect(
      contentResourceJourneyClient.materialize(
        'owner-token',
        localDate,
        {
          timeZone: 'Asia/Ho_Chi_Minh',
          supportPlan: {
            supportPlanId: '00000000-0000-4000-8000-000000000401',
            version: 3,
            status: 'ACTIVE',
            activatedAt: '2026-09-20T00:00:00.000Z',
            domains: ['ANXIETY_SYMPTOMS'],
            selectedResourceIds: [resourceId],
          },
        },
        'correlation',
      ),
    ).rejects.toMatchObject({
      code: 'CONTENT_MALFORMED_RESPONSE',
      status: 502,
    } satisfies Partial<ContentServiceError>)
  })

  it('accepts exact reward provenance and fails closed on malformed grants', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(upstream(reward))
      .mockResolvedValueOnce(
        upstream({
          ...reward,
          recentGrants: [{ ...reward.recentGrants[0], resourceId: 'other' }],
        }),
      )
    vi.stubGlobal('fetch', fetch)

    await expect(
      contentResourceRewardClient.read('owner-token', 'correlation'),
    ).resolves.toEqual(reward)
    await expect(
      contentResourceRewardClient.read('owner-token', 'correlation'),
    ).rejects.toMatchObject({
      code: 'CONTENT_MALFORMED_RESPONSE',
      status: 502,
    } satisfies Partial<ContentServiceError>)
  })

  it('sends an exact visibility replacement', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(upstream({ ...reward, visibilityState: 'HIDDEN' }))
    vi.stubGlobal('fetch', fetch)

    await contentResourceRewardClient.setVisibility(
      'owner-token',
      { visibilityState: 'HIDDEN' },
      'correlation',
    )
    expect(fetch).toHaveBeenCalledWith(
      new URL('http://content.local:3003/api/v1/resource-rewards'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ visibilityState: 'HIDDEN' }),
      }),
    )
  })
})
