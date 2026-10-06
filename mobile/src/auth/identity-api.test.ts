import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createIdentityApi } from './identity-api'

const tokenPair = {
  accessToken: 'access-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshToken: 'refresh-token-that-is-long-enough-for-the-contract-0001',
  refreshExpiresAt: '2026-11-04T00:00:00.000Z',
}

const account = {
  accountId: '11111111-1111-4111-8111-111111111111',
  email: 'user@example.com',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  version: 2,
}

describe('Identity mobile API contract', () => {
  it('uses the frozen Identity paths, bodies, and idempotency headers', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      const data =
        request.url === '/api/v1/account'
          ? account
          : request.url === '/api/v1/auth/registrations'
            ? {
                accountId: account.accountId,
                status: 'PENDING_EMAIL_VERIFICATION',
                verificationRequired: true,
                createdAt: account.createdAt,
              }
            : request.url === '/api/v1/auth/email-verifications'
              ? {
                  accountId: account.accountId,
                  status: 'ACTIVE',
                  roles: ['USER'],
                  emailVerified: true,
                }
              : tokenPair

      return {
        config: request,
        data,
        headers: {},
        status: request.url?.includes('requests') ? 202 : 200,
        statusText: 'OK',
      }
    }
    const api = createIdentityApi(create({ adapter }))

    await api.login({ email: 'user@example.com', password: 'password' })
    await api.refresh(tokenPair.refreshToken, 'refresh-idempotency-key')
    await api.getCurrentAccount()
    await api.logout(tokenPair.refreshToken)
    await api.registerUser(
      {
        actorType: 'USER',
        email: 'user@example.com',
        password: 'correct-password',
      },
      'registration-idempotency-key',
    )
    await api.verifyEmail('challenge-that-is-long-enough-for-the-contract')
    await api.requestEmailVerification('user@example.com')

    expect(requests.map(({ method, url }) => ({ method, url }))).toEqual([
      { method: 'post', url: '/api/v1/auth/login' },
      { method: 'post', url: '/api/v1/auth/refresh' },
      { method: 'get', url: '/api/v1/account' },
      { method: 'post', url: '/api/v1/auth/logout' },
      { method: 'post', url: '/api/v1/auth/registrations' },
      { method: 'post', url: '/api/v1/auth/email-verifications' },
      { method: 'post', url: '/api/v1/auth/email-verification-requests' },
    ])
    expect(JSON.parse(String(requests[1]?.data))).toEqual({
      refreshToken: tokenPair.refreshToken,
    })
    expect(requests[1]?.headers.get('Idempotency-Key')).toBe(
      'refresh-idempotency-key',
    )
    expect(JSON.parse(String(requests[4]?.data))).toEqual({
      actorType: 'USER',
      email: 'user@example.com',
      password: 'correct-password',
    })
    expect(requests[4]?.headers.get('Idempotency-Key')).toBe(
      'registration-idempotency-key',
    )
  })

  it('rejects an unrecognized current-account payload', async () => {
    const adapter: AxiosAdapter = async (request) => ({
      config: request,
      data: { ...account, roles: ['ADMIN'], unexpected: true },
      headers: {},
      status: 200,
      statusText: 'OK',
    })

    await expect(
      createIdentityApi(create({ adapter })).getCurrentAccount(),
    ).rejects.toBeDefined()
  })
})
