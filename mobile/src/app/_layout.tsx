import { Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { useSession } from '@/auth/session-context'
import { readRuntimeConfig } from '@/config/runtime-config'
import { CrisisSupportWidget } from '@/crisis-support/CrisisSupportWidget'
import { getRouteGuards } from '@/navigation/route-policy'
import { AppProviders } from '@/providers/AppProviders'
import { SessionStatusScreen } from '@/screens/SessionStatusScreen'

const runtimeConfig = readRuntimeConfig()

export function RootNavigator() {
  const { retryRestore, session, status } = useSession()

  let content

  if (status === 'restoring') content = <SessionStatusScreen />
  if (status === 'unavailable') {
    content = (
      <SessionStatusScreen unavailable onRetry={() => void retryRestore()} />
    )
  }

  if (!content) {
    const guards = getRouteGuards(session)

    content = (
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

  return (
    <View style={styles.root}>
      {content}
      <CrisisSupportWidget />
    </View>
  )
}

export default function RootLayout() {
  return (
    <AppProviders runtimeConfig={runtimeConfig}>
      <RootNavigator />
    </AppProviders>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
