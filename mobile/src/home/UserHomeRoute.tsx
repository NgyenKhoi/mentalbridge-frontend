import { useState } from 'react'

import { createDiscoveryApi } from '@/discovery/discovery-api'
import { createAppointmentApi } from '@/appointments/appointment-api'
import { useSession } from '@/auth/session-context'
import { createCareProfileApi } from '@/profile/profile-api'
import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { UserHomeScreen } from '@/screens/UserHomeScreen'

import { createHomeApi } from './home-api'

export function UserHomeRoute() {
  const runtimeConfig = useRuntimeConfig()
  const { session } = useSession()
  const [services] = useState(() => {
    const client = createApiClient({
      config: runtimeConfig,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      client,
      discovery: createDiscoveryApi(client),
      home: createHomeApi(client),
      profile: createCareProfileApi(client),
    }
  })

  return (
    <UserHomeScreen
      api={services.home}
      profileApi={services.profile}
      discoveryApi={services.discovery}
      appointmentApi={
        session
          ? createAppointmentApi(services.client, session.subject)
          : undefined
      }
    />
  )
}
