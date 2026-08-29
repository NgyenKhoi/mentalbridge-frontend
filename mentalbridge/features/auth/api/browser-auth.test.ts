import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { mockServer } from '@/tests/mocks/server'

import {
  registerAccount,
  registrationErrorMessage,
  loginAndResolveWorkspace,
  loginErrorMessage,
  terminateSession,
  verificationErrorMessage,
  verifyEmailChallenge,
} from './browser-auth'

const activeAccount = {
  accountId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
  status: 'ACTIVE',
  roles: ['SPECIALIST', 'USER'],
  emailVerified: true,
}

describe('browser authentication', () => {
  it('submits registration through the BFF with the caller idempotency key', async () => {
    const received = vi.fn()
    mockServer.use(
      http.post(
        'http://localhost/api/identity/register',
        async ({ request }) => {
          received({
            body: await request.json(),
            key: request.headers.get('Idempotency-Key'),
          })
          return HttpResponse.json(
            { registrationPending: true },
            { status: 201 },
          )
        },
      ),
    )

    await registerAccount(
      {
        email: 'member@example.com',
        password: 'correct horse battery staple',
        actorType: 'SPECIALIST',
      },
      'registration-key-0001',
    )

    expect(received).toHaveBeenCalledWith({
      body: {
        email: 'member@example.com',
        password: 'correct horse battery staple',
        actorType: 'SPECIALIST',
      },
      key: 'registration-key-0001',
    })
  })

  it('submits a verification challenge only to the verification BFF', async () => {
    const received = vi.fn()
    mockServer.use(
      http.post(
        'http://localhost/api/identity/email-verification',
        async ({ request }) => {
          received(await request.json())
          return HttpResponse.json({ verified: true })
        },
      ),
    )
    const challenge = 'v'.repeat(32)

    await verifyEmailChallenge(challenge)

    expect(received).toHaveBeenCalledWith({ challenge })
  })

  it('logs in through the BFF and derives navigation from the current account', async () => {
    const loginBody = vi.fn()

    mockServer.use(
      http.post('http://localhost/api/identity/login', async ({ request }) => {
        loginBody(await request.json())
        return HttpResponse.json({ authenticated: true })
      }),
      http.get('http://localhost/api/identity/session', () =>
        HttpResponse.json({ account: activeAccount }),
      ),
    )

    await expect(
      loginAndResolveWorkspace({
        email: 'member@example.com',
        password: 'correct horse battery staple',
      }),
    ).resolves.toMatchObject({
      path: '/specialist/dashboard',
      workspaces: [
        expect.objectContaining({ role: 'SPECIALIST' }),
        expect.objectContaining({ role: 'USER' }),
      ],
    })
    expect(loginBody).toHaveBeenCalledWith({
      email: 'member@example.com',
      password: 'correct horse battery staple',
    })
  })

  it.each([
    { ...activeAccount, status: 'DISABLED' },
    { ...activeAccount, emailVerified: false },
    { ...activeAccount, roles: ['OWNER'] },
  ])('cleans up and fails safely for an unusable account', async (account) => {
    const logout = vi.fn()

    mockServer.use(
      http.post('http://localhost/api/identity/login', () =>
        HttpResponse.json({ authenticated: true }),
      ),
      http.get('http://localhost/api/identity/session', () =>
        HttpResponse.json({ account }),
      ),
      http.post('http://localhost/api/identity/logout', () => {
        logout()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(
      loginAndResolveWorkspace({
        email: 'member@example.com',
        password: 'secret',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_SESSION_ACCOUNT' })
    expect(logout).toHaveBeenCalledOnce()
  })

  it.each([
    ['current', '/api/identity/logout'],
    ['all', '/api/identity/logout-all'],
  ] as const)('uses the %s-session BFF endpoint', async (mode, endpoint) => {
    const called = vi.fn()
    mockServer.use(
      http.post(`http://localhost${endpoint}`, () => {
        called()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await terminateSession(mode)
    expect(called).toHaveBeenCalledOnce()
  })

  it('keeps account failures generic while identifying a dependency outage', () => {
    expect(loginErrorMessage(new Error('locked account'))).not.toContain(
      'locked',
    )
    expect(
      loginErrorMessage(
        new ApiError({
          message: 'dependency down',
          code: 'IDENTITY_UNAVAILABLE',
          status: 503,
        }),
      ),
    ).toContain('tạm thời chưa sẵn sàng')
  })

  it('maps registration and verification errors without exposing service detail', () => {
    expect(
      registrationErrorMessage(
        new ApiError({
          message: 'private duplicate account detail',
          code: 'ACCOUNT_ALREADY_EXISTS',
          status: 409,
        }),
      ),
    ).not.toContain('private')
    expect(
      verificationErrorMessage(
        new ApiError({
          message: 'private challenge detail',
          code: 'INVALID_CHALLENGE',
          status: 400,
        }),
      ),
    ).toContain('không hợp lệ')
  })
})
