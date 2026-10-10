import { router } from 'expo-router'
import { useEffect, useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import { createDiscoveryApi } from './discovery-api'
import { DiscoveryScreen } from './DiscoveryScreen'

function AccountDiscoveryRoute({
  config,
}: Readonly<{ config: RuntimeConfig }>) {
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return { client, api: createDiscoveryApi(client) }
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
  return <DiscoveryScreen api={binding.api} onBack={() => router.back()} />
}

export function DiscoveryRoute() {
  const config = useRuntimeConfig()
  const { session } = useSession()
  return <AccountDiscoveryRoute key={session?.subject ?? ''} config={config} />
}
