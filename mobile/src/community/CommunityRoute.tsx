import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { z } from 'zod'

import { Screen } from '@/components/Screen'
import { PrimaryButton } from '@/components/PrimaryButton'

import { createApiClient } from '@/api/api-client'
import { createAssessmentApi } from '@/assessment/assessment-api'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { createResourceApi } from '@/resources/resource-api'
import { resourceDetailHref } from '@/resources/resource-route'
import { localDateInTimeZone } from '@/resources/resource-model'
import { secureCredentialStore } from '@/security/credential-store'

import { createCommunityApi } from './community-api'
import { createCircleApi } from './community-circle-api'
import { communityMediaTransport } from './community-media'
import { CommunityScreen } from './CommunityScreen'
import type { CommunitySection } from './CommunitySpace'

function AccountCommunityRoute({
  config,
  postId,
  section,
}: Readonly<{
  config: RuntimeConfig
  postId?: string
  section: CommunitySection
}>) {
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      client,
      api: createCommunityApi(client),
      circles: createCircleApi(client),
      resources: createResourceApi(client),
      safety: createAssessmentApi(client),
    }
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
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <CommunityScreen
        {...binding}
        {...(postId ? { initialPostId: postId } : {})}
        media={communityMediaTransport}
        initialSection={section}
        onBack={() => router.replace('/(user)/user')}
        onChat={() => router.push('/(user)/community-chat')}
        onPeerChat={(peerId) => {
          if (z.uuid().safeParse(peerId).success)
            router.push({
              pathname: '/(user)/community-chat',
              params: { peerId },
            })
        }}
        onResource={(resourceId) =>
          router.push(
            resourceDetailHref(
              resourceId,
              localDateInTimeZone(
                new Date(),
                Intl.DateTimeFormat().resolvedOptions().timeZone,
              ),
              'ALL',
            ),
          )
        }
      />
    </>
  )
}
export function CommunityRoute() {
  const config = useRuntimeConfig()
  const { session } = useSession()
  const params = useLocalSearchParams<{ postId?: string; section?: string }>()
  const section =
    z.enum(['feed', 'reels', 'groups', 'profile']).safeParse(params.section)
      .data ?? 'feed'
  const postId =
    params.postId === undefined ? null : z.uuid().safeParse(params.postId)
  if (postId && !postId.success)
    return (
      <Screen>
        <Text>Liên kết bài chia sẻ không hợp lệ.</Text>
        <PrimaryButton label="Quay lại" onPress={() => router.back()} />
      </Screen>
    )
  return (
    <AccountCommunityRoute
      key={`${session?.subject ?? ''}:${postId?.success ? postId.data : 'feed'}:${section}`}
      config={config}
      section={section}
      {...(postId?.success ? { postId: postId.data } : {})}
    />
  )
}
