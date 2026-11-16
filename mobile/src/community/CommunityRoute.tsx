import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { Screen } from '@/components/Screen'

import { createApiClient } from '@/api/api-client'
import { createAssessmentApi } from '@/assessment/assessment-api'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { createResourceApi } from '@/resources/resource-api'
import { resourceDetailHref } from '@/resources/resource-route'
import { localDateInTimeZone } from '@/resources/resource-model'
import { secureCredentialStore } from '@/security/credential-store'
import { DashboardFontProvider } from '@/theme/dashboard-fonts'

import { openMemberPage } from '@/community-social/community-social-nav'

import { createCommunityApi } from './community-api'
import { communityColors } from './community-theme'
import { communityMediaTransport } from './community-media'
import { CommunityNavContext, type CommunityNav } from './community-nav'
import { CommunityScreen } from './CommunityScreen'
import { StateCard } from './community-ui'

const communityNav: CommunityNav = {
  openFriends: () => router.push('/(user)/community-friends'),
  openGroups: () => router.push('/(user)/community-groups'),
  openMember: openMemberPage,
}

// Tab switches from the chat inbox arrive as a `panel` param.
const panelSchema = z.enum(['feed', 'moments', 'me', 'composer'])
type Panel = z.infer<typeof panelSchema>

function AccountCommunityRoute({
  config,
  postId,
  panel,
}: Readonly<{ config: RuntimeConfig; postId?: string; panel?: Panel }>) {
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      client,
      api: createCommunityApi(client),
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
      <CommunityNavContext.Provider value={communityNav}>
        <CommunityScreen
          {...binding}
          {...(postId ? { initialPostId: postId } : {})}
          {...(panel ? { initialPanel: panel } : {})}
          media={communityMediaTransport}
          onBack={() => router.back()}
          onChat={() => router.replace('/(user)/community-chat')}
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
      </CommunityNavContext.Provider>
    </>
  )
}
export function CommunityRoute() {
  const config = useRuntimeConfig()
  const { session } = useSession()
  const params = useLocalSearchParams<{ postId?: string; panel?: string }>()
  const panel = panelSchema.safeParse(params.panel)
  const postId =
    params.postId === undefined ? null : z.uuid().safeParse(params.postId)
  return (
    <DashboardFontProvider>
      {postId && !postId.success ? (
        <Screen backgroundColor={communityColors.background}>
          <StateCard
            icon="link-variant-off"
            title="Liên kết bài chia sẻ không hợp lệ."
            actionLabel="Quay lại"
            onAction={() => router.back()}
          />
        </Screen>
      ) : (
        <AccountCommunityRoute
          key={`${session?.subject ?? ''}:${postId?.success ? postId.data : panel.success ? panel.data : 'feed'}`}
          config={config}
          {...(postId?.success ? { postId: postId.data } : {})}
          {...(panel.success ? { panel: panel.data } : {})}
        />
      )}
    </DashboardFontProvider>
  )
}
