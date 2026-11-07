import { useEffect, useRef, useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { useSession } from '@/auth/session-context'

import { createAssessmentApi } from './assessment-api'
import { AssessmentJourneyScreen } from './AssessmentJourneyScreen'
import { createCombinedMeaningApi } from './combined-meaning-api'
import { createNativeGuidedJourneyApi } from './native-guided-journey-api'

export function AssessmentJourneyRoute() {
  const { session, status } = useSession()
  if (status !== 'authenticated' || !session) return null
  return <SessionAssessmentRoute key={session.subject} />
}

function SessionAssessmentRoute() {
  const runtimeConfig = useRuntimeConfig()
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const [{ api, journeyApi }] = useState(() => {
    const client = createApiClient({
      config: runtimeConfig,
      getBearerToken: async () => {
        if (!active.current) throw new Error('Authenticated session changed.')
        const token = await secureCredentialStore.getAccessToken()
        if (!active.current || !token)
          throw new Error('Authenticated session changed.')
        return token
      },
    })
    const api = createAssessmentApi(client)
    return {
      api,
      journeyApi: createNativeGuidedJourneyApi(
        api,
        createCombinedMeaningApi(client),
        () => active.current,
      ),
    }
  })

  return <AssessmentJourneyScreen api={api} journeyApi={journeyApi} />
}
