// @vitest-environment node

import { http, HttpResponse } from 'msw'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import { mockServer } from '@/tests/mocks/server'

const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET } from './route'

const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}
const decision = (n: number, consentType: string, policyVersion: string) => ({
  decisionId: `30000000-0000-4000-8000-00000000000${n}`,
  consentType,
  policyVersion,
  granted: true,
  decidedAt: '2026-11-06T00:01:00Z',
})
const threeDecisions = [
  decision(1, 'PRIVACY_POLICY', 'privacy-capstone-v3'),
  decision(2, 'AI_PROCESSING', 'ai-processing-capstone-v2'),
  decision(3, 'AI_CONTEXT_PROCESSING', 'ai-context-processing-capstone-v1'),
]
const request = () =>
  new NextRequest('http://localhost/api/care/consents', {
    headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` },
  })

describe('GET /api/care/consents', () => {
  beforeEach(() => {
    vi.stubEnv('CARE_API_BASE_URL', 'http://care.test')
    sessionMocks.resolveSession.mockResolvedValue({ account })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('returns a three-decision collection that includes L2', async () => {
    mockServer.use(
      http.get('http://care.test/api/v1/consents', () =>
        HttpResponse.json({ decisions: threeDecisions }),
      ),
    )

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ decisions: threeDecisions })
  })

  it('still blocks a collection beyond the contract maximum', async () => {
    mockServer.use(
      http.get('http://care.test/api/v1/consents', () =>
        HttpResponse.json({
          decisions: [...threeDecisions, threeDecisions[0]],
        }),
      ),
    )

    expect((await GET(request())).status).toBe(502)
  })
})
