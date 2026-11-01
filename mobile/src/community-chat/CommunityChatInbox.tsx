import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { useCommandKey, useCommunityAction } from '@/community/community-ui'
import type { CommunityChatApi } from './community-chat-api'
import type {
  ChatInvitation,
  ChatRequest,
  CommunityConversation,
} from './community-chat-contract'
import {
  ChatButton,
  ChatHeading,
  ChatNotice,
  ChatUnavailable,
  chatStyles as s,
  conversationName,
  peerName,
} from './community-chat-ui'

export type ChatTarget = Readonly<{
  conversationId?: string | undefined
  requestId?: string | undefined
  invitationId?: string | undefined
  peerId?: string | undefined
}>
type Props = Readonly<{
  api: CommunityChatApi
  subject: string
  ownId: string
  target: ChatTarget
  onOpen: (id: string) => void
  onPrivacy: () => void
  onBack: () => void
}>

function ChatList<T>({
  subject,
  name,
  load,
  targetId,
  itemId,
  renderItem,
}: Readonly<{
  subject: string
  name: string
  load: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>
  targetId?: string
  itemId: (item: T) => string
  renderItem: (item: T) => React.ReactNode
}>) {
  const query = useInfiniteQuery({
    queryKey: ['community-chat', subject, name],
    queryFn: ({ pageParam }) => load(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page, pages) =>
      page.nextCursor &&
      !pages.slice(0, -1).some((prior) => prior.nextCursor === page.nextCursor)
        ? page.nextCursor
        : undefined,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  const selected = targetId
    ? items.filter((item) => itemId(item) === targetId)
    : items
  useEffect(() => {
    if (
      targetId &&
      !selected.length &&
      query.hasNextPage &&
      !query.isFetching &&
      !query.isError
    )
      void query.fetchNextPage()
  }, [
    targetId,
    selected.length,
    query.hasNextPage,
    query.isFetching,
    query.isError,
    query,
  ])
  if (query.isFetching)
    return <ChatNotice>Đang kiểm tra hộp trò chuyện…</ChatNotice>
  if (query.isError)
    return <ChatUnavailable onRetry={() => void query.refetch()} />
  return (
    <View style={s.column}>
      <ChatButton
        label="Làm mới danh sách"
        onPress={() => void query.refetch()}
      />
      {!selected.length && (
        <ChatNotice>
          {targetId
            ? 'Yêu cầu hoặc lời mời không còn khả dụng. Nội dung có thể đã thay đổi.'
            : 'Chưa có nội dung trong mục này.'}
        </ChatNotice>
      )}
      {selected.map((item) => (
        <View key={itemId(item)} style={s.card}>
          {renderItem(item)}
        </View>
      ))}
      {!targetId && query.hasNextPage && (
        <ChatButton
          label="Xem thêm"
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </View>
  )
}

function RequestCard({
  api,
  value,
  onOpen,
  onChanged,
}: Readonly<{
  api: CommunityChatApi
  value: ChatRequest
  onOpen: (id: string) => void
  onChanged: () => void
}>) {
  const action = useCommunityAction()
  const [confirmBlock, setConfirmBlock] = useState(false)
  const decide = (decision: 'ACCEPT' | 'DECLINE' | 'BLOCK') =>
    void action.run(async () => {
      const result = await api.decideRequest(
        value.requestId,
        decision,
        `"${value.version}"`,
      )
      if (result) onOpen(result.conversationId)
      else onChanged()
    })
  return (
    <View style={s.column}>
      <Text style={s.heading}>{peerName(value.requester)}</Text>
      <Text
        style={s.muted}
      >{`Hết hạn: ${new Date(value.expiresAt).toLocaleString('vi-VN')}`}</Text>
      <Text style={s.muted}>
        Chỉ mở hội thoại sau khi bạn chấp nhận. Chưa chia sẻ lịch sử hoặc trạng
        thái hoạt động.
      </Text>
      {value.state === 'PENDING' && (
        <>
          <ChatButton
            label="Chấp nhận trò chuyện"
            disabled={action.busy || value.requester.state !== 'AVAILABLE'}
            onPress={() => decide('ACCEPT')}
          />
          <ChatButton
            label="Từ chối yêu cầu"
            disabled={action.busy}
            onPress={() => decide('DECLINE')}
          />
          <ChatButton
            label="Chặn người gửi"
            disabled={action.busy}
            onPress={() => setConfirmBlock(true)}
          />
          {confirmBlock && (
            <View style={s.column}>
              <ChatNotice>Chặn người gửi và kết thúc yêu cầu này?</ChatNotice>
              <ChatButton
                label="Xác nhận chặn"
                disabled={action.busy}
                onPress={() => decide('BLOCK')}
              />
              <ChatButton
                label="Hủy chặn"
                disabled={action.busy}
                onPress={() => setConfirmBlock(false)}
              />
            </View>
          )}
        </>
      )}
      {action.error && (
        <>
          <ChatNotice>{action.error}</ChatNotice>
          <ChatButton label="Tải trạng thái mới" onPress={onChanged} />
        </>
      )}
    </View>
  )
}
function InvitationCard({
  api,
  value,
  onOpen,
  onChanged,
}: Readonly<{
  api: CommunityChatApi
  value: ChatInvitation
  onOpen: (id: string) => void
  onChanged: () => void
}>) {
  const action = useCommunityAction()
  const decide = (decision: 'ACCEPT' | 'DECLINE') =>
    void action.run(async () => {
      const result = await api.decideInvitation(
        value.invitationId,
        value.conversationId,
        decision,
        `"${value.version}"`,
      )
      if (result) onOpen(result.value.conversationId)
      else onChanged()
    })
  return (
    <View style={s.column}>
      <Text style={s.heading}>{value.groupName}</Text>
      <Text
        style={s.muted}
      >{`Hết hạn: ${new Date(value.expiresAt).toLocaleString('vi-VN')}`}</Text>
      <Text
        style={s.muted}
      >{`Lời mời từ ${peerName(value.inviter)}. Khi tham gia, bạn chỉ xem được tin nhắn thuộc lượt tham gia của mình.`}</Text>
      {value.state === 'PENDING' && (
        <>
          <ChatButton
            label="Tham gia nhóm"
            disabled={action.busy || value.inviter.state !== 'AVAILABLE'}
            onPress={() => decide('ACCEPT')}
          />
          <ChatButton
            label="Từ chối lời mời"
            disabled={action.busy}
            onPress={() => decide('DECLINE')}
          />
        </>
      )}
      {action.error && (
        <>
          <ChatNotice>{action.error}</ChatNotice>
          <ChatButton label="Tải trạng thái mới" onPress={onChanged} />
        </>
      )}
    </View>
  )
}
function CreateGroup({
  api,
  onOpen,
}: Readonly<{ api: CommunityChatApi; onOpen: (id: string) => void }>) {
  const [name, setName] = useState('')
  const key = useCommandKey(),
    action = useCommunityAction()
  return (
    <View style={s.column}>
      <Text accessibilityRole="header" style={s.heading}>
        Tạo nhóm riêng tư
      </Text>
      <TextInput
        accessibilityLabel="Tên nhóm"
        value={name}
        onChangeText={setName}
        editable={!action.busy}
        style={s.input}
      />
      <Text style={s.muted}>
        Nhóm chỉ nhận thành viên qua lời mời. Không có danh sách nhóm công khai.
      </Text>
      <ChatButton
        label="Tạo nhóm"
        disabled={action.busy || !name.trim() || [...name.trim()].length > 80}
        onPress={() =>
          void action.run(async () => {
            const group = await api.createGroup(name.trim(), key(name.trim()))
            onOpen(group.value.conversationId)
          })
        }
      />
      {action.error && <ChatNotice>{action.error}</ChatNotice>}
    </View>
  )
}
function StartDirect({
  api,
  profileId,
  ownId,
  onOpen,
}: Readonly<{
  api: CommunityChatApi
  profileId: string
  ownId: string
  onOpen: (id: string) => void
}>) {
  const action = useCommunityAction(),
    key = useCommandKey()
  const [sent, setSent] = useState(false)
  if (profileId === ownId)
    return (
      <ChatNotice>Bạn không thể bắt đầu trò chuyện với chính mình.</ChatNotice>
    )
  return (
    <View style={s.column}>
      <Text style={s.body}>
        Bắt đầu trò chuyện với tác giả bạn vừa chọn trong Cộng đồng. Cài đặt của
        người nhận quyết định mở ngay hoặc gửi yêu cầu.
      </Text>
      {sent ? (
        <ChatNotice>
          Đã gửi yêu cầu. Chờ người nhận chấp nhận để bắt đầu trò chuyện.
        </ChatNotice>
      ) : (
        <ChatButton
          label="Bắt đầu trò chuyện"
          disabled={action.busy}
          onPress={() =>
            void action.run(async () => {
              const result = await api.startDirect(profileId, key(profileId))
              if (result.state === 'ACTIVE') onOpen(result.conversationId)
              else setSent(true)
            })
          }
        />
      )}
      {action.error && <ChatNotice>{action.error}</ChatNotice>}
    </View>
  )
}
export function CommunityChatInbox({
  api,
  subject,
  ownId,
  target,
  onOpen,
  onPrivacy,
  onBack,
}: Props) {
  const [tab, setTab] = useState<'conversations' | 'requests' | 'invitations'>(
    target.requestId
      ? 'requests'
      : target.invitationId
        ? 'invitations'
        : 'conversations',
  )
  const [revision, setRevision] = useState(0),
    [creating, setCreating] = useState(false)
  const refresh = () => setRevision((value) => value + 1)
  return (
    <View style={s.column}>
      <ChatButton label="Về cộng đồng" onPress={onBack} />
      <ChatHeading>Trò chuyện cộng đồng</ChatHeading>
      <Text style={s.muted}>
        Một khoảng riêng để lắng nghe nhau. Đây không phải kênh tư vấn hay hỗ
        trợ khẩn cấp.
      </Text>
      <View style={s.row}>
        {(
          [
            { value: 'conversations', label: 'Hội thoại' },
            { value: 'requests', label: 'Yêu cầu' },
            { value: 'invitations', label: 'Lời mời' },
          ] as const
        ).map((item) => (
          <ChatButton
            key={item.value}
            label={item.label}
            selected={tab === item.value}
            onPress={() => setTab(item.value)}
          />
        ))}
      </View>
      {target.peerId && (
        <StartDirect
          api={api}
          profileId={target.peerId}
          ownId={ownId}
          onOpen={onOpen}
        />
      )}
      {tab === 'conversations' ? (
        <>
          <ChatList<CommunityConversation>
            key={`conversations:${revision}`}
            subject={subject}
            name="conversations"
            load={(cursor) => api.conversations(cursor)}
            itemId={(value) => value.conversationId}
            renderItem={(value) => (
              <View style={s.column}>
                <Text style={s.heading}>{conversationName(value, ownId)}</Text>
                <Text
                  style={s.muted}
                >{`${value.kind === 'GROUP' ? 'Nhóm riêng tư' : 'Trò chuyện riêng'} · ${value.unreadCount} chưa đọc${value.state !== 'ACTIVE' ? ' · Chỉ đọc' : ''}`}</Text>
                <ChatButton
                  label={`Mở ${conversationName(value, ownId)}`}
                  onPress={() => onOpen(value.conversationId)}
                />
              </View>
            )}
          />
          <ChatButton
            label={creating ? 'Đóng tạo nhóm' : 'Tạo nhóm riêng tư'}
            onPress={() => setCreating(!creating)}
          />
          {creating && <CreateGroup api={api} onOpen={onOpen} />}
        </>
      ) : tab === 'requests' ? (
        <ChatList<ChatRequest>
          key={`requests:${revision}`}
          subject={subject}
          name="requests"
          load={(cursor) => api.requests(cursor)}
          {...(target.requestId ? { targetId: target.requestId } : {})}
          itemId={(value) => value.requestId}
          renderItem={(value) => (
            <RequestCard
              api={api}
              value={value}
              onOpen={onOpen}
              onChanged={refresh}
            />
          )}
        />
      ) : (
        <ChatList<ChatInvitation>
          key={`invitations:${revision}`}
          subject={subject}
          name="invitations"
          load={(cursor) => api.invitations(cursor)}
          {...(target.invitationId ? { targetId: target.invitationId } : {})}
          itemId={(value) => value.invitationId}
          renderItem={(value) => (
            <InvitationCard
              api={api}
              value={value}
              onOpen={onOpen}
              onChanged={refresh}
            />
          )}
        />
      )}
      <ChatButton label="Quyền riêng tư trò chuyện" onPress={onPrivacy} />
    </View>
  )
}
