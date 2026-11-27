import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { PressableScale } from '@/components/PressableScale'
import {
  Avatar,
  BottomSheet,
  CommunityButton,
  CommunityHeader,
  CommunityIcon,
  CommunityMessage,
  Reveal,
  SkeletonGroup,
  SkeletonRow,
  StateCard,
  TopicPill,
  communityStyles,
  communityText,
  useCommandKey,
  useCommunityAction,
} from '@/community/community-ui'
import { Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'
import { communityColors } from '@/community/community-theme'
import type { CommunityChatApi } from './community-chat-api'
import {
  ChatBanner,
  ChatFrame,
  ChatUnavailable,
  chatInput,
  peerAuthor,
  peerName,
} from './community-chat-ui'

type Props = Readonly<{
  api: CommunityChatApi
  subject: string
  ownId: string
  conversationId: string
  onBack: () => void
  onExit: () => void
  onChanged: () => Promise<void>
}>
const roleLabel = {
  OWNER: 'Chủ nhóm',
  ADMIN: 'Quản trị viên',
  MEMBER: 'Thành viên',
}
export function CommunityGroupPanel({
  api,
  subject,
  ownId,
  conversationId,
  onBack,
  onExit,
  onChanged,
}: Props) {
  const [contactCursor, setContactCursor] = useState<string | undefined>()
  const query = useQuery({
    queryKey: [
      'community-chat',
      subject,
      'group',
      conversationId,
      contactCursor,
    ],
    queryFn: async () => {
      const conversation = await api.conversation(conversationId)
      const members = await api.members(conversationId)
      const contacts = await api.conversations(contactCursor)
      return { conversation, members, contacts }
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const action = useCommunityAction(),
    key = useCommandKey()
  const [confirmation, setConfirmation] = useState<{
    label: string
    execute: () => Promise<unknown>
    leave: boolean
  } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const request = (
    label: string,
    execute: () => Promise<unknown>,
    leave = false,
  ) => {
    setConfirmation({ label, execute, leave })
  }
  const apply = () => {
    if (!confirmation) return
    const command = confirmation
    setConfirmation(null)
    void action.run(async () => {
      let departed = false
      try {
        await command.execute()
        if (command.leave) {
          departed = true
          onExit()
          return
        }
        setNotice(
          'Đã lưu thay đổi. Danh sách được kiểm tra lại theo quyền hiện tại.',
        )
      } finally {
        if (!departed) {
          try {
            await query.refetch({ throwOnError: true })
          } finally {
            await onChanged()
          }
        }
      }
    })
  }
  const value =
    !query.isFetching && !query.isError && !action.busy ? query.data : undefined
  const group = value?.conversation.value
  const header = (
    <CommunityHeader
      padded
      title="Thành viên và nhóm"
      backLabel="Về hội thoại"
      onBack={onBack}
    />
  )
  if (group && group.kind !== 'GROUP')
    return (
      <ChatFrame header={header}>
        <StateCard
          icon="account-group-outline"
          title="Hội thoại này không phải nhóm riêng tư."
        />
      </ChatFrame>
    )
  const owner = group?.viewerRole === 'OWNER',
    admin = group?.viewerRole === 'ADMIN'
  const active = group?.state === 'ACTIVE'
  const etag = value?.conversation.etag ?? ''
  const members = value?.members.items ?? []
  const known = new Set(
    members.flatMap((member) =>
      member.peer.state === 'AVAILABLE' ? [member.peer.communityProfileId] : [],
    ),
  )
  const contacts = [
    ...new Map(
      (value?.contacts.items ?? [])
        .filter((item) => item.kind === 'DIRECT' && item.state === 'ACTIVE')
        .flatMap((item) => item.peers)
        .filter(
          (peer) =>
            peer.state === 'AVAILABLE' &&
            peer.communityProfileId !== ownId &&
            !known.has(peer.communityProfileId),
        )
        .map((peer) => [
          peer.state === 'AVAILABLE' ? peer.communityProfileId : '',
          peer,
        ]),
    ).values(),
  ]
  return (
    <ChatFrame header={header}>
      {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
      {notice && <ChatBanner icon="check-circle-outline">{notice}</ChatBanner>}
      {query.isFetching || action.busy ? (
        <SkeletonGroup label="Đang xác nhận quyền và thành viên…">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </SkeletonGroup>
      ) : !value || !group ? (
        <ChatUnavailable onRetry={() => void query.refetch()} />
      ) : (
        <Reveal style={communityStyles.column}>
          <View style={styles.title}>
            <Avatar group size={44} />
            <View style={styles.titleText}>
              <Txt accessibilityRole="header" style={communityText.section}>
                {group.groupName}
              </Txt>
              <Txt
                style={communityText.meta}
              >{`Vai trò của bạn: ${roleLabel[group.viewerRole]}${active ? '' : ' · Đã lưu trữ, chỉ đọc'}`}</Txt>
            </View>
          </View>
          <View style={chatInput.card}>
            {members.map((member, index) => (
              <View
                key={
                  member.peer.state === 'AVAILABLE'
                    ? member.peer.communityProfileId
                    : `unavailable-${index}`
                }
                style={styles.member}
              >
                <View style={styles.memberHead}>
                  <Avatar size={40} author={peerAuthor(member.peer)} />
                  <Txt
                    numberOfLines={1}
                    style={[communityText.author, styles.titleText]}
                  >
                    {peerName(member.peer)}
                  </Txt>
                  <TopicPill label={roleLabel[member.role]} />
                </View>
                {member.peer.state === 'AVAILABLE' &&
                  member.peer.communityProfileId !== ownId &&
                  active && (
                    <View style={communityStyles.row}>
                      {owner && member.role !== 'OWNER' && (
                        <CommunityButton
                          variant="quiet"
                          label={
                            member.role === 'ADMIN'
                              ? 'Bỏ quyền quản trị'
                              : 'Đặt làm quản trị viên'
                          }
                          onPress={() => {
                            const peer = member.peer
                            if (peer.state === 'AVAILABLE')
                              request(
                                `Đổi quyền của ${peer.displayName}?`,
                                () =>
                                  api.setRole(
                                    conversationId,
                                    peer.communityProfileId,
                                    member.role === 'ADMIN'
                                      ? 'MEMBER'
                                      : 'ADMIN',
                                    etag,
                                  ),
                              )
                          }}
                        />
                      )}
                      {owner && member.role === 'ADMIN' && (
                        <CommunityButton
                          variant="quiet"
                          label="Chuyển quyền chủ nhóm"
                          onPress={() => {
                            const peer = member.peer
                            if (peer.state === 'AVAILABLE')
                              request(
                                `Chuyển quyền chủ nhóm cho ${peer.displayName}? Bạn sẽ không còn là chủ nhóm.`,
                                () =>
                                  api.transfer(
                                    conversationId,
                                    peer.communityProfileId,
                                    etag,
                                  ),
                              )
                          }}
                        />
                      )}
                      {(owner || (admin && member.role === 'MEMBER')) &&
                        member.role !== 'OWNER' && (
                          <CommunityButton
                            variant="danger"
                            label={`Mời ${peerName(member.peer)} rời nhóm`}
                            onPress={() => {
                              const peer = member.peer
                              if (peer.state === 'AVAILABLE')
                                request(
                                  `Xóa ${peer.displayName} khỏi nhóm?`,
                                  () =>
                                    api.removeMember(
                                      conversationId,
                                      peer.communityProfileId,
                                      etag,
                                    ),
                                )
                            }}
                          />
                        )}
                    </View>
                  )}
              </View>
            ))}
          </View>
          {value.members.nextCursor && (
            <ChatBanner icon="alert-outline" attention>
              Danh sách chưa đầy đủ. Tải lại trước khi thay đổi thành viên.
            </ChatBanner>
          )}
          {active && (owner || admin) && (
            <View style={chatInput.card}>
              <Txt accessibilityRole="header" style={communityText.section}>
                Mời từ hội thoại riêng của bạn
              </Txt>
              <Txt style={communityText.meta}>
                Chỉ những danh tính đang hiển thị trong hội thoại đã được chấp
                nhận. Người nhận tự quyết định tham gia; giới hạn nhóm do hệ
                thống kiểm tra.
              </Txt>
              {contacts.map(
                (peer) =>
                  peer.state === 'AVAILABLE' && (
                    <PressableScale
                      key={peer.communityProfileId}
                      accessibilityRole="button"
                      accessibilityLabel={`Mời ${peer.displayName}`}
                      scaleTo={0.98}
                      style={styles.invite}
                      onPress={() =>
                        request(
                          `Gửi lời mời nhóm cho ${peer.displayName}?`,
                          () =>
                            api.invite(
                              conversationId,
                              peer.communityProfileId,
                              etag,
                              key({
                                conversationId,
                                peerId: peer.communityProfileId,
                              }),
                            ),
                        )
                      }
                    >
                      <Avatar size={40} author={peerAuthor(peer)} />
                      <Txt style={[communityText.body, styles.titleText]}>
                        {`Mời ${peer.displayName}`}
                      </Txt>
                      <CommunityIcon name="account-plus-outline" />
                    </PressableScale>
                  ),
              )}
              {!contacts.length && (
                <Txt style={communityText.meta}>
                  Chưa có người phù hợp trong danh sách hội thoại riêng đã tải.
                </Txt>
              )}
              {value.contacts.nextCursor && (
                <CommunityButton
                  label="Xem thêm người có thể mời"
                  onPress={() =>
                    setContactCursor(value.contacts.nextCursor ?? undefined)
                  }
                />
              )}
              {contactCursor && (
                <CommunityButton
                  variant="quiet"
                  label="Về đầu danh sách người có thể mời"
                  onPress={() => setContactCursor(undefined)}
                />
              )}
            </View>
          )}
          <View style={[chatInput.card, styles.danger]}>
            {owner && active && (
              <CommunityButton
                variant="danger"
                icon="archive-outline"
                label="Lưu trữ nhóm"
                onPress={() =>
                  request(
                    'Lưu trữ nhóm? Thành viên chỉ còn đọc lịch sử, không gửi thêm tin nhắn.',
                    () => api.archive(conversationId, etag),
                  )
                }
              />
            )}
            {!owner || !active ? (
              <CommunityButton
                variant="danger"
                icon="exit-run"
                label="Rời nhóm"
                onPress={() =>
                  request(
                    'Rời nhóm? Bạn sẽ mất quyền truy cập lịch sử của lượt tham gia này.',
                    () => api.removeMember(conversationId, ownId, etag),
                    true,
                  )
                }
              />
            ) : (
              <Txt style={communityText.meta}>
                Chuyển quyền chủ nhóm hoặc lưu trữ nhóm trước khi rời.
              </Txt>
            )}
          </View>
        </Reveal>
      )}
      <BottomSheet
        visible={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
      >
        <CommunityMessage>{confirmation?.label ?? ''}</CommunityMessage>
        <CommunityButton
          variant="primary"
          label="Xác nhận thay đổi"
          disabled={action.busy}
          onPress={apply}
        />
        <CommunityButton
          variant="quiet"
          label="Hủy thay đổi"
          disabled={action.busy}
          onPress={() => setConfirmation(null)}
        />
      </BottomSheet>
    </ChatFrame>
  )
}

const styles = StyleSheet.create({
  title: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  titleText: { flex: 1 },
  member: { gap: spacing.sm },
  memberHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  invite: {
    alignItems: 'center',
    borderRadius: radii.control,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
  },
  danger: {
    backgroundColor: communityColors.background,
    borderColor: communityColors.terracottaLine,
    borderWidth: 1,
  },
})
