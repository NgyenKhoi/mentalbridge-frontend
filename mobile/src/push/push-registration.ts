import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

import { getInstallationId } from './installation-id'
import type { PushApi } from './push-api'
import {
  PUSH_ACCENT,
  PUSH_CHANNEL_ID,
  PUSH_CHANNEL_NAME,
  PUSH_ENABLED_KEY,
  PUSH_SOUND,
  type PushState,
} from './push-constants'

export type PushEnableResult = 'ENABLED' | 'DENIED' | 'UNAVAILABLE'

// The Android 13 permission prompt only appears once a channel exists.
export async function ensurePushChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
    name: PUSH_CHANNEL_NAME,
    importance: Notifications.AndroidImportance.HIGH,
    sound: PUSH_SOUND,
    lightColor: PUSH_ACCENT,
  })
}

export async function isPushEnabledOnDevice(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(PUSH_ENABLED_KEY)) === '1'
  } catch {
    return false
  }
}

async function registerDevice(
  api: PushApi,
): Promise<'ENABLED' | 'UNAVAILABLE'> {
  const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId
  if (Platform.OS !== 'android' || typeof projectId !== 'string' || !projectId)
    return 'UNAVAILABLE'

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId })
    const appVersion = Constants.expoConfig?.version?.slice(0, 32)
    await api.register(await getInstallationId(), {
      platform: 'ANDROID',
      provider: 'EXPO',
      providerToken: token.data,
      permissionStatus: 'GRANTED',
      ...(appVersion ? { appVersion } : {}),
    })
    return 'ENABLED'
  } catch {
    // 503 (push disabled server-side), 429, offline, token fetch failure: the app keeps working.
    return 'UNAVAILABLE'
  }
}

export async function enablePush(api: PushApi): Promise<PushEnableResult> {
  try {
    await ensurePushChannel()
    let permission = await Notifications.getPermissionsAsync()
    if (!permission.granted) {
      // Permanently denied: never prompt again, the user must use system settings.
      if (permission.canAskAgain) {
        permission = await Notifications.requestPermissionsAsync()
      }
      if (!permission.granted) {
        if (await isPushEnabledOnDevice()) await disablePush(api)
        return 'DENIED'
      }
    }
  } catch {
    return 'UNAVAILABLE'
  }

  const result = await registerDevice(api)
  if (result === 'ENABLED') {
    await SecureStore.setItemAsync(PUSH_ENABLED_KEY, '1')
  }
  return result
}

// One revoke attempt; the flag is cleared even when the server cannot be reached.
export async function disablePush(api: PushApi): Promise<void> {
  try {
    await api.revoke(await getInstallationId())
  } catch {
    // Sign-out and opt-out must not depend on the network.
  }
  try {
    await SecureStore.deleteItemAsync(PUSH_ENABLED_KEY)
  } catch {
    // Nothing else to clean up.
  }
}

// Runs at start and on token rotation. Registration failure keeps the flag so the next start retries.
export async function refreshPushOnStart(api: PushApi): Promise<PushState> {
  if (!(await isPushEnabledOnDevice())) return 'OFF'

  const permission = await Notifications.getPermissionsAsync()
  if (!permission.granted) {
    await disablePush(api)
    return 'DENIED'
  }
  return registerDevice(api)
}
