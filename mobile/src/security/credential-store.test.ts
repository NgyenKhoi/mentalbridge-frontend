import * as SecureStore from 'expo-secure-store'

import { secureCredentialStore } from './credential-store'

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}))

describe('secure credential storage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('stores and reads access credentials through SecureStore', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue('stored-access-token')

    await secureCredentialStore.setCredentials({
      accessToken: 'synthetic-access-token',
      accessExpiresAt: '2026-10-05T00:15:00.000Z',
      refreshToken: 'synthetic-refresh-token-that-is-at-least-43-characters',
      refreshExpiresAt: '2026-11-04T00:00:00.000Z',
    })
    await expect(secureCredentialStore.getAccessToken()).resolves.toBe(
      'stored-access-token',
    )

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'mentalbridge.session.access-token',
      'synthetic-access-token',
      expect.objectContaining({ keychainAccessible: 1 }),
    )
  })

  it('restores a complete credential set', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValueOnce('synthetic-access-token')
      .mockResolvedValueOnce('2026-10-05T00:15:00.000Z')
      .mockResolvedValueOnce(
        'synthetic-refresh-token-that-is-at-least-43-characters',
      )
      .mockResolvedValueOnce('2026-11-04T00:00:00.000Z')

    await expect(secureCredentialStore.getCredentials()).resolves.toEqual({
      accessToken: 'synthetic-access-token',
      accessExpiresAt: '2026-10-05T00:15:00.000Z',
      refreshToken: 'synthetic-refresh-token-that-is-at-least-43-characters',
      refreshExpiresAt: '2026-11-04T00:00:00.000Z',
    })
  })

  it('rejects a partial credential set after an interrupted write', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValueOnce('synthetic-access-token')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('synthetic-refresh-token')
      .mockResolvedValueOnce(null)

    await expect(secureCredentialStore.getCredentials()).resolves.toBeNull()
  })

  it('removes partial credentials when a secure write fails', async () => {
    jest
      .mocked(SecureStore.setItemAsync)
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('Secure storage unavailable'))

    await expect(
      secureCredentialStore.setCredentials({
        accessToken: 'synthetic-access-token',
        accessExpiresAt: '2026-10-05T00:15:00.000Z',
        refreshToken: 'synthetic-refresh-token-that-is-at-least-43-characters',
        refreshExpiresAt: '2026-11-04T00:00:00.000Z',
      }),
    ).rejects.toThrow('Secure storage unavailable')

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(4)
  })

  it('clears every credential slot', async () => {
    await secureCredentialStore.clear()

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(4)
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'mentalbridge.session.access-token',
      expect.any(Object),
    )
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'mentalbridge.session.refresh-token',
      expect.any(Object),
    )
  })

  it('leaves credentials null when clear is called while a credential write is pending', async () => {
    const slots = new Map<string, string>()
    let resolveFirstWrite!: () => void
    let firstWrite = true

    jest.mocked(SecureStore.setItemAsync).mockImplementation((key, value) => {
      if (firstWrite) {
        firstWrite = false
        return new Promise<void>((resolve) => {
          resolveFirstWrite = () => {
            slots.set(key, value)
            resolve()
          }
        })
      }
      slots.set(key, value)
      return Promise.resolve()
    })
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
      slots.delete(key)
    })
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementation(async (key) => slots.get(key) ?? null)

    const writeA = secureCredentialStore.setCredentials({
      accessToken: 'token-a',
      accessExpiresAt: '2026-10-05T00:15:00.000Z',
      refreshToken: 'refresh-a-that-is-at-least-43-characters-long-0001',
      refreshExpiresAt: '2026-11-04T00:00:00.000Z',
    })
    const clearPromise = secureCredentialStore.clear()

    resolveFirstWrite()
    await Promise.all([writeA, clearPromise])

    await expect(secureCredentialStore.getCredentials()).resolves.toBeNull()
    expect(slots.size).toBe(0)
  })

  it('preserves only session B credentials when write A is pending across clear and write B', async () => {
    const slots = new Map<string, string>()
    let resolveFirstWriteA!: () => void
    let firstWrite = true

    jest.mocked(SecureStore.setItemAsync).mockImplementation((key, value) => {
      if (firstWrite) {
        firstWrite = false
        return new Promise<void>((resolve) => {
          resolveFirstWriteA = () => {
            slots.set(key, value)
            resolve()
          }
        })
      }
      slots.set(key, value)
      return Promise.resolve()
    })
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
      slots.delete(key)
    })
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementation(async (key) => slots.get(key) ?? null)

    const credentialsB = {
      accessToken: 'token-b',
      accessExpiresAt: '2026-10-05T01:15:00.000Z',
      refreshToken: 'refresh-b-that-is-at-least-43-characters-long-0002',
      refreshExpiresAt: '2026-11-05T00:00:00.000Z',
    }

    const writeA = secureCredentialStore.setCredentials({
      accessToken: 'token-a',
      accessExpiresAt: '2026-10-05T00:15:00.000Z',
      refreshToken: 'refresh-a-that-is-at-least-43-characters-long-0001',
      refreshExpiresAt: '2026-11-04T00:00:00.000Z',
    })
    const clearA = secureCredentialStore.clear()
    const writeB = secureCredentialStore.setCredentials(credentialsB)

    resolveFirstWriteA()
    await Promise.all([writeA, clearA, writeB])

    await expect(secureCredentialStore.getCredentials()).resolves.toEqual(
      credentialsB,
    )
  })

  it('does not allow a pending clear from session A to delete session B credentials', async () => {
    const slots = new Map<string, string>([
      ['mentalbridge.session.access-token', 'token-a'],
      ['mentalbridge.session.access-expires-at', '2026-10-05T00:15:00.000Z'],
      [
        'mentalbridge.session.refresh-token',
        'refresh-a-that-is-at-least-43-characters-long-0001',
      ],
      ['mentalbridge.session.refresh-expires-at', '2026-11-04T00:00:00.000Z'],
    ])
    let resolveDelete!: () => void
    let firstDelete = true

    jest.mocked(SecureStore.deleteItemAsync).mockImplementation((key) => {
      if (firstDelete) {
        firstDelete = false
        return new Promise<void>((resolve) => {
          resolveDelete = () => {
            slots.delete(key)
            resolve()
          }
        })
      }
      slots.delete(key)
      return Promise.resolve()
    })
    jest
      .mocked(SecureStore.setItemAsync)
      .mockImplementation(async (key, value) => {
        slots.set(key, value)
      })
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementation(async (key) => slots.get(key) ?? null)

    const credentialsB = {
      accessToken: 'token-b',
      accessExpiresAt: '2026-10-05T01:15:00.000Z',
      refreshToken: 'refresh-b-that-is-at-least-43-characters-long-0002',
      refreshExpiresAt: '2026-11-05T00:00:00.000Z',
    }

    const clearA = secureCredentialStore.clear()
    const writeB = secureCredentialStore.setCredentials(credentialsB)

    resolveDelete()
    await Promise.all([clearA, writeB])

    await expect(secureCredentialStore.getCredentials()).resolves.toEqual(
      credentialsB,
    )
  })

  it('recovers from a mid-write failure without corrupting a subsequent queued write', async () => {
    const slots = new Map<string, string>()
    let callCount = 0

    jest
      .mocked(SecureStore.setItemAsync)
      .mockImplementation(async (key, value) => {
        callCount += 1
        if (callCount === 2) {
          throw new Error('SecureStore mid-write failure')
        }
        slots.set(key, value)
      })
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
      slots.delete(key)
    })
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementation(async (key) => slots.get(key) ?? null)

    const credentialsB = {
      accessToken: 'token-b',
      accessExpiresAt: '2026-10-05T01:15:00.000Z',
      refreshToken: 'refresh-b-that-is-at-least-43-characters-long-0002',
      refreshExpiresAt: '2026-11-05T00:00:00.000Z',
    }

    const writeA = secureCredentialStore.setCredentials({
      accessToken: 'token-a',
      accessExpiresAt: '2026-10-05T00:15:00.000Z',
      refreshToken: 'refresh-a-that-is-at-least-43-characters-long-0001',
      refreshExpiresAt: '2026-11-04T00:00:00.000Z',
    })
    const writeB = secureCredentialStore.setCredentials(credentialsB)

    await expect(writeA).rejects.toThrow('SecureStore mid-write failure')
    await writeB

    await expect(secureCredentialStore.getCredentials()).resolves.toEqual(
      credentialsB,
    )
  })
})
