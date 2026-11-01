import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useCommandKey, useCommunityAction } from '@/community/community-ui'
import type { CommunityChatApi } from './community-chat-api'
import {
  ChatButton,
  ChatHeading,
  ChatNotice,
  ChatUnavailable,
  chatStyles as s,
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
  ) => setConfirmation({ label, execute, leave })
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
  if (group && group.kind !== 'GROUP')
    return <ChatNotice>Hội thoại này không phải nhóm riêng tư.</ChatNotice>
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
    <View style={s.column}>
      <ChatButton
        label="Về hội thoại"
        onPress={onBack}
        disabled={action.busy}
      />
      <ChatHeading>Thành viên và nhóm</ChatHeading>
      {action.error && <ChatNotice>{action.error}</ChatNotice>}
      {notice && <ChatNotice>{notice}</ChatNotice>}
      {query.isFetching || action.busy ? (
        <ChatNotice>Đang xác nhận quyền và thành viên…</ChatNotice>
      ) : !value || !group ? (
        <ChatUnavailable onRetry={() => void query.refetch()} />
      ) : (
        <>
          <Text style={s.heading}>{group.groupName}</Text>
          <Text
            style={s.muted}
          >{`Vai trò của bạn: ${owner ? 'Chủ nhóm' : admin ? 'Quản trị viên' : 'Thành viên'}${active ? '' : ' · Đã lưu trữ, chỉ đọc'}`}</Text>
          {members.map((member, index) => (
            <View
              key={
                member.peer.state === 'AVAILABLE'
                  ? member.peer.communityProfileId
                  : `unavailable-${index}`
              }
              style={s.card}
            >
              <Text
                style={s.body}
              >{`${peerName(member.peer)} · ${member.role === 'OWNER' ? 'Chủ nhóm' : member.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}`}</Text>
              {member.peer.state === 'AVAILABLE' &&
                member.peer.communityProfileId !== ownId &&
                active && (
                  <>
                    {owner && member.role !== 'OWNER' && (
                      <ChatButton
                        label={
                          member.role === 'ADMIN'
                            ? 'Bỏ quyền quản trị'
                            : 'Đặt làm quản trị viên'
                        }
                        onPress={() => {
                          const peer = member.peer
                          if (peer.state === 'AVAILABLE')
                            request(`Đổi quyền của ${peer.displayName}?`, () =>
                              api.setRole(
                                conversationId,
                                peer.communityProfileId,
                                member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
                                etag,
                              ),
                            )
                        }}
                      />
                    )}
                    {owner && member.role === 'ADMIN' && (
                      <ChatButton
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
                        <ChatButton
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
                  </>
                )}
            </View>
          ))}
          {value.members.nextCursor && (
            <ChatNotice>
              Danh sách chưa đầy đủ. Tải lại trước khi thay đổi thành viên.
            </ChatNotice>
          )}
          {active && (owner || admin) && (
            <View style={s.column}>
              <Text accessibilityRole="header" style={s.heading}>
                Mời từ hội thoại riêng của bạn
              </Text>
              <Text style={s.muted}>
                Chỉ những danh tính đang hiển thị trong hội thoại đã được chấp
                nhận. Người nhận tự quyết định tham gia; giới hạn nhóm do hệ
                thống kiểm tra.
              </Text>
              {contacts.map(
                (peer) =>
                  peer.state === 'AVAILABLE' && (
                    <ChatButton
                      key={peer.communityProfileId}
                      label={`Mời ${peer.displayName}`}
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
                    />
                  ),
              )}
              {!contacts.length && (
                <ChatNotice>
                  Chưa có người phù hợp trong danh sách hội thoại riêng đã tải.
                </ChatNotice>
              )}
              {value.contacts.nextCursor && (
                <ChatButton
                  label="Xem thêm người có thể mời"
                  onPress={() =>
                    setContactCursor(value.contacts.nextCursor ?? undefined)
                  }
                />
              )}
              {contactCursor && (
                <ChatButton
                  label="Về đầu danh sách người có thể mời"
                  onPress={() => setContactCursor(undefined)}
                />
              )}
            </View>
          )}
          {owner && active && (
            <ChatButton
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
            <ChatButton
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
            <Text style={s.muted}>
              Chuyển quyền chủ nhóm hoặc lưu trữ nhóm trước khi rời.
            </Text>
          )}
          {confirmation && (
            <View style={s.card}>
              <ChatNotice>{confirmation.label}</ChatNotice>
              <ChatButton
                label="Xác nhận thay đổi"
                disabled={action.busy}
                onPress={apply}
              />
              <ChatButton
                label="Hủy thay đổi"
                disabled={action.busy}
                onPress={() => setConfirmation(null)}
              />
            </View>
          )}
        </>
      )}
    </View>
  )
}
