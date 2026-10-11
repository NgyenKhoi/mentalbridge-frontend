import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { createApiClient } from '@/api/api-client'
import { createAppointmentApi } from '@/appointments/appointment-api'
import { AppointmentsScreen } from '@/appointments/AppointmentsScreen'
import { useSession } from '@/auth/session-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import { createDiscoveryApi } from './discovery-api'
import { DiscoveryScreen } from './DiscoveryScreen'
import type { SlotSelection } from './discovery-model'

function AccountDiscoveryRoute({
  config,
  originatingPlanActionId,
  subject,
}: Readonly<{
  config: RuntimeConfig
  originatingPlanActionId?: string
  subject: string
}>) {
  const [selection, setSelection] = useState<SlotSelection | undefined>()
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      client,
      api: createDiscoveryApi(client),
      appointments: createAppointmentApi(client, subject),
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
  return selection ? (
    <AppointmentsScreen
      api={binding.appointments}
      discovery={binding.api}
      initialSelection={selection}
      originatingPlanActionId={originatingPlanActionId}
      onBack={() => setSelection(undefined)}
    />
  ) : (
    <DiscoveryScreen
      api={binding.api}
      onBack={() => router.back()}
      onBook={setSelection}
    />
  )
}

export function DiscoveryRoute() {
  const config = useRuntimeConfig()
  const { session } = useSession()
  const { planActionId } = useLocalSearchParams<{ planActionId?: string }>()
  const subject = session?.subject ?? ''
  const originatingPlanActionId = z.uuid().safeParse(planActionId)
  return (
    <AccountDiscoveryRoute
      key={`${subject}:${originatingPlanActionId.success ? originatingPlanActionId.data : ''}`}
      config={config}
      subject={subject}
      {...(originatingPlanActionId.success
        ? { originatingPlanActionId: originatingPlanActionId.data }
        : {})}
    />
  )
}
