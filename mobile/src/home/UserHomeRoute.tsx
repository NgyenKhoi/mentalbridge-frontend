import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { UserHomeScreen } from '@/screens/UserHomeScreen'

import { createHomeApi } from './home-api'

export function UserHomeRoute() {
  const runtimeConfig = useRuntimeConfig()
  const [api] = useState(() =>
    createHomeApi(
      createApiClient({
        config: runtimeConfig,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
    ),
  )

  return <UserHomeScreen api={api} />
}
