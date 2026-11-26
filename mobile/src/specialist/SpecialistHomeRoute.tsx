import { useQuery } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { useCallback, useMemo } from 'react'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { SpecialistHomeScreen } from '@/screens/SpecialistHomeScreen'
import { secureCredentialStore } from '@/security/credential-store'

import { specialistDashboardSchema } from './specialist-dashboard-contract'

export default function SpecialistHomeRoute() {
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
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['specialist-dashboard', session?.subject],
    enabled: session?.role === 'SPECIALIST',
    queryFn: async ({ signal }) => {
      const response = await api.get('/api/v1/specialist/dashboard', { signal })
      return specialistDashboardSchema.parse(response.data)
    },
  })
  useFocusEffect(
    useCallback(() => {
      if (session?.role === 'SPECIALIST') void refetch({ cancelRefetch: false })
    }, [refetch, session?.role]),
  )
  return (
    <SpecialistHomeScreen
      dashboard={data}
      loading={isPending}
      failed={isError}
      onRetry={() => void refetch()}
    />
  )
}
