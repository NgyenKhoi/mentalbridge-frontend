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

    await secureCredentialStore.setAccessToken('synthetic-access-token')
    await expect(secureCredentialStore.getAccessToken()).resolves.toBe(
      'stored-access-token',
    )

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'mentalbridge.session.access-token',
      'synthetic-access-token',
      expect.objectContaining({ keychainAccessible: 1 }),
    )
  })

  it('clears both credential slots', async () => {
    await secureCredentialStore.clear()

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(2)
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
