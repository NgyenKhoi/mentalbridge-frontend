import { Stack, usePathname } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { useSession } from '@/auth/session-context'
import { readRuntimeConfig } from '@/config/runtime-config'
import { CrisisSupportOffsetContext } from '@/crisis-support/crisis-support-offset'
import { CrisisSupportWidget } from '@/crisis-support/CrisisSupportWidget'
import { isUserTabPath, USER_TAB_BAR_HEIGHT } from '@/navigation/UserTabBar'
import { getRouteGuards } from '@/navigation/route-policy'
import { AppProviders } from '@/providers/AppProviders'
import { SessionStatusScreen } from '@/screens/SessionStatusScreen'
import { OnboardingGuideProvider } from '@/onboarding/OnboardingGuide'

const runtimeConfig = readRuntimeConfig()

export function RootNavigator() {
  const { retryRestore, session, status } = useSession()

  const pathname = usePathname()
  const [screenActionHeight, setScreenActionHeight] = useState(0)

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
      <CrisisSupportOffsetContext.Provider value={setScreenActionHeight}>
        {content}
      </CrisisSupportOffsetContext.Provider>
      {!(pathname === '/' && status === 'unauthenticated') &&
        (pathname !== '/community' || status !== 'authenticated') && (
          <CrisisSupportWidget
            bottomOffset={
              status === 'authenticated' &&
              session?.role === 'USER' &&
              isUserTabPath(pathname)
                ? USER_TAB_BAR_HEIGHT +
                  (pathname === '/journal' ? screenActionHeight : 0)
                : (pathname === '/specialist' ||
                      pathname === '/operational-analytics' ||
                      pathname === '/appointments' ||
                      pathname.startsWith('/appointments/') ||
                      pathname === '/clients' ||
                      pathname === '/profile' ||
                      pathname === '/availability') &&
                    session?.role === 'SPECIALIST'
                  ? USER_TAB_BAR_HEIGHT
                  : pathname === '/community-chat'
                    ? USER_TAB_BAR_HEIGHT
                    : pathname === '/messages' ||
                        (pathname === '/ai-companion' &&
                          session?.role === 'USER')
                      ? screenActionHeight
                      : 0
            }
          />
        )}
    </View>
  )
}

export default function RootLayout() {
  return (
    <AppProviders runtimeConfig={runtimeConfig}>
      <OnboardingGuideProvider>
        <RootNavigator />
      </OnboardingGuideProvider>
    </AppProviders>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
