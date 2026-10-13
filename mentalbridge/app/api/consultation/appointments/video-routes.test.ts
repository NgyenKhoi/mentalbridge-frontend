import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'

const owner = vi.hoisted(() => ({
  videoSession: vi.fn(),
  videoAccess: vi.fn(),
  videoCompletion: vi.fn(),
}))
const identity = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))
vi.mock('@/lib/consultation/consultation-client', () => ({
  consultationClient: owner,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class extends Error {},
  ...identity,
}))
import { GET } from './[appointmentId]/video-session/route'
import { POST as access } from './[appointmentId]/video-access/route'
import { POST as complete } from '../specialist/appointments/[appointmentId]/video-completion/route'

const id = '11111111-1111-4111-8111-111111111111'
const context = { params: Promise.resolve({ appointmentId: id }) }
function request(
  path: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`http://localhost/api/consultation/${path}`, {
    method,
    headers: {
      cookie: 'mentalbridge_access=synthetic-access',
      ...headers,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
const commandHeaders = {
  'If-Match': '"2"',
  'Idempotency-Key': 'video-confirmation-synthetic',
}
describe('MB-384 video BFF authority', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    identity.resolveSession.mockResolvedValue({
      account: { roles: ['SPECIALIST'], status: 'ACTIVE', emailVerified: true },
    })
    for (const method of Object.values(owner))
      method.mockResolvedValue({
        data: { appointmentId: id },
        etag: '"3"',
        status: 200,
      })
  })
  it('allows only USER/SPECIALIST and keeps connection responses no-store', async () => {
    const response = await access(
      request(`appointments/${id}/video-access`, 'POST'),
      context,
    )
    expect(identity.ensureRole).toHaveBeenCalledWith(expect.anything(), [
      'USER',
      'SPECIALIST',
    ])
    expect(owner.videoAccess).toHaveBeenCalledWith(
      'synthetic-access',
      expect.any(String),
      id,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await GET(request(`appointments/${id}/video-session`), context)
    expect(owner.videoSession).toHaveBeenCalledWith(
      'synthetic-access',
      expect.any(String),
      id,
    )
  })
  it('rejects client room/actor fields and query authority before token issuance', async () => {
    for (const value of [{ roomName: 'other' }, { accountId: id }, {}]) {
      expect(
        (
          await access(
            request(`appointments/${id}/video-access`, 'POST', value),
            context,
          )
        ).status,
      ).toBe(400)
    }
    expect(
      (
        await access(
          request(`appointments/${id}/video-access?room=other`, 'POST'),
          context,
        )
      ).status,
    ).toBe(400)
    expect(owner.videoAccess).not.toHaveBeenCalled()
  })
  it('accepts a transport-created empty body stream without accepting payload bytes', async () => {
    const streamed = new NextRequest(
      `http://localhost/api/consultation/appointments/${id}/video-access`,
      {
        method: 'POST',
        body: '',
        headers: {
          cookie: 'mentalbridge_access=synthetic-access',
          'Content-Length': '0',
        },
      },
    )
    expect(streamed.body).not.toBeNull()
    expect((await access(streamed, context)).status).toBe(200)
    expect(owner.videoAccess).toHaveBeenCalledOnce()
    owner.videoAccess.mockClear()
    const nonempty = new NextRequest(
      `http://localhost/api/consultation/appointments/${id}/video-access`,
      {
        method: 'POST',
        body: ' ',
        headers: { cookie: 'mentalbridge_access=synthetic-access' },
      },
    )
    expect((await access(nonempty, context)).status).toBe(400)
    expect(owner.videoAccess).not.toHaveBeenCalled()
  })
  it('rejects unauthorized actors without reaching the owner', async () => {
    identity.ensureRole.mockImplementation(() => {
      throw new ApiError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Forbidden',
      })
    })
    expect(
      (
        await access(
          request(`appointments/${id}/video-access`, 'POST'),
          context,
        )
      ).status,
    ).toBe(403)
    expect(owner.videoAccess).not.toHaveBeenCalled()
  })
  it('requires strong revision and exact confirmation, not client evidence', async () => {
    const path = `specialist/appointments/${id}/video-completion`
    expect(
      (
        await complete(
          request(
            path,
            'POST',
            { confirmation: 'CONSULTATION_FINISHED' },
            { 'Idempotency-Key': commandHeaders['Idempotency-Key'] },
          ),
          context,
        )
      ).status,
    ).toBe(428)
    expect(
      (
        await complete(
          request(
            path,
            'POST',
            { confirmation: 'CONSULTATION_FINISHED', attendance: 60 },
            commandHeaders,
          ),
          context,
        )
      ).status,
    ).toBe(400)
    expect(owner.videoCompletion).not.toHaveBeenCalled()
  })
  it.each([202, 200])(
    'preserves owner %s for pending acceptance or replay',
    async (status) => {
      owner.videoCompletion.mockResolvedValue({
        data: { appointmentId: id, verificationState: 'PENDING_VERIFICATION' },
        etag: '"3"',
        status,
      })
      const response = await complete(
        request(
          `specialist/appointments/${id}/video-completion`,
          'POST',
          { confirmation: 'CONSULTATION_FINISHED' },
          commandHeaders,
        ),
        context,
      )
      expect(identity.ensureRole).toHaveBeenCalledWith(expect.anything(), [
        'SPECIALIST',
      ])
      expect(owner.videoCompletion).toHaveBeenCalledWith(
        'synthetic-access',
        expect.any(String),
        id,
        '"2"',
        'video-confirmation-synthetic',
      )
      expect(response.status).toBe(status)
      expect(response.headers.get('etag')).toBe('"3"')
      expect(response.headers.get('cache-control')).toBe('no-store')
    },
  )
})
