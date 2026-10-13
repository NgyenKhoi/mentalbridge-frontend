import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { createEmotionApi } from '@/emotion/emotion-api'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import { createSupportPlanApi } from './support-plan-api'
import { createSupportPlanActionApi } from './support-plan-action-api'
import { SupportPlanActionWorkspace } from './SupportPlanActionWorkspace'
import { parseEmotionPlanOrigin } from './emotion-plan-context'

export function SupportPlanRoute() {
  const runtimeConfig = useRuntimeConfig()
  const { proposalId, occurrenceId, actionId } = useLocalSearchParams<{
    proposalId?: string
    occurrenceId?: string
    actionId?: string
  }>()
  const [services] = useState(() => {
    const client = createApiClient({
      config: runtimeConfig,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      legacyApi: createSupportPlanApi(client),
      api: createSupportPlanActionApi(client),
      emotionApi: createEmotionApi(client),
    }
  })

  return (
    <SupportPlanActionWorkspace
      {...services}
      origin={parseEmotionPlanOrigin(occurrenceId, actionId)}
      {...(typeof proposalId === 'string' ? { proposalId } : {})}
    />
  )
}
