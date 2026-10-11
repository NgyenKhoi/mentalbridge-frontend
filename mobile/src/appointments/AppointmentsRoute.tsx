import { router } from 'expo-router'
import { useEffect, useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { createDiscoveryApi } from '@/discovery/discovery-api'
import { secureCredentialStore } from '@/security/credential-store'

import { createAppointmentApi } from './appointment-api'
import { AppointmentsScreen } from './AppointmentsScreen'

function AccountAppointmentsRoute({
  config,
  subject,
}: Readonly<{ config: RuntimeConfig; subject: string }>) {
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      client,
      api: createAppointmentApi(client, subject),
      discovery: createDiscoveryApi(client),
    }
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
    <AppointmentsScreen
      api={binding.api}
      discovery={binding.discovery}
      onBack={() => router.back()}
    />
  )
}
export function AppointmentsRoute() {
  const config = useRuntimeConfig()
  const { session } = useSession()
  const subject = session?.subject ?? ''
  return (
    <AccountAppointmentsRoute key={subject} config={config} subject={subject} />
  )
}
