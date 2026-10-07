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
})
