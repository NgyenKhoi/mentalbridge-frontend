import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { createEmotionApi } from '@/emotion/emotion-api'
import { createHomeApi } from '@/home/home-api'
import { createRewardApi } from '@/rewards/reward-api'
import { createSupportPlanActionApi } from '@/support-plan/support-plan-action-api'
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
  const [services] = useState(() => {
    const client = createApiClient({
      config: runtimeConfig,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      api: createResourceApi(client),
      emotionApi: createEmotionApi(client),
      homeApi: createHomeApi(client),
      rewardApi: createRewardApi(client),
      planApi: createSupportPlanActionApi(client),
    }
  })
  const category = resourceCategorySchema.safeParse(first(params.category))
  const initialDate = first(params.date)

  return (
    <ResourcesScreen
      {...services}
      initialCategory={category.success ? category.data : 'ALL'}
      {...(initialDate ? { initialDate } : {})}
      onBack={() => router.back()}
      onHome={() => router.replace('/(user)/user')}
      onOpenResource={(resourceId, localDate, selectedCategory) =>
        router.push(resourceDetailHref(resourceId, localDate, selectedCategory))
      }
    />
  )
}
