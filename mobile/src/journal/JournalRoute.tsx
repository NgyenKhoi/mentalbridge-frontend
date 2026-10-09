import { router, Stack } from 'expo-router'
import { useEffect, useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { secureCredentialStore } from '@/security/credential-store'

import { createJournalApi } from './journal-api'
import { JournalScreen } from './JournalScreen'

function AccountJournalRoute({
  config,
  subject,
}: Readonly<{ config: RuntimeConfig; subject: string }>) {
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return { client, api: createJournalApi(client, subject) }
  })
  useEffect(() => {
    const controller = new AbortController()
    const interceptor = binding.client.interceptors.request.use((request) => {
      request.signal = controller.signal
      return request
    })
    return () => {
      controller.abort()
      binding.client.interceptors.request.eject(interceptor)
    }
  }, [binding])
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <JournalScreen api={binding.api} onBack={() => router.back()} />
    </>
  )
}

export function JournalRoute() {
  const config = useRuntimeConfig()
  const { session } = useSession()
  const subject = session?.subject ?? ''
  return <AccountJournalRoute key={subject} config={config} subject={subject} />
}
