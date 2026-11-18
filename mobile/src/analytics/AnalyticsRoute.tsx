import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { createNotificationApi } from '@/notifications/notification-api'
import { createCareProfileApi, loadCareProfile } from '@/profile/profile-api'
import { secureCredentialStore } from '@/security/credential-store'

import { createActivityApi, type ActivityRange } from './activity-api'
import { AnalyticsScreen } from './AnalyticsScreen'

export function AnalyticsRoute() {
  const config = useRuntimeConfig()
  const { session } = useSession()
  const subject = session?.role === 'USER' ? session.subject : undefined
  const queryClient = useQueryClient()
  const [range, setRange] = useState<ActivityRange>(30)
  const timezone =
    new Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh'
  const [services] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      getActivity: createActivityApi(client),
      profile: createCareProfileApi(client),
      notifications: createNotificationApi(client),
    }
  })
  const profile = useQuery({
    queryKey: ['care-profile', subject],
    enabled: Boolean(subject),
    queryFn: () => loadCareProfile(services.profile),
  })
  const notifications = useQuery({
    queryKey: ['notifications', subject, 'USER', 'home'],
    enabled: Boolean(subject),
    queryFn: () => services.notifications.list(),
  })
  const activity = useQuery({
    queryKey: ['activity-dashboard', subject, range, timezone],
    enabled: Boolean(subject),
    retry: false,
    refetchOnMount: 'always',
    queryFn: ({ signal }) => services.getActivity(range, timezone, signal),
  })
  useFocusEffect(
    useCallback(() => {
      if (subject) {
        void queryClient.invalidateQueries(
          { queryKey: ['activity-dashboard', subject, range, timezone] },
          { cancelRefetch: false },
        )
      }
    }, [queryClient, subject, range, timezone]),
  )

  if (!subject) return null
  const initials = profile.data?.displayName
    ?.trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word.charAt(0).toLocaleUpperCase('vi'))
    .join('')
  return (
    <AnalyticsScreen
      key={subject}
      range={range}
      onRangeChange={setRange}
      data={activity.isSuccess ? activity.data : undefined}
      loading={activity.isPending || activity.isFetching}
      retry={() => void activity.refetch()}
      goBack={() =>
        router.canGoBack() ? router.back() : router.replace('/(user)/user')
      }
      openCheckIn={() => router.push('/(user)/emotion')}
      header={{
        initials: initials || '◎',
        unread: Boolean(
          notifications.isSuccess && notifications.data.unreadCount,
        ),
        messages: () => router.push('/(user)/messages'),
        notifications: () => router.push('/(user)/notifications'),
        profile: () => router.push('/(user)/profile'),
      }}
    />
  )
}
