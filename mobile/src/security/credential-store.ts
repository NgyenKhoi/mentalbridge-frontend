import * as SecureStore from 'expo-secure-store'

const ACCESS_TOKEN_KEY = 'mentalbridge.session.access-token'
const REFRESH_TOKEN_KEY = 'mentalbridge.session.refresh-token'
const ACCESS_EXPIRES_AT_KEY = 'mentalbridge.session.access-expires-at'
const REFRESH_EXPIRES_AT_KEY = 'mentalbridge.session.refresh-expires-at'

export type StoredCredentials = Readonly<{
  accessToken: string
  accessExpiresAt: string
  refreshToken: string
  refreshExpiresAt: string
}>

export interface CredentialStore {
  getAccessToken(): Promise<string | null>
  getRefreshToken(): Promise<string | null>
  getCredentials(): Promise<StoredCredentials | null>
  setCredentials(value: StoredCredentials): Promise<void>
  clear(): Promise<void>
}

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

async function clearCredentialSlots() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY, secureStoreOptions),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions),
    SecureStore.deleteItemAsync(ACCESS_EXPIRES_AT_KEY, secureStoreOptions),
    SecureStore.deleteItemAsync(REFRESH_EXPIRES_AT_KEY, secureStoreOptions),
  ])
}

export const secureCredentialStore: CredentialStore = {
  getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY, secureStoreOptions)
  },
  getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions)
  },
  async getCredentials() {
    const [accessToken, accessExpiresAt, refreshToken, refreshExpiresAt] =
      await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY, secureStoreOptions),
        SecureStore.getItemAsync(ACCESS_EXPIRES_AT_KEY, secureStoreOptions),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions),
        SecureStore.getItemAsync(REFRESH_EXPIRES_AT_KEY, secureStoreOptions),
      ])

    if (
      !accessToken ||
      !accessExpiresAt ||
      !refreshToken ||
      !refreshExpiresAt
    ) {
      return null
    }

    return { accessToken, accessExpiresAt, refreshToken, refreshExpiresAt }
  },
  async setCredentials(value) {
    try {
      await SecureStore.setItemAsync(
        ACCESS_TOKEN_KEY,
        value.accessToken,
        secureStoreOptions,
      )
      await SecureStore.setItemAsync(
        ACCESS_EXPIRES_AT_KEY,
        value.accessExpiresAt,
        secureStoreOptions,
      )
      await SecureStore.setItemAsync(
        REFRESH_TOKEN_KEY,
        value.refreshToken,
        secureStoreOptions,
      )
      await SecureStore.setItemAsync(
        REFRESH_EXPIRES_AT_KEY,
        value.refreshExpiresAt,
        secureStoreOptions,
      )
    } catch (error) {
      await clearCredentialSlots()
      throw error
    }
  },
  clear: clearCredentialSlots,
}
