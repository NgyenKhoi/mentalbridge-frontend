import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { SpecialistHomeScreen } from '@/screens/SpecialistHomeScreen'
import { createSpecialistCommercialApi } from '@/specialist-commercial/specialist-commercial-api'

export default function SpecialistHomeRoute() {
  const config = useRuntimeConfig()
  const [api] = useState(() =>
    createSpecialistCommercialApi(
      createApiClient({
        config,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
    ),
  )
  return <SpecialistHomeScreen commercialApi={api} />
}
