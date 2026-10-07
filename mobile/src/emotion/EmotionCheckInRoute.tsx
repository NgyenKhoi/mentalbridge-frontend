import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import { createEmotionApi } from './emotion-api'
import { EmotionCheckInScreen } from './EmotionCheckInScreen'

export function EmotionCheckInRoute() {
  const runtimeConfig = useRuntimeConfig()
  const [api] = useState(() =>
    createEmotionApi(
      createApiClient({
        config: runtimeConfig,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
    ),
  )

  return <EmotionCheckInScreen api={api} />
}
