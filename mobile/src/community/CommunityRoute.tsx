import { router, Stack } from 'expo-router'
import { useEffect, useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { createAssessmentApi } from '@/assessment/assessment-api'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { createResourceApi } from '@/resources/resource-api'
import { resourceDetailHref } from '@/resources/resource-route'
import { localDateInTimeZone } from '@/resources/resource-model'
import { secureCredentialStore } from '@/security/credential-store'

import { createCommunityApi } from './community-api'
import { communityMediaTransport } from './community-media'
import { CommunityScreen } from './CommunityScreen'

function AccountCommunityRoute({
  config,
}: Readonly<{ config: RuntimeConfig }>) {
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      client,
      api: createCommunityApi(client),
      resources: createResourceApi(client),
      safety: createAssessmentApi(client),
    }
  })
  useEffect(() => {
    const controller = new AbortController()
    const interceptor = binding.client.interceptors.request.use((request) => {
      request.signal = controller.signal
      return request
    })
    return () => {
      controller.abort()
      binding.client.interceptors.request.eject(interceptor)
    }
  }, [binding])
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <CommunityScreen
        {...binding}
        media={communityMediaTransport}
        onBack={() => router.back()}
        onResource={(resourceId) =>
          router.push(
            resourceDetailHref(
              resourceId,
              localDateInTimeZone(
                new Date(),
                Intl.DateTimeFormat().resolvedOptions().timeZone,
              ),
              'ALL',
            ),
          )
        }
      />
    </>
  )
}
export function CommunityRoute() {
  const config = useRuntimeConfig()
  const { session } = useSession()
  return <AccountCommunityRoute key={session?.subject ?? ''} config={config} />
}
