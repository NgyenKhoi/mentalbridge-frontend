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
import { noJournalOrigin, parseJournalPlanOrigin } from './journal-plan-context'

export function SupportPlanRoute() {
  const runtimeConfig = useRuntimeConfig()
  const params = useLocalSearchParams<{
    proposalId?: string
    occurrenceId?: string
    actionId?: string
    source?: string
    localDate?: string
    journalId?: string
  }>()
  const { proposalId, occurrenceId, actionId } = params
  const journalContext =
    params.source !== undefined ||
    params.journalId !== undefined ||
    params.localDate !== undefined
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
      origin={
        journalContext
          ? { state: 'none' }
          : parseEmotionPlanOrigin(occurrenceId, actionId)
      }
      journalOrigin={
        journalContext ? parseJournalPlanOrigin(params) : noJournalOrigin
      }
      {...(typeof proposalId === 'string' ? { proposalId } : {})}
    />
  )
}
