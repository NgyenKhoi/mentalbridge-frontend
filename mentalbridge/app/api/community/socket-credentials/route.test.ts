import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  credential: vi.fn(),
  failure: vi.fn(),
}))
vi.mock('@/lib/community/authenticated-user', () => ({
  authenticatedCommunityUser: mocks.user,
  carryCommunitySession: (response: Response) => response,
  communityAuthenticationFailure: mocks.failure,
}))
vi.mock('@/lib/realtime/server-client', () => ({
  realtimeServerClient: { communityCredential: mocks.credential },
  RealtimeServiceError: class extends Error {},
}))
import { POST } from './route'

describe('Community credential BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user.mockResolvedValue({ accessToken: 'server-only-identity-bearer' })
    mocks.credential.mockResolvedValue({
      schemaVersion: 1,
      namespace: '/community',
      credential: 'ephemeral-ticket'.repeat(3),
      expiresAt: '2099-01-01T00:00:00Z',
      endpoint: 'https://chat.example.test/',
    })
  })
  it('rejects cross-site requests before any credential can be issued', async () => {
    const response = await POST(
      new NextRequest(
        'https://web.example.test/api/community/socket-credentials',
        {
          method: 'POST',
          headers: { origin: 'https://attacker.example.test' },
        },
      ),
    )
    expect(response.status).toBe(403)
    expect(mocks.user).not.toHaveBeenCalled()
    expect(mocks.credential).not.toHaveBeenCalled()
  })
  it('does not let a browser select an actor or expiry', async () => {
    const response = await POST(
      new NextRequest(
        'https://web.example.test/api/community/socket-credentials',
        {
          method: 'POST',
          headers: { origin: 'https://web.example.test' },
          body: JSON.stringify({ subject: 'another-person' }),
        },
      ),
    )
    expect(response.status).toBe(400)
    expect(mocks.credential).not.toHaveBeenCalled()
  })
  it.each(['', '{}'])(
    'accepts an empty transport body %j without accepting an actor selector',
    async (body) => {
      const response = await POST(
        new NextRequest(
          'https://web.example.test/api/community/socket-credentials',
          {
            method: 'POST',
            headers: { origin: 'https://web.example.test' },
            body,
          },
        ),
      )
      expect(response.status).toBe(200)
    },
  )
  it('exchanges the verified server session and returns only a no-store one-use ticket', async () => {
    const response = await POST(
      new NextRequest(
        'https://web.example.test/api/community/socket-credentials',
        { method: 'POST', headers: { origin: 'https://web.example.test' } },
      ),
    )
    expect(response.status).toBe(200)
    expect(mocks.credential).toHaveBeenCalledWith(
      'server-only-identity-bearer',
      expect.any(String),
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.text()).not.toContain('server-only-identity-bearer')
  })
})
