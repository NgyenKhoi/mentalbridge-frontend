import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ recordConsent: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({ careClient: careMocks }))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { POST } from './route'

const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}

function request(policyVersion = 'ai-processing-capstone-v1') {
  return new NextRequest('http://localhost/api/care/consent-decisions', {
    method: 'POST',
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=access-token`,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'consent-command-0001',
    },
    body: JSON.stringify({
      consentType: 'AI_PROCESSING',
      policyVersion,
      granted: true,
    }),
  })
}

describe('AI processing consent BFF', () => {
  beforeEach(() => {
    careMocks.recordConsent.mockReset()
    sessionMocks.resolveSession.mockReset()
    sessionMocks.ensureRole.mockReset()
    sessionMocks.resolveSession.mockResolvedValue({ account })
  })

  it('records only the current AI processing policy with server credentials', async () => {
    careMocks.recordConsent.mockResolvedValue({
      decisionId: '30000000-0000-4000-8000-000000000001',
      consentType: 'AI_PROCESSING',
      policyVersion: 'ai-processing-capstone-v1',
      granted: true,
      decidedAt: '2026-09-23T00:00:00Z',
    })

    const response = await POST(request())

    expect(response.status).toBe(201)
    expect(careMocks.recordConsent).toHaveBeenCalledWith(
      'access-token',
      {
        consentType: 'AI_PROCESSING',
        policyVersion: 'ai-processing-capstone-v1',
        granted: true,
      },
      'consent-command-0001',
      expect.any(String),
    )
  })

  it('rejects an outdated AI policy before calling Care', async () => {
    const response = await POST(request('ai-processing-capstone-v0'))

    expect(response.status).toBe(400)
    expect(careMocks.recordConsent).not.toHaveBeenCalled()
  })
})
