import { router } from 'expo-router'
import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { createResourceApi } from '@/resources/resource-api'
import { secureCredentialStore } from '@/security/credential-store'
import { createSupportPlanActionApi } from '@/support-plan/support-plan-action-api'

import { createRewardApi } from './reward-api'
import { RewardCollectionScreen } from './RewardCollectionScreen'

export function RewardCollectionRoute() {
  const { session, status } = useSession()
  if (status !== 'authenticated' || !session || session.role !== 'USER')
    return null
  return <AccountRewardCollectionRoute key={session.subject} />
}

function AccountRewardCollectionRoute() {
  const config = useRuntimeConfig()
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      api: createRewardApi(client),
      planApi: createSupportPlanActionApi(client),
      resourceApi: createResourceApi(client),
    }
  })
  return (
    <RewardCollectionScreen
      {...binding}
      onBack={() => router.back()}
      onOpenResource={(resourceId) =>
        router.push({
          pathname: '/(user)/resources/[resourceId]',
          params: { resourceId },
        })
      }
    />
  )
}
