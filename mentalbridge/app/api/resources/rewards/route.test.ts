import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const contentMocks = vi.hoisted(() => ({
  read: vi.fn(),
  setVisibility: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/content/content-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/content/content-client')>()),
  contentResourceRewardClient: contentMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET, PUT } from './route'

const reward = {
  totalXp: 0,
  level: 0,
  nextLevelXp: 10,
  visibilityState: 'VISIBLE',
  preferenceVersion: '0',
  policyVersion: 'resource-reward-v1',
  sourceAvailability: 'AVAILABLE',
  calculatedAt: '2026-10-12T05:00:00.000Z',
  recentGrants: [],
}

function request(method: 'GET' | 'PUT', body?: unknown) {
  return new NextRequest('http://localhost/api/resources/rewards', {
    method,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe('/api/resources/rewards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '10000000-0000-4000-8000-000000000009',
        roles: ['USER'],
      },
    })
  })

  it('reads rewards through the authenticated Content boundary', async () => {
    contentMocks.read.mockResolvedValue(reward)
    const response = await GET(request('GET'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(reward)
    expect(contentMocks.read).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.any(String),
    )
  })

  it('updates only the bounded visibility state', async () => {
    contentMocks.setVisibility.mockResolvedValue({
      ...reward,
      visibilityState: 'HIDDEN',
    })
    const response = await PUT(request('PUT', { visibilityState: 'HIDDEN' }))

    expect(response.status).toBe(200)
    expect(contentMocks.setVisibility).toHaveBeenCalledWith(
      'identity-access-secret',
      { visibilityState: 'HIDDEN' },
      expect.any(String),
    )
  })

  it('rejects unknown reward preference fields before Content is called', async () => {
    const response = await PUT(
      request('PUT', { visibilityState: 'VISIBLE', clinicalScore: 10 }),
    )

    expect(response.status).toBe(400)
    expect(contentMocks.setVisibility).not.toHaveBeenCalled()
  })
})
