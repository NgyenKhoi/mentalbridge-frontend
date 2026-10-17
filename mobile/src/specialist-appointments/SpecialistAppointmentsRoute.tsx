import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import { createSpecialistAppointmentApi } from './specialist-appointment-api'
import { SpecialistAppointmentsScreen } from './SpecialistAppointmentsScreen'

export function SpecialistAppointmentsRoute() {
  const runtimeConfig = useRuntimeConfig()
  const [api] = useState(() =>
    createSpecialistAppointmentApi(
      createApiClient({
        config: runtimeConfig,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
    ),
  )

  return <SpecialistAppointmentsScreen api={api} />
}
