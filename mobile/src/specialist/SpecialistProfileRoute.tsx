import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import { createSpecialistApi } from './specialist-api'
import { SpecialistProfileScreen } from './SpecialistProfileScreen'

export function SpecialistProfileRoute() {
  const runtimeConfig = useRuntimeConfig()
  const [api] = useState(() =>
    createSpecialistApi(
      createApiClient({
        config: runtimeConfig,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
    ),
  )

  return <SpecialistProfileScreen api={api} />
}
