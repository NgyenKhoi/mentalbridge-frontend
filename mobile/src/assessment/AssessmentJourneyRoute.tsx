import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { useSession } from '@/auth/session-context'

import { createAssessmentApi } from './assessment-api'
import { AssessmentJourneyScreen } from './AssessmentJourneyScreen'
import { createCombinedMeaningApi } from './combined-meaning-api'
import { createNativeGuidedJourneyApi } from './native-guided-journey-api'

export function AssessmentJourneyRoute() {
  const { session, sessionGeneration, status } = useSession()
  const params = useLocalSearchParams<{
    purpose?: string
    returnTo?: string
  }>()
  const reassessment = params?.purpose === 'REASSESSMENT'
  if (status !== 'authenticated' || !session) return null
  return (
    <SessionAssessmentRoute
      key={`${session.subject}:${sessionGeneration ?? 0}:${reassessment ? 'REASSESSMENT' : 'INITIAL_CHECK'}`}
      reassessment={reassessment}
    />
  )
}

function SessionAssessmentRoute({
  reassessment,
}: Readonly<{
  reassessment: boolean
}>) {
  const runtimeConfig = useRuntimeConfig()
  const [{ api, journeyApi, setActive }] = useState(() => {
    let active = true
    const client = createApiClient({
      config: runtimeConfig,
      getBearerToken: async () => {
        if (!active) throw new Error('Authenticated session changed.')
        const token = await secureCredentialStore.getAccessToken()
        if (!active || !token) throw new Error('Authenticated session changed.')
        return token
      },
    })
    const api = createAssessmentApi(
      client,
      reassessment ? 'REASSESSMENT' : 'INITIAL_CHECK',
    )
    return {
      api,
      setActive: (next: boolean) => {
        active = next
      },
      journeyApi: reassessment
        ? undefined
        : createNativeGuidedJourneyApi(
            api,
            createCombinedMeaningApi(client),
            () => active,
          ),
    }
  })
  useEffect(() => {
    setActive(true)
    return () => {
      setActive(false)
    }
  }, [setActive])

  return (
    <AssessmentJourneyScreen
      api={api}
      {...(journeyApi ? { journeyApi } : {})}
      reassessment={reassessment}
      onReassessmentComplete={() => router.dismissTo('/(user)/reassessment')}
    />
  )
}
