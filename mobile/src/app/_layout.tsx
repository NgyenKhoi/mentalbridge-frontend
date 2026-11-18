import { Stack, usePathname } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { useSession } from '@/auth/session-context'
import { CommunityInboxBanner } from '@/community-chat/CommunityInboxBanner'
import { readRuntimeConfig } from '@/config/runtime-config'
import { CrisisSupportOffsetContext } from '@/crisis-support/crisis-support-offset'
import { CrisisSupportWidget } from '@/crisis-support/CrisisSupportWidget'
import { useSafetyButtonLift } from '@/crisis-support/safety-button-lift'
import { isUserTabPath, USER_TAB_BAR_HEIGHT } from '@/navigation/UserTabBar'
import { getRouteGuards } from '@/navigation/route-policy'
import { AppProviders } from '@/providers/AppProviders'
import { SessionStatusScreen } from '@/screens/SessionStatusScreen'

const runtimeConfig = readRuntimeConfig()

export function RootNavigator() {
  const { retryRestore, session, status } = useSession()

  const pathname = usePathname()
  const footerLift = useSafetyButtonLift()
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
      {session?.role === 'USER' && (
        <CommunityInboxBanner subject={session.subject} />
      )}
      {!(pathname === '/' && status === 'unauthenticated') &&
        (pathname !== '/community' || status !== 'authenticated') && (
          <CrisisSupportWidget
            bottomOffset={
              status === 'authenticated' &&
              session?.role === 'USER' &&
              isUserTabPath(pathname)
                ? USER_TAB_BAR_HEIGHT +
                  (pathname === '/journal'
                    ? Math.max(screenActionHeight, footerLift)
                    : 0)
                : pathname === '/community-chat'
                  ? USER_TAB_BAR_HEIGHT
                  : pathname === '/messages' ||
                      (pathname === '/ai-companion' && session?.role === 'USER')
                    ? Math.max(screenActionHeight, footerLift)
                    : footerLift
            }
          />
        )}
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
