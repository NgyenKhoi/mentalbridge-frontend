import * as SecureStore from 'expo-secure-store'

const ACCESS_TOKEN_KEY = 'mentalbridge.session.access-token'
const REFRESH_TOKEN_KEY = 'mentalbridge.session.refresh-token'

export interface CredentialStore {
  getAccessToken(): Promise<string | null>
  getRefreshToken(): Promise<string | null>
  setAccessToken(value: string): Promise<void>
  setRefreshToken(value: string): Promise<void>
  clear(): Promise<void>
}

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export const secureCredentialStore: CredentialStore = {
  getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY, secureStoreOptions)
  },
  getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions)
  },
  setAccessToken(value) {
    return SecureStore.setItemAsync(ACCESS_TOKEN_KEY, value, secureStoreOptions)
  },
  setRefreshToken(value) {
    return SecureStore.setItemAsync(
      REFRESH_TOKEN_KEY,
      value,
      secureStoreOptions,
    )
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY, secureStoreOptions),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions),
    ])
  },
}
