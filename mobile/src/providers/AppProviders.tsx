import { StatusBar } from 'expo-status-bar'
import type { ReactNode } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { SessionProvider } from '@/auth/session-context'
import type { AppSession } from '@/auth/session'
import { RuntimeConfigProvider } from '@/config/runtime-config-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { QueryProvider } from '@/query/QueryProvider'

export function AppProviders({
  children,
  initialSession = null,
  runtimeConfig,
}: Readonly<{
  children: ReactNode
  initialSession?: AppSession | null
  runtimeConfig: RuntimeConfig
}>) {
  return (
    <RuntimeConfigProvider value={runtimeConfig}>
      <SafeAreaProvider>
        <QueryProvider>
          <SessionProvider initialSession={initialSession}>
            <StatusBar style="dark" />
            {children}
          </SessionProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </RuntimeConfigProvider>
  )
}
