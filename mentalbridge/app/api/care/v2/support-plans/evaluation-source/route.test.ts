import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
const care = vi.hoisted(() => ({ currentScreeningEpisode: vi.fn() }))
const session = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))
vi.mock('@/lib/care/care-client', () => ({ careClient: care }))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class extends Error {},
  ...session,
}))
import { GET } from './route'
const sourceId = '10000000-0000-4000-8000-000000000641'
describe('Native proposal screening source BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.resolveSession.mockResolvedValue({
      account: { accountId: sourceId, roles: ['USER'] },
    })
  })
  function request(purpose = 'REASSESSMENT') {
    return new NextRequest(
      `http://localhost/api/care/v2/support-plans/evaluation-source?purpose=${purpose}`,
      { headers: { cookie: `${ACCESS_COOKIE_NAME}=server-only-token` } },
    )
  }
  it('returns only the completed canonical source, not the presentation evaluation or private session', async () => {
    care.currentScreeningEpisode.mockResolvedValue({
      purpose: 'REASSESSMENT',
      status: 'COMPLETED',
      supportEvaluationId: sourceId,
      presentationEvaluationId: 'other-id',
    })
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      sourceSupportEvaluationId: sourceId,
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(care.currentScreeningEpisode).toHaveBeenCalledWith(
      'server-only-token',
      'REASSESSMENT',
      expect.any(String),
    )
  })
  it('does not propose or invent a source while screening is incomplete', async () => {
    care.currentScreeningEpisode.mockResolvedValue({
      purpose: 'REASSESSMENT',
      status: 'READY',
      supportEvaluationId: null,
    })
    expect((await GET(request())).status).toBe(409)
    expect((await GET(request('force'))).status).toBe(400)
  })
})
