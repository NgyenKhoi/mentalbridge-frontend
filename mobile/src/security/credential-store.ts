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

let storageQueue: Promise<unknown> = Promise.resolve()
let mutationEpoch = 0

function enqueueStorageOp<T>(operation: () => Promise<T>): Promise<T> {
  const next = storageQueue.then(operation, operation)
  storageQueue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

export const secureCredentialStore: CredentialStore = {
  getAccessToken() {
    return enqueueStorageOp(() =>
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY, secureStoreOptions),
    )
  },
  getRefreshToken() {
    return enqueueStorageOp(() =>
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions),
    )
  },
  getCredentials() {
    return enqueueStorageOp(async () => {
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
    })
  },
  setCredentials(value) {
    const opEpoch = ++mutationEpoch
    return enqueueStorageOp(async () => {
      if (opEpoch !== mutationEpoch) return
      try {
        const entries: readonly (readonly [string, string])[] = [
          [ACCESS_TOKEN_KEY, value.accessToken],
          [ACCESS_EXPIRES_AT_KEY, value.accessExpiresAt],
          [REFRESH_TOKEN_KEY, value.refreshToken],
          [REFRESH_EXPIRES_AT_KEY, value.refreshExpiresAt],
        ]
        for (const [key, itemValue] of entries) {
          await SecureStore.setItemAsync(key, itemValue, secureStoreOptions)
          if (opEpoch !== mutationEpoch) {
            await clearCredentialSlots()
            return
          }
        }
      } catch (error) {
        await clearCredentialSlots()
        throw error
      }
    })
  },
  clear() {
    ++mutationEpoch
    return enqueueStorageOp(async () => {
      await clearCredentialSlots()
    })
  },
}
