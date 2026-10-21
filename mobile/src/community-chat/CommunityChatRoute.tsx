import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState, BackHandler, View } from 'react-native'
import { z } from 'zod'
import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import {
  createCommunityApi,
  type CommunityApi,
} from '@/community/community-api'
import { Screen } from '@/components/Screen'
import type { RuntimeConfig } from '@/config/runtime-config'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import {
  createCommunityChatApi,
  type CommunityChatApi,
} from './community-chat-api'
import {
  createCommunitySocketFactory,
  type CommunitySocketFactory,
} from './community-chat-socket'
import { CommunityChatInbox, type ChatTarget } from './CommunityChatInbox'
import { CommunityChatPrivacy } from './CommunityChatPrivacy'
import { CommunityConversationScreen } from './CommunityConversationScreen'
import {
  ChatButton,
  ChatNotice,
  ChatUnavailable,
  chatStyles as s,
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
}: Readonly<{
  api: CommunityChatApi
  community: CommunityApi
  factory: CommunitySocketFactory
  subject: string
  target: ChatTarget
  onBack: () => void
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
        return false
      },
    )
    return () => subscription.remove()
  }, [conversationId, privacy])
  const ownId =
    profile.data?.profile.status === 'ACTIVE'
      ? profile.data.profile.communityProfileId
      : null
  return (
    <Screen>
      <View
        style={[s.column, !foreground && { display: 'none' }]}
        accessibilityElementsHidden={!foreground}
        importantForAccessibility={foreground ? 'auto' : 'no-hide-descendants'}
      >
        {profile.isFetching ? (
          <ChatNotice>Đang xác nhận danh tính cộng đồng…</ChatNotice>
        ) : profile.isError ? (
          <>
            <ChatButton label="Về cộng đồng" onPress={onBack} />
            <ChatUnavailable onRetry={() => void profile.refetch()} />
          </>
        ) : !ownId ? (
          <>
            <ChatNotice>
              Tạo hoặc khôi phục danh tính cộng đồng của bạn trước khi trò
              chuyện.
            </ChatNotice>
            <ChatButton label="Về cộng đồng" onPress={onBack} />
          </>
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
            />
          ))
        )}
      </View>
    </Screen>
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
        onBack={() => router.back()}
      />
    </>
  )
}
export function CommunityChatRoute() {
  const config = useRuntimeConfig(),
    { session } = useSession()
  const params = useLocalSearchParams()
  const parsed = chatTargetSchema.safeParse(params)
  if (!session || session.role !== 'USER' || !parsed.success)
    return (
      <Screen>
        <ChatNotice>
          Liên kết trò chuyện hoặc phiên đăng nhập không hợp lệ.
        </ChatNotice>
        <ChatButton label="Quay lại" onPress={() => router.back()} />
      </Screen>
    )
  return (
    <AccountChatRoute
      key={`${session.subject}:${JSON.stringify(parsed.data)}`}
      subject={session.subject}
      config={config}
      target={parsed.data}
    />
  )
}
