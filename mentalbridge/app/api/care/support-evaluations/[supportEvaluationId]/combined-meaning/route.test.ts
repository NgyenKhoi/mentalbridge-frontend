import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ getCombinedScreeningMeaning: vi.fn() }))
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

import { GET } from './route'

const supportEvaluationId = '10000000-0000-4000-8000-000000000003'
const account = {
  accountId: '10000000-0000-4000-8000-000000000009',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}

function request(id = supportEvaluationId) {
  return new NextRequest(
    `http://localhost/api/care/support-evaluations/${id}/combined-meaning`,
    { headers: { cookie: `${ACCESS_COOKIE_NAME}=server-access-secret` } },
  )
}

function context(id = supportEvaluationId) {
  return { params: Promise.resolve({ supportEvaluationId: id }) }
}

describe('GET exact support-evaluation combined meaning', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({ account })
  })

  it('uses the server credential, enforces USER, and disables caching', async () => {
    careMocks.getCombinedScreeningMeaning.mockResolvedValue({
      supportEvaluationId,
    })

    const response = await GET(request(), context())
    const body = await response.json()

    expect(sessionMocks.ensureRole).toHaveBeenCalledWith(account, ['USER'])
    expect(careMocks.getCombinedScreeningMeaning).toHaveBeenCalledWith(
      'server-access-secret',
      supportEvaluationId,
      expect.any(String),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(body).toEqual({ supportEvaluationId })
    expect(JSON.stringify(body)).not.toContain('server-access-secret')
    expect(body).not.toHaveProperty('accountId')
  })

  it('rejects a malformed ID before authentication or provider access', async () => {
    const response = await GET(request('invalid'), context('invalid'))

    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('VALIDATION_FAILED')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(sessionMocks.resolveSession).not.toHaveBeenCalled()
    expect(careMocks.getCombinedScreeningMeaning).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated request without provider access', async () => {
    sessionMocks.resolveSession.mockRejectedValue(
      new ApiError({
        code: 'SESSION_REQUIRED',
        status: 401,
        message: 'secret',
      }),
    )

    const response = await GET(request(), context())

    expect(response.status).toBe(401)
    expect((await response.json()).code).toBe('SESSION_REQUIRED')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(careMocks.getCombinedScreeningMeaning).not.toHaveBeenCalled()
  })

  it('rejects a wrong role before provider access', async () => {
    sessionMocks.ensureRole.mockImplementation(() => {
      throw new ApiError({ code: 'FORBIDDEN', status: 403, message: 'secret' })
    })

    const response = await GET(request(), context())

    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('FORBIDDEN')
    expect(careMocks.getCombinedScreeningMeaning).not.toHaveBeenCalled()
  })

  it.each([
    [404, 'SUPPORT_EVALUATION_NOT_FOUND'],
    [503, 'CARE_UNAVAILABLE'],
    [502, 'CARE_MALFORMED_RESPONSE'],
  ])(
    'preserves %s without disclosing private provider details',
    async (status, code) => {
      careMocks.getCombinedScreeningMeaning.mockRejectedValue(
        new ApiError({ status, code, message: 'private provider payload' }),
      )

      const response = await GET(request(), context())
      const body = await response.json()

      expect(response.status).toBe(status)
      expect(body.code).toBe(code)
      expect(JSON.stringify(body)).not.toContain('private provider payload')
      expect(response.headers.get('Cache-Control')).toBe('no-store')
    },
  )
})
