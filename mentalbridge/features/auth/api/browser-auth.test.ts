import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { mockServer } from '@/tests/mocks/server'

import {
  loginAndResolveWorkspace,
  loginErrorMessage,
  terminateSession,
} from './browser-auth'

const activeAccount = {
  accountId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
  status: 'ACTIVE',
  roles: ['SPECIALIST', 'USER'],
  emailVerified: true,
}

describe('browser authentication', () => {
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
})
