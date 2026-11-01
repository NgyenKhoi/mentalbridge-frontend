import { router } from 'expo-router'
import { useState } from 'react'
import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { secureCredentialStore } from '@/security/credential-store'
import { ReminderCenterScreen } from './ReminderCenterScreen'
import { createReminderSource } from './reminder-api'

function AccountReminderRoute({ config }: Readonly<{ config: RuntimeConfig }>) {
  const [source] = useState(() =>
    createReminderSource(
      createApiClient({
        config,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
    ),
  )
  return (
    <ReminderCenterScreen
      source={source}
      onBack={() => router.back()}
      onInbox={() => router.push('/(user)/notifications')}
      onPreferences={() => router.push('/(user)/notification-preferences')}
      onOpen={(destination) => router.push(destination)}
    />
  )
}

export function ReminderCenterRoute() {
  const config = useRuntimeConfig()
  const { session } = useSession()
  return <AccountReminderRoute key={session?.subject ?? ''} config={config} />
}

export function ReminderCenterEntry() {
  return (
    <PrimaryButton
      label="Hôm nay và lời nhắc"
      onPress={() => router.push('/(user)/reminders')}
      testID="reminders-entry"
    />
  )
}
