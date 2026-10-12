import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createResourceApi } from './resource-api'

const summary = {
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
  title: 'Hiểu cảm xúc của bạn',
  summary: 'Nội dung đã được rà soát.',
  externalUrl: null,
  sourceOrganization: 'MentalBridge',
  status: 'PUBLISHED',
  reviewedAt: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
} as const

const progress = {
  resourceId: summary.id,
  localDate: '2026-10-07',
  contentVersion: '4',
  status: 'COMPLETED',
  completedActionIds: [],
  completedAt: '2026-10-07T01:00:00.000Z',
  updatedAt: '2026-10-07T01:00:00.000Z',
  version: '1',
} as const

describe('Content mobile resources API contract', () => {
  it('uses public catalogue/detail paths with bounded filters and pagination', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data: request.url?.includes(summary.id)
          ? {
              ...summary,
              contentVersion: '4',
              contentBody: 'Nội dung bài đọc.',
              sourceTitle: null,
              sourceUrl: null,
              sourceReviewNote: null,
              structuredContent: { overview: 'Nội dung đã duyệt.' },
              interactionConfig: {},
              safetyNotes: [],
              sourceRetrievedAt: null,
              sourceContentHash: null,
              contentVersionLabel: 'reviewed-v4',
              sourceReviewStatus: 'REVIEWED',
              effectiveAt: '2026-10-01T00:00:00.000Z',
              expiresAt: null,
            }
          : { data: [summary], count: 1 },
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }
    const api = createResourceApi(create({ adapter }))

    await api.listResources({
      locale: 'vi-VN',
      category: 'ARTICLE',
      cursor: '22222222-2222-4222-8222-222222222222',
      limit: 20,
    })
    await api.getResource(summary.id, 'vi-VN')

    expect(requests[0]?.url).toBe('/api/v1/resources')
    expect(requests[0]?.params).toEqual({
      locale: 'vi-VN',
      category: 'ARTICLE',
      cursor: '22222222-2222-4222-8222-222222222222',
      limit: 20,
    })
    expect(requests[1]?.url).toBe(`/api/v1/resources/${summary.id}`)
    expect(requests[1]?.params).toEqual({ locale: 'vi-VN' })
  })

  it('saves owner progress without actor, score, adherence, or clinical fields', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data: request.method === 'put' ? progress : { items: [progress] },
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }
    const api = createResourceApi(create({ adapter }))

    await api.listProgress('2026-10-01', '2026-10-07')
    await api.saveProgress(summary.id, '2026-10-07', {
      status: 'COMPLETED',
      completedActionIds: [],
    })

    expect(requests[0]?.url).toBe('/api/v1/resource-progress')
    expect(requests[0]?.params).toEqual({
      from: '2026-10-01',
      to: '2026-10-07',
    })
    expect(requests[1]?.url).toBe(
      `/api/v1/resource-progress/${summary.id}/2026-10-07`,
    )
    const body = JSON.parse(String(requests[1]?.data))
    expect(body).toEqual({ status: 'COMPLETED', completedActionIds: [] })
    expect(body).not.toHaveProperty('accountId')
    expect(body).not.toHaveProperty('ownerId')
    expect(body).not.toHaveProperty('actorId')
    expect(body).not.toHaveProperty('supportPlanAdherence')
    expect(body).not.toHaveProperty('clinicalImprovement')
    expect(body).not.toHaveProperty('score')
  })

  it('rejects unpublished, unreviewed, or admin-enriched public resources', async () => {
    const adapter: AxiosAdapter = async (request) => ({
      config: request,
      data: {
        ...summary,
        status: 'DRAFT',
        reviewedBy: '33333333-3333-4333-8333-333333333333',
      },
      headers: {},
      status: 200,
      statusText: 'OK',
    })

    await expect(
      createResourceApi(create({ adapter })).getResource(summary.id, 'vi-VN'),
    ).rejects.toBeDefined()
  })
})
