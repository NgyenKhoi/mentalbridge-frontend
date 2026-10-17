import { Stack } from 'expo-router'

import { useSession } from '@/auth/session-context'
import { readRuntimeConfig } from '@/config/runtime-config'
import { getRouteGuards } from '@/navigation/route-policy'
import { AppProviders } from '@/providers/AppProviders'
import { SessionStatusScreen } from '@/screens/SessionStatusScreen'

const runtimeConfig = readRuntimeConfig()

function RootNavigator() {
  const { retryRestore, session, status } = useSession()

  if (status === 'restoring') return <SessionStatusScreen />
  if (status === 'unavailable') {
    return (
      <SessionStatusScreen unavailable onRetry={() => void retryRestore()} />
    )
  }

  const guards = getRouteGuards(session)

  return (
    <Stack screenOptions={{ animation: 'none', headerShown: false }}>
      <Stack.Protected guard={guards.public}>
        <Stack.Screen name="(public)" />
      </Stack.Protected>
      <Stack.Protected guard={guards.user}>
        <Stack.Screen name="(user)" />
      </Stack.Protected>
      <Stack.Protected guard={guards.specialist}>
        <Stack.Screen name="(specialist)" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AppProviders runtimeConfig={runtimeConfig}>
      <RootNavigator />
    </AppProviders>
  )
}
