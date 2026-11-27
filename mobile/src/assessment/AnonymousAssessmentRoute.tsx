import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'

import { createAnonymousAssessmentApi } from './anonymous-assessment-api'
import { AnonymousAssessmentScreen } from './AnonymousAssessmentScreen'

export function AnonymousAssessmentRoute() {
  const runtimeConfig = useRuntimeConfig()
  const [api] = useState(() =>
    createAnonymousAssessmentApi(
      createApiClient({
        config: runtimeConfig,
        getBearerToken: async () => null,
      }),
    ),
  )

  return <AnonymousAssessmentScreen api={api} />
}
