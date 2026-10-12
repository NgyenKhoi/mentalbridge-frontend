import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import { createSpecialistApi } from './specialist-api'
import { SpecialistAvailabilityScreen } from './SpecialistAvailabilityScreen'

export function SpecialistAvailabilityRoute() {
  const runtimeConfig = useRuntimeConfig()
  const [api] = useState(() =>
    createSpecialistApi(
      createApiClient({
        config: runtimeConfig,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
    ),
  )

  return <SpecialistAvailabilityScreen api={api} />
}
