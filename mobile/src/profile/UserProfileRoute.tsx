import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import { createCareProfileApi } from './profile-api'
import { UserProfileScreen } from './UserProfileScreen'

export function UserProfileRoute() {
  const runtimeConfig = useRuntimeConfig()
  const [api] = useState(() =>
    createCareProfileApi(
      createApiClient({
        config: runtimeConfig,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
    ),
  )

  return <UserProfileScreen api={api} />
}
