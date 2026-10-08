import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const client = vi.hoisted(() => ({
  ownAmendment: vi.fn(),
  startAmendment: vi.fn(),
  saveAmendment: vi.fn(),
  submitAmendment: vi.fn(),
  profileAmendments: vi.fn(),
  amendmentDetail: vi.fn(),
  decideAmendment: vi.fn(),
}))
const sessions = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))
vi.mock('./consultation-client', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  consultationClient: client,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class extends Error {},
  ...sessions,
}))
import { profileAmendmentRoute } from './profile-amendment-route'
import {
  approvedProfile,
  draftAmendment,
} from '@/tests/fixtures/profile-amendment'

function request(
  method = 'GET',
  headers: Record<string, string> = {},
  body?: unknown,
  query = '',
) {
  return new NextRequest(
    `http://localhost/api/consultation/specialist-profile/amendments${query}`,
    {
      method,
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=synthetic-access`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  )
}
describe('profile amendment BFF', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    sessions.resolveSession.mockResolvedValue({
      account: {
        accountId: approvedProfile.accountId,
        status: 'ACTIVE',
        roles: ['SPECIALIST'],
        emailVerified: true,
      },
    })
    Object.values(client).forEach((method) =>
      method.mockResolvedValue({ data: draftAmendment, etag: '"0"' }),
    )
  })
  it('requires SPECIALIST and carries the draft ETag without exposing bearer tokens', async () => {
    const response = await profileAmendmentRoute(
      request('POST', { 'If-Match': '"2"' }),
      'start',
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"0"')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(client.startAmendment).toHaveBeenCalledWith(
      'synthetic-access',
      expect.any(String),
      '"2"',
    )
    expect(sessions.ensureRole).toHaveBeenCalledWith(expect.anything(), [
      'SPECIALIST',
    ])
    expect(JSON.stringify(await response.json())).not.toContain(
      'synthetic-access',
    )
  })
  it('rejects missing versions, malformed ids, and invalid payloads before forwarding', async () => {
    expect((await profileAmendmentRoute(request('POST'), 'start')).status).toBe(
      428,
    )
    expect(
      (
        await profileAmendmentRoute(
          request('PUT', { 'If-Match': '"0"' }, draftAmendment.proposedProfile),
          'save',
          'bad',
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await profileAmendmentRoute(
          request(
            'PUT',
            { 'If-Match': '"0"' },
            { ...draftAmendment.proposedProfile, bio: '' },
          ),
          'save',
          draftAmendment.id,
        )
      ).status,
    ).toBe(422)
    expect(client.saveAmendment).not.toHaveBeenCalled()
  })
  it('requires ADMIN for a separate bounded queue and rejects unbounded paging', async () => {
    const response = await profileAmendmentRoute(
      request('GET', {}, undefined, '?page=2'),
      'queue',
    )
    expect(response.status).toBe(200)
    expect(sessions.ensureRole).toHaveBeenCalledWith(expect.anything(), [
      'ADMIN',
    ])
    expect(client.profileAmendments).toHaveBeenCalledWith(
      'synthetic-access',
      expect.any(String),
      2,
    )
    expect(
      (
        await profileAmendmentRoute(
          request('GET', {}, undefined, '?page=1001'),
          'queue',
        )
      ).status,
    ).toBe(422)
  })
  it('passes the exact reviewed version and only closed rejection reasons', async () => {
    const req = request(
      'POST',
      { 'If-Match': '"4"' },
      { reasonCode: 'PROFILE_CONTENT_NOT_APPROVED' },
    )
    expect(
      (await profileAmendmentRoute(req, 'reject', draftAmendment.id)).status,
    ).toBe(200)
    expect(client.decideAmendment).toHaveBeenCalledWith(
      'synthetic-access',
      expect.any(String),
      draftAmendment.id,
      'reject',
      '"4"',
      'PROFILE_CONTENT_NOT_APPROVED',
    )
    expect(
      (
        await profileAmendmentRoute(
          request(
            'POST',
            { 'If-Match': '"4"' },
            { reasonCode: 'POLICY_VIOLATION' },
          ),
          'reject',
          draftAmendment.id,
        )
      ).status,
    ).toBe(422)
  })
})
