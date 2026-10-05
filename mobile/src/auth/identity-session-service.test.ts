import { ApiError } from '@/api/api-error'
import type {
  CredentialStore,
  StoredCredentials,
} from '@/security/credential-store'

import type { IdentityApi } from './identity-api'
import type { AccountDetail, TokenPair } from './identity-contract'
import { createSessionService } from './identity-session-service'

const now = Date.parse('2026-10-05T00:00:00.000Z')
const refreshToken = 'refresh-token-that-is-long-enough-for-the-contract-0001'
const rotatedRefreshToken =
  'refresh-token-that-is-long-enough-for-the-contract-0002'

const tokenPair: TokenPair = {
  accessToken: 'access-token-1',
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshToken,
  refreshExpiresAt: '2026-11-04T00:00:00.000Z',
}

const rotatedTokenPair: TokenPair = {
  ...tokenPair,
  accessToken: 'access-token-2',
  refreshToken: rotatedRefreshToken,
}

const userAccount: AccountDetail = {
  accountId: '11111111-1111-4111-8111-111111111111',
  email: 'user@example.com',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  version: 2,
}

const activeCredentials: StoredCredentials = {
  accessToken: 'access-token-1',
  accessExpiresAt: '2026-10-05T00:15:00.000Z',
  refreshToken,
  refreshExpiresAt: '2026-11-04T00:00:00.000Z',
}

function createApi(): jest.Mocked<IdentityApi> {
  return {
    getCurrentAccount: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    registerUser: jest.fn(),
    requestEmailVerification: jest.fn(),
    verifyEmail: jest.fn(),
  }
}

function createCredentialStore(): jest.Mocked<CredentialStore> {
  return {
    clear: jest.fn(),
    getAccessToken: jest.fn(),
    getCredentials: jest.fn(),
    getRefreshToken: jest.fn(),
    setCredentials: jest.fn(),
  }
}

function setup() {
  const api = createApi()
  const credentials = createCredentialStore()
  const service = createSessionService({
    api,
    credentials,
    createIdempotencyKey: () => '22222222-2222-4222-8222-222222222222',
    now: () => now,
  })
  return { api, credentials, service }
}

describe('Identity mobile session lifecycle', () => {
  it('logs in, stores the rotated credential pair, and trusts the current-account response', async () => {
    const { api, credentials, service } = setup()
    api.login.mockResolvedValue(tokenPair)
    api.getCurrentAccount.mockResolvedValue(userAccount)

    await expect(
      service.signIn('user@example.com', 'correct-password'),
    ).resolves.toEqual({
      session: {
        role: 'USER',
        subject: '11111111-1111-4111-8111-111111111111',
      },
      accessExpiresAt: '2026-10-05T00:15:00.000Z',
    })

    expect(api.login).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'correct-password',
    })
    expect(credentials.setCredentials).toHaveBeenCalledWith(activeCredentials)
  })

  it('keeps invalid credentials distinguishable and stores nothing', async () => {
    const { api, credentials, service } = setup()
    api.login.mockRejectedValue(
      new ApiError({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
        status: 401,
      }),
    )

    await expect(
      service.signIn('user@example.com', 'wrong-password'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(credentials.setCredentials).not.toHaveBeenCalled()
  })

  it('restores an app-restart session only after Identity confirms the account', async () => {
    const { api, credentials, service } = setup()
    credentials.getCredentials.mockResolvedValue(activeCredentials)
    api.getCurrentAccount.mockResolvedValue(userAccount)

    await expect(service.restore()).resolves.toMatchObject({
      session: { role: 'USER', subject: userAccount.accountId },
    })
    expect(api.refresh).not.toHaveBeenCalled()
  })

  it('refreshes an expiring access credential and persists both rotated tokens', async () => {
    const { api, credentials, service } = setup()
    credentials.getCredentials.mockResolvedValue({
      ...activeCredentials,
      accessExpiresAt: '2026-10-05T00:00:30.000Z',
    })
    api.refresh.mockResolvedValue(rotatedTokenPair)
    api.getCurrentAccount.mockResolvedValue(userAccount)

    await expect(service.restore()).resolves.toMatchObject({
      session: { role: 'USER', subject: userAccount.accountId },
    })
    expect(api.refresh).toHaveBeenCalledWith(
      refreshToken,
      '22222222-2222-4222-8222-222222222222',
    )
    expect(credentials.setCredentials).toHaveBeenCalledWith({
      ...activeCredentials,
      accessToken: 'access-token-2',
      refreshToken: rotatedRefreshToken,
    })
  })

  it('clears revoked or replayed refresh credentials and fails closed', async () => {
    const { api, credentials, service } = setup()
    credentials.getCredentials.mockResolvedValue({
      ...activeCredentials,
      accessExpiresAt: '2026-10-05T00:00:30.000Z',
    })
    api.refresh.mockRejectedValue(
      new ApiError({
        code: 'INVALID_SESSION',
        message: 'Session revoked',
        status: 401,
      }),
    )

    await expect(service.restore()).resolves.toBeNull()
    expect(credentials.clear).toHaveBeenCalled()
  })

  it('clears an expired refresh credential without asking Identity to rotate it', async () => {
    const { api, credentials, service } = setup()
    credentials.getCredentials.mockResolvedValue({
      ...activeCredentials,
      accessExpiresAt: '2026-10-04T23:00:00.000Z',
      refreshExpiresAt: '2026-10-05T00:00:00.000Z',
    })

    await expect(service.restore()).resolves.toBeNull()
    expect(api.refresh).not.toHaveBeenCalled()
    expect(credentials.clear).toHaveBeenCalled()
  })

  it('preserves credentials when Identity is unavailable so restore can be retried', async () => {
    const { api, credentials, service } = setup()
    credentials.getCredentials.mockResolvedValue(activeCredentials)
    api.getCurrentAccount.mockRejectedValue(
      new ApiError({ code: 'NETWORK_ERROR', message: 'Offline' }),
    )

    await expect(service.restore()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
    expect(credentials.clear).not.toHaveBeenCalled()
  })

  it('rejects a non-USER account and revokes the newly issued server session', async () => {
    const { api, credentials, service } = setup()
    api.login.mockResolvedValue(tokenPair)
    api.logout.mockResolvedValue()
    api.getCurrentAccount.mockResolvedValue({
      ...userAccount,
      roles: ['SPECIALIST'],
    })

    await expect(
      service.signIn('specialist@example.com', 'correct-password'),
    ).rejects.toMatchObject({ code: 'INVALID_SESSION_ACCOUNT' })
    expect(api.logout).toHaveBeenCalledWith(refreshToken)
    expect(credentials.clear).toHaveBeenCalled()
  })

  it('invokes server logout and clears local credentials', async () => {
    const { api, credentials, service } = setup()
    credentials.getCredentials.mockResolvedValue(activeCredentials)

    await service.logout()

    expect(api.logout).toHaveBeenCalledWith(refreshToken)
    expect(credentials.clear).toHaveBeenCalled()
  })

  it('still clears local credentials when the logout dependency is unavailable', async () => {
    const { api, credentials, service } = setup()
    credentials.getCredentials.mockResolvedValue(activeCredentials)
    api.logout.mockRejectedValue(
      new ApiError({ code: 'NETWORK_ERROR', message: 'Offline' }),
    )

    await expect(service.logout()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
    expect(credentials.clear).toHaveBeenCalled()
  })

  it('registers only the USER actor allowed by this story', async () => {
    const { api, service } = setup()

    await service.registerUser(
      'user@example.com',
      'correct-password',
      '33333333-3333-4333-8333-333333333333',
    )

    expect(api.registerUser).toHaveBeenCalledWith(
      {
        actorType: 'USER',
        email: 'user@example.com',
        password: 'correct-password',
      },
      '33333333-3333-4333-8333-333333333333',
    )
  })
})
