import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import { createAssessmentApi } from './assessment-api'
import { AssessmentJourneyScreen } from './AssessmentJourneyScreen'

export function AssessmentJourneyRoute() {
  const runtimeConfig = useRuntimeConfig()
  const [api] = useState(() =>
    createAssessmentApi(
      createApiClient({
        config: runtimeConfig,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
    ),
  )

  return <AssessmentJourneyScreen api={api} />
}
