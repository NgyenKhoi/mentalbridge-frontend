import { router, Stack } from 'expo-router'
import { useEffect, useState, type ReactNode } from 'react'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { Screen } from '@/components/Screen'
import {
  createCommunityApi,
  type CommunityApi,
} from '@/community/community-api'
import { communityColors } from '@/community/community-theme'
import { StateCard } from '@/community/community-ui'
import type { RuntimeConfig } from '@/config/runtime-config'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { DashboardFontProvider } from '@/theme/dashboard-fonts'

import {
  createCommunitySocialApi,
  type CommunitySocialApi,
} from './community-social-api'

export type SocialBinding = Readonly<{
  subject: string
  social: CommunitySocialApi
  community: CommunityApi
}>

function Account({
  config,
  subject,
  children,
}: Readonly<{
  config: RuntimeConfig
  subject: string
  children: (binding: SocialBinding) => ReactNode
}>) {
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      client,
      social: createCommunitySocialApi(client),
      community: createCommunityApi(client),
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
      {children({
        subject,
        social: binding.social,
        community: binding.community,
      })}
    </>
  )
}

/** Route shell of the friends, groups and member screens: fonts, an account-scoped API client, and the invalid-link or no-session fallback. */
export function SocialRoute({
  invalidLink,
  children,
}: Readonly<{
  /** True when a route param failed validation; no client is created. */
  invalidLink: boolean
  children: (binding: SocialBinding) => ReactNode
}>) {
  const config = useRuntimeConfig()
  const { session } = useSession()
  return (
    <DashboardFontProvider>
      {!session || invalidLink ? (
        <Screen backgroundColor={communityColors.background}>
          <StateCard
            icon="link-variant-off"
            title="Liên kết hoặc phiên đăng nhập không hợp lệ."
            actionLabel="Quay lại"
            onAction={() => router.back()}
          />
        </Screen>
      ) : (
        <Account
          key={session.subject}
          config={config}
          subject={session.subject}
        >
          {children}
        </Account>
      )}
    </DashboardFontProvider>
  )
}
