import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { createRewardApi } from '@/rewards/reward-api'
import { secureCredentialStore } from '@/security/credential-store'

import { createResourceApi } from './resource-api'
import { ResourceDetailScreen } from './ResourceDetailScreen'

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function ResourceDetailRoute() {
  const runtimeConfig = useRuntimeConfig()
  const params = useLocalSearchParams<{
    resourceId?: string | string[]
    date?: string | string[]
    category?: string | string[]
  }>()
  const [binding] = useState(() => {
    const client = createApiClient({
      config: runtimeConfig,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      api: createResourceApi(client),
      rewardApi: createRewardApi(client),
    }
  })
  const activityDate = first(params.date)

  return (
    <ResourceDetailScreen
      {...binding}
      {...(activityDate ? { activityDate } : {})}
      onBack={() => router.back()}
      resourceId={first(params.resourceId) ?? ''}
    />
  )
}
