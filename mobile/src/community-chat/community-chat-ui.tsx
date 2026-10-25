import { Text, View } from 'react-native'
import {
  CommunityButton,
  CommunityMessage,
  communityStyles,
} from '@/community/community-ui'
import type { ChatPeer, CommunityConversation } from './community-chat-contract'

export {
  CommunityButton as ChatButton,
  CommunityMessage as ChatNotice,
  communityStyles as chatStyles,
}
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
export function ChatUnavailable({
  onRetry,
}: Readonly<{ onRetry: () => void }>) {
  return (
    <View style={communityStyles.column}>
      <CommunityMessage>
        Chưa thể xác nhận nội dung hoặc quyền truy cập. Hãy tải lại để tiếp tục.
      </CommunityMessage>
      <CommunityButton label="Thử lại" onPress={onRetry} />
    </View>
  )
}
export function ChatHeading({ children }: Readonly<{ children: string }>) {
  return (
    <Text accessibilityRole="header" style={communityStyles.title}>
      {children}
    </Text>
  )
}
