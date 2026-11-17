import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

import { ApiError } from '@/api/api-error'

import { getInstallationId } from './installation-id'
import type { PushApi } from './push-api'
import {
  disablePush,
  enablePush,
  ensurePushChannel,
  isPushEnabledOnDevice,
  refreshPushOnStart,
} from './push-registration'

const mockStore = new Map<string, string>()
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value)
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key)
  }),
}))
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.0.0', extra: { eas: { projectId: 'proj-1' } } },
  },
}))

const installationId = '11111111-1111-4111-8111-111111111111'
const granted = { status: 'granted', granted: true, canAskAgain: true }
const denied = { status: 'denied', granted: false, canAskAgain: true }
const permanentlyDenied = { ...denied, canAskAgain: false }
const permissions = jest.mocked(Notifications.getPermissionsAsync)
const request = jest.mocked(Notifications.requestPermissionsAsync)
const setChannel = jest.mocked(Notifications.setNotificationChannelAsync)
const expoToken = jest.mocked(Notifications.getExpoPushTokenAsync)

function createApi() {
  return {
    register: jest.fn().mockResolvedValue(undefined),
    revoke: jest.fn().mockResolvedValue(undefined),
  } satisfies PushApi
}

let platform: { restore(): void }
beforeEach(() => {
  mockStore.clear()
  jest.clearAllMocks()
  platform = jest.replaceProperty(Platform, 'OS', 'android')
  permissions.mockResolvedValue(granted as never)
  expoToken.mockResolvedValue({
    type: 'expo',
    data: 'ExponentPushToken[abc]',
  })
})
afterEach(() => platform.restore())

describe('push registration', () => {
  it('creates the MentalBridge channel with its own sound', async () => {
    await ensurePushChannel()
    expect(setChannel).toHaveBeenCalledWith('mentalbridge-chime-v1', {
      name: 'MentalBridge',
      importance: 6,
      sound: 'mentalbridge_chime.wav',
      lightColor: '#3D7A6E',
    })
  })

  it('persists one installation id', async () => {
    await expect(getInstallationId()).resolves.toBe(installationId)
    expect(mockStore.get('mb.push.installationId')).toBe(installationId)
    mockStore.set(
      'mb.push.installationId',
      '22222222-2222-4222-8222-222222222222',
    )
    await expect(getInstallationId()).resolves.toBe(
      '22222222-2222-4222-8222-222222222222',
    )
  })

  it('registers a granted device after the channel exists and flags it', async () => {
    const api = createApi()
    await expect(enablePush(api)).resolves.toBe('ENABLED')

    expect(setChannel.mock.invocationCallOrder[0]).toBeLessThan(
      expoToken.mock.invocationCallOrder[0] ?? 0,
    )
    expect(expoToken).toHaveBeenCalledWith({ projectId: 'proj-1' })
    expect(api.register).toHaveBeenCalledWith(installationId, {
      platform: 'ANDROID',
      provider: 'EXPO',
      providerToken: 'ExponentPushToken[abc]',
      permissionStatus: 'GRANTED',
      appVersion: '1.0.0',
    })
    await expect(isPushEnabledOnDevice()).resolves.toBe(true)
  })

  it('asks once and returns DENIED without registering', async () => {
    permissions.mockResolvedValue(denied as never)
    request.mockResolvedValue(denied as never)
    const api = createApi()

    await expect(enablePush(api)).resolves.toBe('DENIED')
    expect(request).toHaveBeenCalledTimes(1)
    expect(api.register).not.toHaveBeenCalled()
    await expect(isPushEnabledOnDevice()).resolves.toBe(false)
  })

  it('never prompts when the permission cannot be asked again', async () => {
    permissions.mockResolvedValue(permanentlyDenied as never)
    const api = createApi()

    await expect(enablePush(api)).resolves.toBe('DENIED')
    expect(request).not.toHaveBeenCalled()
    expect(api.register).not.toHaveBeenCalled()
  })

  it('returns UNAVAILABLE on 503 and does not flag the device', async () => {
    const api = createApi()
    api.register.mockRejectedValue(
      new ApiError({ code: 'SERVICE_UNAVAILABLE', status: 503, message: 'x' }),
    )

    await expect(enablePush(api)).resolves.toBe('UNAVAILABLE')
    await expect(isPushEnabledOnDevice()).resolves.toBe(false)
  })

  it('returns UNAVAILABLE without a token request when the project id is missing', async () => {
    const config = Constants.expoConfig as { extra?: unknown }
    const extra = config.extra
    config.extra = {}
    try {
      await expect(enablePush(createApi())).resolves.toBe('UNAVAILABLE')
      expect(expoToken).not.toHaveBeenCalled()
    } finally {
      config.extra = extra
    }
  })

  it('revokes and clears the flag on disable, even if revoke fails', async () => {
    const api = createApi()
    await enablePush(api)
    api.revoke.mockRejectedValue(new Error('offline'))

    await expect(disablePush(api)).resolves.toBeUndefined()
    expect(api.revoke).toHaveBeenCalledTimes(1)
    expect(api.revoke).toHaveBeenCalledWith(installationId)
    await expect(isPushEnabledOnDevice()).resolves.toBe(false)
  })

  it('does nothing on start while push is off', async () => {
    const api = createApi()
    await expect(refreshPushOnStart(api)).resolves.toBe('OFF')
    expect(api.register).not.toHaveBeenCalled()
    expect(api.revoke).not.toHaveBeenCalled()
  })

  it('re-registers on start when still granted', async () => {
    const api = createApi()
    await enablePush(api)
    api.register.mockClear()

    await expect(refreshPushOnStart(api)).resolves.toBe('ENABLED')
    expect(api.register).toHaveBeenCalledTimes(1)
  })

  it('revokes the device on start when the permission was withdrawn', async () => {
    const api = createApi()
    await enablePush(api)
    permissions.mockResolvedValue(permanentlyDenied as never)

    await expect(refreshPushOnStart(api)).resolves.toBe('DENIED')
    expect(api.revoke).toHaveBeenCalledWith(installationId)
    expect(request).not.toHaveBeenCalled()
    await expect(isPushEnabledOnDevice()).resolves.toBe(false)
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('mb.push.enabled')
  })
})
