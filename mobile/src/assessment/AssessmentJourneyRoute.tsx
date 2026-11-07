import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import { createAssessmentApi } from './assessment-api'
import { AssessmentJourneyScreen } from './AssessmentJourneyScreen'

export function AssessmentJourneyRoute() {
  const runtimeConfig = useRuntimeConfig()
  const params = useLocalSearchParams<{
    purpose?: string
    returnTo?: string
  }>()
  const reassessment = params.purpose === 'REASSESSMENT'
  const [api] = useState(() =>
    createAssessmentApi(
      createApiClient({
        config: runtimeConfig,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
      reassessment ? 'REASSESSMENT' : 'INITIAL_CHECK',
    ),
  )

  return (
    <AssessmentJourneyScreen
      api={api}
      reassessment={reassessment}
      onReassessmentComplete={() => router.dismissTo('/(user)/reassessment')}
    />
  )
}
