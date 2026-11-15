import { useQueryClient } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AppState } from 'react-native'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { createNotificationApi } from '@/notifications/notification-api'
import { secureCredentialStore } from '@/security/credential-store'

import { createPushApi } from './push-api'
import { PUSH_STATE_KEY } from './push-constants'
import { ensurePushChannel, refreshPushOnStart } from './push-registration'
import {
  parsePushData,
  pushDestination,
  type PushDestination,
} from './push-routing'

const NAVIGATION_RETRIES = 20
const NAVIGATION_RETRY_MS = 100

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

// On a cold start the root navigator mounts a moment after the session is restored.
function navigateWhenReady(destination: PushDestination, attempt = 0) {
  try {
    router.navigate(destination)
  } catch {
    if (attempt < NAVIGATION_RETRIES) {
      setTimeout(
        () => navigateWhenReady(destination, attempt + 1),
        NAVIGATION_RETRY_MS,
      )
    }
  }
}

export function PushBridge() {
  const config = useRuntimeConfig()
  const { session, status } = useSession()
  const queryClient = useQueryClient()
  const apis = useMemo(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      push: createPushApi(client),
      notifications: createNotificationApi(client),
    }
  }, [config])
  // A tap can arrive before the session is restored: hold it, act only once authenticated.
  const pending = useRef<Notifications.NotificationResponse | null>(null)
  const auth = useRef({ status, role: session?.role ?? null })
  const handled = useRef<string | null>(null)

  const drain = useCallback(() => {
    const response = pending.current
    const { status: current, role } = auth.current
    if (!response) return
    if (current === 'unauthenticated') {
      pending.current = null
      return
    }
    if (current !== 'authenticated' || !role) return

    pending.current = null
    const { identifier, content } = response.notification.request
    if (handled.current === identifier) return
    handled.current = identifier

    navigateWhenReady(pushDestination(content.data, role))
    const parsed = parsePushData(content.data)
    if (!parsed) return
    void apis.notifications
      .markRead(parsed.notificationId)
      .catch(() => undefined)
      .finally(() => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      })
  }, [apis, queryClient])

  const role = session?.role ?? null
  useEffect(() => {
    auth.current = { status, role }
    drain()
  }, [drain, role, status])

  useEffect(() => {
    void ensurePushChannel().catch(() => undefined)
    const last = Notifications.getLastNotificationResponse()
    if (last) {
      Notifications.clearLastNotificationResponse()
      pending.current = last
      drain()
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        pending.current = response
        drain()
      },
    )
    return () => subscription.remove()
  }, [drain])

  useEffect(() => {
    if (status !== 'authenticated') return
    const refresh = () =>
      void refreshPushOnStart(apis.push)
        .then((state) => queryClient.setQueryData(PUSH_STATE_KEY, state))
        .catch(() => undefined)
    refresh()
    const subscription = Notifications.addPushTokenListener(refresh)
    // Permission changed in system settings: re-check once per return to the foreground.
    let previous = AppState.currentState
    const foreground = AppState.addEventListener('change', (next) => {
      if (next === 'active' && previous !== 'active') refresh()
      previous = next
    })
    return () => {
      subscription.remove()
      foreground.remove()
    }
  }, [apis, queryClient, status])

  return null
}
