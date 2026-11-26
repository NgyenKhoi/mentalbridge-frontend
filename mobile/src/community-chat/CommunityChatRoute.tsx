import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState, type ReactNode } from 'react'
import { AppState, BackHandler, View } from 'react-native'
import { z } from 'zod'
import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import {
  createCommunityApi,
  type CommunityApi,
} from '@/community/community-api'
import {
  CommunityHeader,
  SkeletonGroup,
  SkeletonRow,
  StateCard,
  type CommunityTab,
} from '@/community/community-ui'
import { communityColors } from '@/community/community-theme'
import { Screen } from '@/components/Screen'
import type { RuntimeConfig } from '@/config/runtime-config'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { DashboardFontProvider } from '@/theme/dashboard-fonts'
import {
  createCommunityChatApi,
  type CommunityChatApi,
} from './community-chat-api'
import {
  createCommunitySocketFactory,
  type CommunitySocketFactory,
} from './community-chat-socket'
import { CommunityChatInbox, type ChatTarget } from './CommunityChatInbox'
import { setViewedConversation } from './CommunityInboxBanner'
import { CommunityChatPrivacy } from './CommunityChatPrivacy'
import { CommunityConversationScreen } from './CommunityConversationScreen'
import {
  ChatFrame,
  ChatTabBar,
  ChatUnavailable,
  goCommunityTab,
} from './community-chat-ui'

export const chatTargetSchema = z
  .strictObject({
    conversationId: z.uuid().optional(),
    requestId: z.uuid().optional(),
    invitationId: z.uuid().optional(),
    peerId: z.uuid().optional(),
  })
  .refine(
    (value) =>
      Object.values(value).filter((item) => item !== undefined).length <= 1,
  )
export function CommunityChatScreen({
  api,
  community,
  factory,
  subject,
  target,
  onBack,
  onTab,
}: Readonly<{
  api: CommunityChatApi
  community: CommunityApi
  factory: CommunitySocketFactory
  subject: string
  target: ChatTarget
  /** Back from the inbox: the feed, never app Home. */
  onBack: () => void
  onTab: (tab: CommunityTab) => void
}>) {
  const [conversationId, setConversationId] = useState(
    target.conversationId ?? null,
  )
  const [privacy, setPrivacy] = useState(false),
    [foreground, setForeground] = useState(AppState.currentState === 'active')
  const [epoch, setEpoch] = useState(0)
  const profile = useQuery({
    queryKey: ['community-chat', subject, 'own-profile'],
    queryFn: () => community.profile(),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
  const ownId =
    profile.data?.profile.status === 'ACTIVE'
      ? profile.data.profile.communityProfileId
      : null
  const inboxMounted = Boolean(ownId) && !profile.isFetching && !profile.isError
  useEffect(() => {
    setViewedConversation(conversationId)
    return () => setViewedConversation(null)
  }, [conversationId])
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      setForeground(next === 'active')
      if (next === 'active') setEpoch((value) => value + 1)
    })
    return () => subscription.remove()
  }, [])
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (conversationId) return false
        if (privacy) {
          setPrivacy(false)
          return true
        }
        // The inbox owns back once it is mounted; every earlier state leaves to the feed.
        if (inboxMounted) return false
        onBack()
        return true
      },
    )
    return () => subscription.remove()
  }, [conversationId, privacy, onBack, inboxMounted])
  const frame = (children: ReactNode) => (
    <ChatFrame
      header={<CommunityHeader padded size="large" title="Tin nhắn" />}
      footer={<ChatTabBar onTab={onTab} />}
    >
      {children}
    </ChatFrame>
  )
  return (
    <View
      style={[{ flex: 1 }, !foreground && { display: 'none' }]}
      accessibilityElementsHidden={!foreground}
      importantForAccessibility={foreground ? 'auto' : 'no-hide-descendants'}
    >
      {profile.isFetching ? (
        frame(
          <SkeletonGroup label="Đang xác nhận danh tính cộng đồng…">
            <SkeletonRow size={44} />
            <SkeletonRow size={44} />
          </SkeletonGroup>,
        )
      ) : profile.isError ? (
        frame(<ChatUnavailable onRetry={() => void profile.refetch()} />)
      ) : !ownId ? (
        frame(
          <StateCard
            icon="account-outline"
            title="Tạo hoặc khôi phục danh tính cộng đồng của bạn trước khi trò chuyện."
            actionLabel="Về cộng đồng"
            onAction={onBack}
          />,
        )
      ) : conversationId ? (
        <CommunityConversationScreen
          key={conversationId}
          api={api}
          community={community}
          factory={factory}
          subject={subject}
          ownId={ownId}
          conversationId={conversationId}
          onBack={() => setConversationId(null)}
        />
      ) : (
        foreground &&
        (privacy ? (
          <CommunityChatPrivacy
            key={epoch}
            api={api}
            subject={subject}
            onBack={() => setPrivacy(false)}
          />
        ) : (
          <CommunityChatInbox
            key={epoch}
            api={api}
            subject={subject}
            ownId={ownId}
            target={target}
            onOpen={setConversationId}
            onPrivacy={() => setPrivacy(true)}
            onBack={onBack}
            onTab={onTab}
          />
        ))
      )}
    </View>
  )
}
function AccountChatRoute({
  config,
  subject,
  target,
}: Readonly<{ config: RuntimeConfig; subject: string; target: ChatTarget }>) {
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      client,
      api: createCommunityChatApi(client),
      community: createCommunityApi(client),
      factory: createCommunitySocketFactory(config.apiBaseUrl),
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
      <CommunityChatScreen
        {...binding}
        subject={subject}
        target={target}
        onBack={() => router.replace('/(user)/community')}
        onTab={goCommunityTab}
      />
    </>
  )
}
export function CommunityChatRoute() {
  const config = useRuntimeConfig(),
    { session } = useSession()
  const params = useLocalSearchParams()
  const parsed = chatTargetSchema.safeParse(params)
  return (
    <DashboardFontProvider>
      {!session || session.role !== 'USER' || !parsed.success ? (
        <Screen backgroundColor={communityColors.background}>
          <StateCard
            icon="link-variant-off"
            title="Liên kết trò chuyện hoặc phiên đăng nhập không hợp lệ."
            actionLabel="Quay lại"
            onAction={() => router.back()}
          />
        </Screen>
      ) : (
        <AccountChatRoute
          key={`${session.subject}:${JSON.stringify(parsed.data)}`}
          subject={session.subject}
          config={config}
          target={parsed.data}
        />
      )}
    </DashboardFontProvider>
  )
}
