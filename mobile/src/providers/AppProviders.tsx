import { StatusBar } from 'expo-status-bar'
import { randomUUID } from 'expo-crypto'
import { type ReactNode, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { createApiClient } from '@/api/api-client'
import { createIdentityApi } from '@/auth/identity-api'
import {
  createSessionService,
  type SessionService,
} from '@/auth/identity-session-service'
import { SessionProvider } from '@/auth/session-context'
import type { AppSession } from '@/auth/session'
import { RuntimeConfigProvider } from '@/config/runtime-config-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { QueryProvider } from '@/query/QueryProvider'
import { secureCredentialStore } from '@/security/credential-store'

export function AppProviders({
  children,
  initialSession = null,
  runtimeConfig,
  sessionService,
}: Readonly<{
  children: ReactNode
  initialSession?: AppSession | null
  runtimeConfig: RuntimeConfig
  sessionService?: SessionService
}>) {
  const [service] = useState(
    () =>
      sessionService ??
      createSessionService({
        api: createIdentityApi(
          createApiClient({
            config: runtimeConfig,
            getBearerToken: () => secureCredentialStore.getAccessToken(),
          }),
        ),
        credentials: secureCredentialStore,
        createIdempotencyKey: randomUUID,
      }),
  )

  return (
    <RuntimeConfigProvider value={runtimeConfig}>
      <SafeAreaProvider>
        <QueryProvider>
          <SessionProvider initialSession={initialSession} service={service}>
            <StatusBar style="dark" />
            {children}
          </SessionProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </RuntimeConfigProvider>
  )
}
