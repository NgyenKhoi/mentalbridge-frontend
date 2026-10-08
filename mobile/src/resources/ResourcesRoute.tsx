import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import { createResourceApi } from './resource-api'
import { resourceCategorySchema } from './resource-contract'
import { resourceDetailHref } from './resource-route'
import { ResourcesScreen } from './ResourcesScreen'

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function ResourcesRoute() {
  const runtimeConfig = useRuntimeConfig()
  const params = useLocalSearchParams<{
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
  const category = resourceCategorySchema.safeParse(first(params.category))
  const initialDate = first(params.date)

  return (
    <ResourcesScreen
      api={api}
      initialCategory={category.success ? category.data : 'ALL'}
      {...(initialDate ? { initialDate } : {})}
      onBack={() => router.back()}
      onOpenResource={(resourceId, localDate, selectedCategory) =>
        router.push(resourceDetailHref(resourceId, localDate, selectedCategory))
      }
    />
  )
}
