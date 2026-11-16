import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'

import { PressableScale } from '@/components/PressableScale'
import {
  Avatar,
  Chip,
  CommunityButton,
  CommunityHeader,
  CommunityIcon,
  CommunityMessage,
  IconButton,
  Reveal,
  SkeletonGroup,
  SkeletonRow,
  StateCard,
  communityText,
  useCommandKey,
  useCommunityAction,
  type CommunityTab,
} from '@/community/community-ui'
import { Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'
import { communityColors } from '@/community/community-theme'
import type { CommunityChatApi } from './community-chat-api'
import type {
  ChatInvitation,
  ChatRequest,
  CommunityConversation,
} from './community-chat-contract'
import {
  ChatAvatar,
  ChatFrame,
  ChatTabBar,
  ChatUnavailable,
  chatInput,
  conversationName,
  peerAuthor,
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
  onTab: (tab: CommunityTab) => void
}>

const expiry = (value: string) =>
  `Hết hạn: ${new Date(value).toLocaleString('vi-VN')}`
const roleLabel = {
  OWNER: 'Chủ nhóm',
  ADMIN: 'Quản trị viên',
  MEMBER: 'Thành viên',
}
const emptyHint = 'Bạn có thể nhắn từ một bài viết dùng danh tính cộng đồng.'
// The search field only earns its room once the loaded list is long enough to scan.
const SEARCH_FROM = 6

function useChatPages<T>({
  subject,
  name,
  load,
  targetId,
  itemId,
}: Readonly<{
  subject: string
  name: string
  load: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>
  targetId?: string | undefined
  itemId: (item: T) => string
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
  return { query, items, selected }
}

function ConversationRow({
  value,
  ownId,
  onOpen,
}: Readonly<{
  value: CommunityConversation
  ownId: string
  onOpen: (id: string) => void
}>) {
  const name = conversationName(value, ownId)
  const unread = value.unreadCount > 0
  // The list payload carries no last message or time, so the line stays the relationship, never a fetched preview.
  const detail =
    value.kind === 'GROUP'
      ? `Nhóm riêng tư · ${roleLabel[value.viewerRole]}`
      : null
  const subline = [
    detail ?? 'Mở cuộc trò chuyện',
    value.state !== 'ACTIVE' ? 'Chỉ đọc' : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[
        `Mở ${name}`,
        detail,
        value.state !== 'ACTIVE' ? 'Chỉ đọc' : null,
        unread ? `${value.unreadCount} tin chưa đọc` : null,
      ]
        .filter(Boolean)
        .join('. ')}
      scaleTo={0.98}
      onPress={() => onOpen(value.conversationId)}
      style={styles.row}
    >
      <ChatAvatar conversation={value} ownId={ownId} />
      <View style={styles.rowText}>
        <Txt
          numberOfLines={1}
          style={[styles.name, unread && styles.nameUnread]}
        >
          {name}
        </Txt>
        <Txt
          numberOfLines={1}
          style={[styles.subline, unread && styles.sublineUnread]}
        >
          {subline}
        </Txt>
      </View>
      {unread && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.badge}
        >
          <Txt style={styles.badgeText}>{value.unreadCount}</Txt>
        </View>
      )}
    </PressableScale>
  )
}

function CardError({
  message,
  onChanged,
}: Readonly<{ message: string; onChanged: () => void }>) {
  return (
    <>
      <CommunityMessage>{message}</CommunityMessage>
      <CommunityButton
        variant="quiet"
        label="Tải trạng thái mới"
        onPress={onChanged}
      />
    </>
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
    <View style={chatInput.card}>
      <View style={styles.identity}>
        <Avatar size={44} author={peerAuthor(value.requester)} />
        <View style={styles.rowText}>
          <Txt style={communityText.author}>{peerName(value.requester)}</Txt>
          <Txt style={communityText.meta}>{expiry(value.expiresAt)}</Txt>
        </View>
      </View>
      <Txt style={communityText.meta}>
        Lời mời không chứa nội dung tin nhắn. Chỉ chấp thuận nếu bạn thấy thoải
        mái.
      </Txt>
      {value.state === 'PENDING' && (
        <>
          <CommunityButton
            variant="primary"
            label="Chấp nhận trò chuyện"
            disabled={action.busy || value.requester.state !== 'AVAILABLE'}
            onPress={() => decide('ACCEPT')}
          />
          <View style={styles.actions}>
            <CommunityButton
              variant="quiet"
              label="Từ chối yêu cầu"
              disabled={action.busy}
              onPress={() => decide('DECLINE')}
            />
            <CommunityButton
              variant="danger"
              label="Chặn người gửi"
              disabled={action.busy}
              onPress={() => setConfirmBlock(true)}
            />
          </View>
          {confirmBlock && (
            <View style={styles.confirm}>
              <CommunityMessage>
                Chặn người gửi và kết thúc yêu cầu này?
              </CommunityMessage>
              <CommunityButton
                variant="danger"
                label="Xác nhận chặn"
                disabled={action.busy}
                onPress={() => decide('BLOCK')}
              />
              <CommunityButton
                variant="quiet"
                label="Hủy chặn"
                disabled={action.busy}
                onPress={() => setConfirmBlock(false)}
              />
            </View>
          )}
        </>
      )}
      {action.error && (
        <CardError message={action.error} onChanged={onChanged} />
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
    <View style={chatInput.card}>
      <View style={styles.identity}>
        <Avatar group size={44} />
        <View style={styles.rowText}>
          <Txt style={communityText.author}>{value.groupName}</Txt>
          <Txt style={communityText.meta}>{expiry(value.expiresAt)}</Txt>
        </View>
      </View>
      <Txt
        style={communityText.meta}
      >{`Lời mời từ ${peerName(value.inviter)}. Khi tham gia, bạn chỉ xem được tin nhắn thuộc lượt tham gia của mình.`}</Txt>
      {value.state === 'PENDING' && (
        <>
          <CommunityButton
            variant="primary"
            label="Tham gia nhóm"
            disabled={action.busy || value.inviter.state !== 'AVAILABLE'}
            onPress={() => decide('ACCEPT')}
          />
          <CommunityButton
            variant="quiet"
            label="Từ chối lời mời"
            disabled={action.busy}
            onPress={() => decide('DECLINE')}
          />
        </>
      )}
      {action.error && (
        <CardError message={action.error} onChanged={onChanged} />
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
    <View style={chatInput.card}>
      <Txt accessibilityRole="header" style={communityText.section}>
        Tạo nhóm riêng tư
      </Txt>
      <TextInput
        accessibilityLabel="Tên nhóm"
        value={name}
        onChangeText={setName}
        editable={!action.busy}
        style={chatInput.field}
      />
      <Txt style={communityText.meta}>
        Nhóm chỉ nhận thành viên qua lời mời. Không có danh sách nhóm công khai.
      </Txt>
      <CommunityButton
        variant="primary"
        label="Tạo nhóm"
        disabled={action.busy || !name.trim() || [...name.trim()].length > 80}
        onPress={() =>
          void action.run(async () => {
            const group = await api.createGroup(name.trim(), key(name.trim()))
            onOpen(group.value.conversationId)
          })
        }
      />
      {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
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
      <CommunityMessage>
        Bạn không thể bắt đầu trò chuyện với chính mình.
      </CommunityMessage>
    )
  return (
    <View style={chatInput.card}>
      <Txt style={communityText.body}>
        Bắt đầu trò chuyện với tác giả bạn vừa chọn trong Cộng đồng. Cài đặt của
        người nhận quyết định mở ngay hoặc gửi yêu cầu.
      </Txt>
      {sent ? (
        <CommunityMessage>
          Đã gửi yêu cầu. Chờ người nhận chấp nhận để bắt đầu trò chuyện.
        </CommunityMessage>
      ) : (
        <CommunityButton
          variant="primary"
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
      {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
    </View>
  )
}

type InboxView = 'inbox' | 'pending' | 'new'
type Filter = 'all' | 'direct' | 'group'
const filters: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'direct', label: 'Cá nhân' },
  { value: 'group', label: 'Nhóm' },
]

export function CommunityChatInbox({
  api,
  subject,
  ownId,
  target,
  onOpen,
  onPrivacy,
  onBack,
  onTab,
}: Props) {
  const [view, setView] = useState<InboxView>(
    target.peerId
      ? 'new'
      : target.requestId || target.invitationId
        ? 'pending'
        : 'inbox',
  )
  const [filter, setFilter] = useState<Filter>('all'),
    [search, setSearch] = useState('')
  const conversations = useChatPages<CommunityConversation>({
    subject,
    name: 'conversations',
    load: (cursor) => api.conversations(cursor),
    itemId: (value) => value.conversationId,
  })
  const requests = useChatPages<ChatRequest>({
    subject,
    name: 'requests',
    load: (cursor) => api.requests(cursor),
    targetId: target.requestId,
    itemId: (value) => value.requestId,
  })
  const invitations = useChatPages<ChatInvitation>({
    subject,
    name: 'invitations',
    load: (cursor) => api.invitations(cursor),
    targetId: target.invitationId,
    itemId: (value) => value.invitationId,
  })
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (view === 'inbox') onBack()
        else setView('inbox')
        return true
      },
    )
    return () => subscription.remove()
  }, [view, onBack])
  const refreshPending = () => {
    void requests.query.refetch()
    void invitations.query.refetch()
  }
  const pendingCount =
    requests.items.filter((item) => item.state === 'PENDING').length +
    invitations.items.filter((item) => item.state === 'PENDING').length
  const tabBar = <ChatTabBar onTab={onTab} />

  if (view === 'new')
    return (
      <ChatFrame
        header={
          <CommunityHeader
            padded
            title="Cuộc trò chuyện mới"
            backLabel="Về tin nhắn"
            onBack={() => setView('inbox')}
          />
        }
      >
        <Reveal step={1} style={styles.column}>
          {target.peerId ? (
            <StartDirect
              api={api}
              profileId={target.peerId}
              ownId={ownId}
              onOpen={onOpen}
            />
          ) : (
            <Txt style={communityText.meta}>{emptyHint}</Txt>
          )}
          <CreateGroup api={api} onOpen={onOpen} />
        </Reveal>
      </ChatFrame>
    )

  if (view === 'pending') {
    const loading = requests.query.isFetching || invitations.query.isFetching
    const failed = requests.query.isError || invitations.query.isError
    const shown = (target.invitationId ? [] : requests.selected).filter(
      (item) => target.requestId || item.state === 'PENDING',
    )
    const shownInvitations = (
      target.requestId ? [] : invitations.selected
    ).filter((item) => target.invitationId || item.state === 'PENDING')
    const more =
      !target.requestId &&
      !target.invitationId &&
      (requests.query.hasNextPage || invitations.query.hasNextPage)
    return (
      <ChatFrame
        header={
          <CommunityHeader
            padded
            title="Lời mời đang chờ"
            backLabel="Về tin nhắn"
            onBack={() => setView('inbox')}
          />
        }
        footer={tabBar}
      >
        {loading ? (
          <SkeletonGroup label="Đang kiểm tra hộp trò chuyện…">
            {[0, 1].map((row) => (
              <View key={row} style={chatInput.card}>
                <SkeletonRow size={44} />
              </View>
            ))}
          </SkeletonGroup>
        ) : failed ? (
          <ChatUnavailable onRetry={refreshPending} />
        ) : (
          <Reveal style={styles.column}>
            {!shown.length && !shownInvitations.length ? (
              <StateCard
                icon="email-outline"
                title={
                  target.requestId || target.invitationId
                    ? 'Yêu cầu hoặc lời mời không còn khả dụng. Nội dung có thể đã thay đổi.'
                    : 'Không có lời mời đang chờ'
                }
              />
            ) : (
              <>
                {shown.map((item) => (
                  <RequestCard
                    key={item.requestId}
                    api={api}
                    value={item}
                    onOpen={onOpen}
                    onChanged={refreshPending}
                  />
                ))}
                {shownInvitations.map((item) => (
                  <InvitationCard
                    key={item.invitationId}
                    api={api}
                    value={item}
                    onOpen={onOpen}
                    onChanged={refreshPending}
                  />
                ))}
              </>
            )}
            {more && (
              <CommunityButton
                label="Xem thêm"
                onPress={() => {
                  if (requests.query.hasNextPage)
                    void requests.query.fetchNextPage()
                  if (invitations.query.hasNextPage)
                    void invitations.query.fetchNextPage()
                }}
              />
            )}
          </Reveal>
        )}
      </ChatFrame>
    )
  }

  const query = conversations.query
  const needle = search.trim().toLocaleLowerCase('vi-VN')
  const rows = conversations.items.filter(
    (item) =>
      (filter === 'all' ||
        (filter === 'group'
          ? item.kind === 'GROUP'
          : item.kind === 'DIRECT')) &&
      (!needle ||
        conversationName(item, ownId)
          .toLocaleLowerCase('vi-VN')
          .includes(needle)),
  )
  const strip =
    pendingCount > 0 ? (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${pendingCount} lời mời đang chờ bạn xem`}
        scaleTo={0.98}
        onPress={() => setView('pending')}
        style={styles.strip}
      >
        <CommunityIcon
          name="email-outline"
          color={communityColors.primaryDeep}
        />
        <Txt style={styles.stripText}>
          {`${pendingCount} lời mời đang chờ bạn xem`}
        </Txt>
        <CommunityIcon
          name="chevron-right"
          color={communityColors.primaryDeep}
        />
      </PressableScale>
    ) : null
  return (
    <ChatFrame
      inset={false}
      header={
        <CommunityHeader
          padded
          size="large"
          title="Tin nhắn"
          right={
            <>
              <IconButton
                icon="shield-lock-outline"
                label="Quyền riêng tư trò chuyện"
                onPress={onPrivacy}
              />
              <IconButton
                icon="square-edit-outline"
                label="Cuộc trò chuyện mới"
                onPress={() => setView('new')}
              />
            </>
          }
        />
      }
      footer={tabBar}
    >
      {query.isFetching ? (
        <View style={styles.pad}>
          <SkeletonGroup label="Đang kiểm tra hộp trò chuyện…">
            {[0, 1, 2, 3].map((row) => (
              <SkeletonRow key={row} size={52} />
            ))}
          </SkeletonGroup>
        </View>
      ) : query.isError ? (
        <>
          {strip}
          <ChatUnavailable onRetry={() => void query.refetch()} />
        </>
      ) : !conversations.items.length ? (
        <>
          {strip}
          <StateCard
            icon="message-outline"
            title="Chưa có cuộc trò chuyện"
            body={emptyHint}
            actionLabel="Khám phá bảng tin"
            onAction={() => onTab('feed')}
          />
        </>
      ) : (
        <Reveal>
          {conversations.items.length >= SEARCH_FROM && (
            <View style={styles.search}>
              <CommunityIcon name="magnify" color={communityColors.inkSoft} />
              <TextInput
                accessibilityLabel="Tìm người hoặc nhóm"
                placeholder="Tìm người hoặc nhóm"
                placeholderTextColor={communityColors.inkSoft}
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
              />
            </View>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {filters.map((item) => (
              <Chip
                key={item.value}
                label={item.label}
                selected={filter === item.value}
                onPress={() => setFilter(item.value)}
              />
            ))}
          </ScrollView>
          {strip}
          {rows.length ? (
            rows.map((item) => (
              <ConversationRow
                key={item.conversationId}
                value={item}
                ownId={ownId}
                onOpen={onOpen}
              />
            ))
          ) : (
            <Txt style={[communityText.meta, styles.pad]}>
              Không có cuộc trò chuyện phù hợp trong danh sách đã tải.
            </Txt>
          )}
          <View style={styles.pad}>
            {query.hasNextPage && (
              <CommunityButton
                label="Xem thêm"
                onPress={() => void query.fetchNextPage()}
              />
            )}
            <CommunityButton
              variant="quiet"
              icon="refresh"
              label="Làm mới danh sách"
              onPress={() => {
                void query.refetch()
                refreshPending()
              }}
            />
          </View>
        </Reveal>
      )}
    </ChatFrame>
  )
}

const styles = StyleSheet.create({
  column: { gap: spacing.lg },
  pad: { gap: spacing.md, padding: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  confirm: { gap: spacing.sm },
  strip: {
    alignItems: 'center',
    backgroundColor: communityColors.mint,
    borderRadius: 16,
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
  },
  stripText: {
    color: communityColors.primaryDeep,
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  search: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: 20,
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: communityColors.ink,
    flex: 1,
    fontSize: 14.5,
    minHeight: 44,
    padding: 0,
  },
  chips: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  identity: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  rowText: { flex: 1 },
  name: {
    color: communityColors.ink,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  nameUnread: { fontWeight: '800' },
  subline: {
    color: communityColors.inkSoft,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 2,
  },
  sublineUnread: { color: communityColors.ink, fontWeight: '600' },
  badge: {
    alignItems: 'center',
    backgroundColor: communityColors.primary,
    borderRadius: radii.pill,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: communityColors.white,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
})
