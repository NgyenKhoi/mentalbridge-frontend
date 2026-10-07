import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import { createSupportPlanApi } from './support-plan-api'
import { SupportPlanScreen } from './SupportPlanScreen'

export function SupportPlanRoute() {
  const runtimeConfig = useRuntimeConfig()
  const { proposalId } = useLocalSearchParams<{ proposalId?: string }>()
  const [api] = useState(() =>
    createSupportPlanApi(
      createApiClient({
        config: runtimeConfig,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
    ),
  )

  return (
    <SupportPlanScreen
      api={api}
      {...(typeof proposalId === 'string' ? { proposalId } : {})}
    />
  )
}
