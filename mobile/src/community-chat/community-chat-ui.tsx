import { router } from 'expo-router'
import { useRef, type ReactNode, type Ref } from 'react'
import { StyleSheet, View, type ScrollView } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Screen } from '@/components/Screen'
import {
  Avatar,
  CommunityIcon,
  CommunityTabBar,
  StateCard,
  communityText,
  type AvatarAuthor,
  type CommunityTab,
  type IconName,
} from '@/community/community-ui'
import { Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'
import { communityColors } from '@/community/community-theme'
import type { ChatPeer, CommunityConversation } from './community-chat-contract'

export const peerName = (peer: ChatPeer) =>
  peer.state === 'AVAILABLE' ? peer.displayName : 'Thành viên không khả dụng'
export function conversationName(value: CommunityConversation, ownId: string) {
  return value.kind === 'GROUP'
    ? value.groupName
    : value.peers
        .filter(
          (peer) =>
            peer.state !== 'AVAILABLE' || peer.communityProfileId !== ownId,
        )
        .map(peerName)
        .join(', ') || 'Trò chuyện riêng'
}

// Chat peers carry no avatar field: an available peer shows initials, an unavailable one the deleted style.
export const peerAuthor = (peer: ChatPeer): AvatarAuthor =>
  peer.state === 'AVAILABLE'
    ? { displayName: peer.displayName, avatarPreset: null, state: 'ACTIVE' }
    : { displayName: '', avatarPreset: null, state: 'DELETED' }

export function ChatAvatar({
  conversation,
  ownId,
  size = 52,
}: Readonly<{
  conversation: CommunityConversation
  ownId: string
  size?: number
}>) {
  if (conversation.kind === 'GROUP') return <Avatar group size={size} />
  const peer = conversation.peers.find(
    (item) => item.state !== 'AVAILABLE' || item.communityProfileId !== ownId,
  )
  return <Avatar size={size} author={peer ? peerAuthor(peer) : undefined} />
}

/** Inbox tab bar: the other Community tabs live in `/(user)/community`, chosen by its `panel` param. */
export function goCommunityTab(tab: CommunityTab) {
  if (tab === 'chat') return
  router.replace({
    pathname: '/(user)/community',
    params: { panel: tab === 'compose' ? 'composer' : tab },
  })
}

export const ChatTabBar = ({
  onTab,
}: Readonly<{ onTab: (tab: CommunityTab) => void }>) => (
  <CommunityTabBar active="chat" onSelect={onTab} />
)

export function ChatUnavailable({
  onRetry,
}: Readonly<{ onRetry: () => void }>) {
  return (
    <StateCard
      tone="error"
      icon="alert-circle-outline"
      title="Tin nhắn hiện chưa khả dụng"
      body="Chưa thể xác nhận nội dung hoặc quyền truy cập. Hãy tải lại để tiếp tục."
      actionLabel="Thử lại"
      onAction={onRetry}
    />
  )
}

/** Slim notice with a leading glyph; `attention` switches to the terracotta tint. */
export function ChatBanner({
  icon,
  children,
  attention = false,
}: Readonly<{
  icon: IconName
  children: string
  attention?: boolean
}>) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[banner.row, attention && banner.attention]}
    >
      <CommunityIcon
        name={icon}
        size={18}
        color={attention ? communityColors.terracotta : communityColors.inkSoft}
      />
      <Txt style={[communityText.meta, banner.text]}>{children}</Txt>
    </View>
  )
}

const banner = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: radii.control,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  attention: { backgroundColor: communityColors.background },
  text: { color: communityColors.ink, flex: 1, fontSize: 13, lineHeight: 18 },
})

/** Header or footer bar that paints its own safe-area strip, so a `soft` page keeps white edges. */
function Edge({
  side,
  children,
}: Readonly<{ side: 'top' | 'bottom'; children: ReactNode }>) {
  const inset = useSafeAreaInsets()[side]
  return (
    <View
      style={[
        edge.base,
        side === 'top'
          ? { marginTop: -inset, paddingTop: inset }
          : { marginBottom: -inset, paddingBottom: inset },
      ]}
    >
      {children}
    </View>
  )
}

const edge = StyleSheet.create({
  base: { backgroundColor: communityColors.background },
})

/** One chat screen: its own Screen so the bar sits in `header` and the composer or a sticky action in `footer`. */
export function ChatFrame({
  header,
  footer,
  scrollRef,
  soft = false,
  inset = true,
  children,
}: Readonly<{
  header: ReactNode
  footer?: ReactNode
  scrollRef?: Ref<ScrollView>
  /** Page background `soft` (conversation); the bars stay white. */
  soft?: boolean
  /** false: rows run edge to edge and inset themselves. */
  inset?: boolean
  children: ReactNode
}>) {
  return (
    <Screen
      layout="bleed"
      backgroundColor={soft ? communityColors.soft : communityColors.background}
      header={soft ? <Edge side="top">{header}</Edge> : header}
      footer={footer && soft ? <Edge side="bottom">{footer}</Edge> : footer}
      {...(scrollRef ? { scrollRef } : {})}
    >
      <View style={inset ? frame.inset : undefined}>{children}</View>
    </Screen>
  )
}

const frame = StyleSheet.create({
  inset: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
})

/** Soft input shared by the picker and the group forms. */
export const chatInput = StyleSheet.create({
  field: {
    backgroundColor: communityColors.soft,
    borderRadius: radii.control,
    color: communityColors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  card: {
    backgroundColor: communityColors.soft,
    borderRadius: radii.panel,
    gap: spacing.md,
    padding: spacing.lg,
  },
})

/** Keeps a long screen's last card in view once it has mounted. */
export function useScrollToEnd() {
  const ref = useRef<ScrollView>(null)
  const reduceMotion = useReducedMotion()
  return {
    ref,
    toEnd: (animated = !reduceMotion) =>
      setTimeout(() => ref.current?.scrollToEnd({ animated }), 50),
  }
}
