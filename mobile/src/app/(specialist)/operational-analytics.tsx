import { router } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { Screen } from '@/components/Screen'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { SpecialistOverviewTabBar } from '@/navigation/SpecialistOverviewTabBar'
import { secureCredentialStore } from '@/security/credential-store'
import { SpecialistAnalyticsPanel } from '@/specialist/SpecialistAnalyticsPanel'
import { colors } from '@/theme/tokens'

export default function SpecialistAnalyticsRoute() {
  const { session } = useSession()
  const config = useRuntimeConfig()
  const api = useMemo(
    () =>
      createApiClient({
        config,
        getBearerToken: () => secureCredentialStore.getAccessToken(),
      }),
    [config],
  )

  return (
    <Screen
      layout="dashboard"
      backgroundColor="#F8F8F2"
      bottomActions={<SpecialistOverviewTabBar />}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => router.dismissTo('/(specialist)/specialist')}
        style={s.back}
      >
        <Text style={s.label}>← Về Tổng quan</Text>
      </Pressable>
      <SpecialistAnalyticsPanel api={api} subject={session?.subject} />
    </Screen>
  )
}

const s = StyleSheet.create({
  back: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginBottom: 6,
  },
  label: { color: colors.tealDeep, fontWeight: '700' },
})
