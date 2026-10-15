import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
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
  const [api] = useState(() =>
    createResourceApi(
      createApiClient({
        config: runtimeConfig,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
    ),
  )
  const activityDate = first(params.date)

  return (
    <ResourceDetailScreen
      api={api}
      {...(activityDate ? { activityDate } : {})}
      onBack={() => router.back()}
      resourceId={first(params.resourceId) ?? ''}
    />
  )
}
