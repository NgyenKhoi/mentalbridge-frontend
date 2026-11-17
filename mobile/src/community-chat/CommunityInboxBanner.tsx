import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createApiClient } from '@/api/api-client'
import { createCommunityApi } from '@/community/community-api'
import { communityColors } from '@/community/community-theme'
import { CommunityIcon, IconButton } from '@/community/community-ui'
import { PressableScale } from '@/components/PressableScale'
import {
  bannerEntering,
  bannerExiting,
  useMotionProps,
} from '@/components/motion'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'
import { createCommunityChatApi } from './community-chat-api'
import type { CommunityConversation } from './community-chat-contract'
import { conversationName } from './community-chat-ui'

const POLL_MS = 12_000
// An unavailable endpoint (staging returns 404) is retried slowly instead of hammered.
const ERROR_POLL_MS = 60_000
const DISMISS_MS = 9_000
const NOTICE_TITLE = 'Bạn có tin nhắn mới'

// The conversation the chat screen shows right now; a rise there is already on screen.
let viewedConversation: string | null = null
export const setViewedConversation = (id: string | null) => {
  viewedConversation = id
}

/**
 * In-app notice for a new community chat message (web: CommunityInboxProvider).
 * shortcut: polls only the first conversations page (50 newest), web walks every page; upgrade if users hold more.
 * react-query pauses the interval in the background and refetches on return to
 * the foreground (query-lifecycle). Errors stay silent and back off to ERROR_POLL_MS.
 */
export function CommunityInboxBanner({
  subject,
}: Readonly<{ subject: string }>) {
  const config = useRuntimeConfig()
  const insets = useSafeAreaInsets()
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      chat: createCommunityChatApi(client),
      community: createCommunityApi(client),
    }
  })
  const list = useQuery({
    queryKey: ['community-chat', subject, 'inbox-banner'],
    queryFn: () => binding.chat.conversations(),
    refetchInterval: (query) =>
      query.state.status === 'error' ? ERROR_POLL_MS : POLL_MS,
    retry: false,
    staleTime: 0,
  })
  // Direct chats list both members, so the peer name needs our own profile id.
  const profile = useQuery({
    queryKey: ['community-chat', subject, 'banner-own-profile'],
    queryFn: () => binding.community.profile(),
    enabled: Boolean(list.data),
    retry: false,
    staleTime: Infinity,
  })
  const ownId =
    profile.data?.profile.status === 'ACTIVE'
      ? profile.data.profile.communityProfileId
      : null
  const [notice, setNotice] = useState<CommunityConversation | null>(null)
  const baseline = useRef<Map<string, number> | null>(null)
  const items = list.data?.items
  useEffect(() => {
    if (!items) return
    const before = baseline.current
    baseline.current = new Map(
      items.map((item) => [item.conversationId, item.unreadCount]),
    )
    if (!before) return
    const incoming = items.find(
      (item) =>
        item.unreadCount > (before.get(item.conversationId) ?? 0) &&
        item.conversationId !== viewedConversation,
    )
    if (incoming) setNotice(incoming)
  }, [items])
  const [screenReader, setScreenReader] = useState(false)
  useEffect(() => {
    let live = true
    AccessibilityInfo.isScreenReaderEnabled().then(
      (on) => live && setScreenReader(on),
    )
    const sub = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReader,
    )
    return () => {
      live = false
      sub.remove()
    }
  }, [])
  useEffect(() => {
    if (!notice) return
    AccessibilityInfo.announceForAccessibility(NOTICE_TITLE)
  }, [notice])
  useEffect(() => {
    // A screen reader user needs time to reach the card, so it stays until dismissed.
    if (!notice || screenReader) return
    const timer = setTimeout(() => setNotice(null), DISMISS_MS)
    return () => clearTimeout(timer)
  }, [notice, screenReader])
  const motion = useMotionProps({
    entering: bannerEntering,
    exiting: bannerExiting,
  })
  const name =
    notice?.kind === 'GROUP'
      ? notice.groupName
      : notice && ownId
        ? conversationName(notice, ownId)
        : null
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}
    >
      {notice && (
        <Animated.View
          key={`${notice.conversationId}:${notice.unreadCount}`}
          {...motion}
          testID="community-inbox-banner"
          accessibilityLiveRegion="polite"
          style={styles.card}
        >
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={['Mở cuộc trò chuyện', name]
              .filter(Boolean)
              .join(': ')}
            onPress={() => {
              setNotice(null)
              router.navigate({
                pathname: '/(user)/community-chat',
                params: { conversationId: notice.conversationId },
              })
            }}
            scaleTo={0.98}
            style={styles.body}
          >
            <View style={styles.icon}>
              <CommunityIcon name="message-text-outline" size={22} />
            </View>
            <View style={styles.text}>
              <Txt numberOfLines={1} style={styles.title}>
                {NOTICE_TITLE}
              </Txt>
              {name && (
                <Txt numberOfLines={1} style={styles.name}>
                  {name}
                </Txt>
              )}
            </View>
          </PressableScale>
          <IconButton
            icon="close"
            label="Đóng thông báo"
            onPress={() => setNotice(null)}
          />
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    // Above screen headers; elevation orders siblings on Android.
    zIndex: 50,
    elevation: 50,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: communityColors.white,
    borderColor: communityColors.line,
    borderWidth: 1,
    borderRadius: radii.panel,
    padding: spacing.sm,
    elevation: 8,
    shadowColor: communityColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  body: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: communityColors.mint,
  },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: communityColors.ink },
  name: { fontSize: 13, color: communityColors.inkSoft },
})
