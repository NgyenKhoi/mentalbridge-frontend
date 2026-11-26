import { useQueryClient } from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { createApiClient } from '@/api/api-client'
import type { MobileRole } from '@/auth/session'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { secureCredentialStore } from '@/security/credential-store'
import { createNotificationApi } from './notification-api'
import { NotificationInboxScreen } from './NotificationInboxScreen'
import { NotificationPreferencesScreen } from './NotificationPreferencesScreen'

function AccountNotificationRoute({
  config,
  preferences,
  subject,
  role,
  appointmentFilter,
}: Readonly<{
  config: RuntimeConfig
  preferences: boolean
  subject: string
  role: MobileRole | null
  appointmentFilter: boolean
}>) {
  const queryClient = useQueryClient()
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries(
        {
          queryKey: [
            'notifications',
            subject,
            role,
            preferences ? 'preferences' : 'inbox',
          ],
        },
        { cancelRefetch: false },
      )
    }, [queryClient, subject, role, preferences]),
  )
  const [binding] = useState(() => {
    const controller = new AbortController()
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    const interceptor = client.interceptors.request.use((request) => {
      request.signal = controller.signal
      return request
    })
    return {
      controller,
      client,
      interceptor,
      api: createNotificationApi(client),
    }
  })
  useEffect(
    () => () => {
      binding.controller.abort()
      binding.client.interceptors.request.eject(binding.interceptor)
    },
    [binding],
  )
  return preferences ? (
    <NotificationPreferencesScreen
      api={binding.api}
      onBack={() => router.back()}
    />
  ) : (
    <NotificationInboxScreen
      api={binding.api}
      initialAppointmentFilter={appointmentFilter && role === 'USER'}
      onBack={() => router.back()}
      onPreferences={() => router.push('./notification-preferences')}
      onOpen={(destination) => router.push(destination)}
    />
  )
}
export function NotificationRoute({
  preferences = false,
  appointmentFilter = false,
}: Readonly<{ preferences?: boolean; appointmentFilter?: boolean }>) {
  const config = useRuntimeConfig()
  const { session } = useSession()
  return (
    <AccountNotificationRoute
      key={`${session?.subject ?? ''}:${session?.role ?? ''}:${preferences}:${appointmentFilter}`}
      config={config}
      preferences={preferences}
      subject={session?.subject ?? ''}
      role={session?.role ?? null}
      appointmentFilter={appointmentFilter}
    />
  )
}
