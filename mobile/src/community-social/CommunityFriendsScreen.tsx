import {
  useInfiniteQuery,
  useQueryClient,
  type UseInfiniteQueryResult,
  type InfiniteData,
} from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'
import {
  Chip,
  CommunityButton,
  CommunityMessage,
  communityText,
  IconButton,
  StateCard,
  useCommunityAction,
  type AvatarAuthor,
} from '@/community/community-ui'

import type { CommunitySocialApi } from './community-social-api'
import type {
  Friendship,
  FriendshipPage,
  FriendshipState,
  FriendView,
  MemberIdentity,
  MemberPage,
} from './community-social-contract'
import {
  ActionSheet,
  LoadFailure,
  LoadMore,
  PersonRow,
  Reveal,
  SearchField,
  SocialFrame,
  SocialSkeleton,
  socialKey,
  useDebounced,
} from './community-social-ui'

const views: readonly { key: FriendView; label: string }[] = [
  { key: 'accepted', label: 'Bạn bè' },
  { key: 'incoming', label: 'Lời mời' },
  { key: 'outgoing', label: 'Đã gửi' },
]
const empty: Record<FriendView, { title: string; body: string }> = {
  accepted: {
    title: 'Một kết nối mới có thể bắt đầu từ một câu chuyện',
    body: 'Tìm theo tên cộng đồng hoặc mở trang cá nhân từ một bài viết để kết nối.',
  },
  incoming: {
    title: 'Chưa có lời mời kết bạn mới',
    body: 'Tìm theo tên cộng đồng hoặc mở trang cá nhân từ một bài viết để kết nối.',
  },
  outgoing: {
    title: 'Bạn chưa gửi lời mời nào',
    body: 'Tìm theo tên cộng đồng hoặc mở trang cá nhân từ một bài viết để kết nối.',
  },
}
const person = (member: MemberIdentity): AvatarAuthor => member

type Props = Readonly<{
  api: CommunitySocialApi
  subject: string
  onBack: () => void
  onOpenMember: (profileId: string) => void
  onMessage: (profileId: string) => void
}>

function useFriends(
  api: CommunitySocialApi,
  subject: string,
  view: FriendView,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: socialKey(subject, 'friends', view),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.friends(view, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
}
const itemsOf = (query: UseInfiniteQueryResult<InfiniteData<FriendshipPage>>) =>
  query.data?.pages.flatMap((page) => page.items) ?? []

export function CommunityFriendsScreen({
  api,
  subject,
  onBack,
  onOpenMember,
  onMessage,
}: Props) {
  const client = useQueryClient()
  const [view, setView] = useState<FriendView>('accepted')
  const [text, setText] = useState('')
  const [sheet, setSheet] = useState<{ friend: Friendship; open: boolean }>()
  const [changed, setChanged] = useState<Record<string, FriendshipState>>({})
  const action = useCommunityAction()
  const term = useDebounced(text.trim(), 350)
  const typed = [...text.trim()].length
  const searching = typed >= 2 && [...term].length >= 2
  const accepted = useFriends(
    api,
    subject,
    'accepted',
    view === 'accepted' || searching,
  )
  const incoming = useFriends(
    api,
    subject,
    'incoming',
    view === 'incoming' || searching,
  )
  const outgoing = useFriends(
    api,
    subject,
    'outgoing',
    view === 'outgoing' || searching,
  )
  const active = { accepted, incoming, outgoing }[view]
  const search = useInfiniteQuery({
    queryKey: socialKey(subject, 'member-search', term),
    enabled: searching,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.searchMembers(term, pageParam),
    getNextPageParam: (page: MemberPage) => page.nextCursor ?? undefined,
  })
  // What the loaded lists already say about a person; a command's own answer wins.
  const known = new Map<string, FriendshipState>()
  for (const friend of [
    ...itemsOf(accepted),
    ...itemsOf(incoming),
    ...itemsOf(outgoing),
  ])
    known.set(friend.peer.communityProfileId, {
      state: friend.state,
      friendshipId: friend.friendshipId,
    })
  const relation = (id: string): FriendshipState =>
    changed[id] ?? known.get(id) ?? { state: 'NONE', friendshipId: null }
  const refresh = () =>
    client.invalidateQueries({ queryKey: socialKey(subject) })
  const command = async (work: () => Promise<void>) => {
    try {
      await work()
    } finally {
      await refresh()
    }
  }
  const request = (id: string) =>
    action.run(() =>
      command(async () => {
        const result = await api.requestFriend(id)
        setChanged((old) => ({
          ...old,
          [id]: { state: result.state, friendshipId: result.friendshipId },
        }))
      }),
    )
  const accept = (friendshipId: string) =>
    action.run(() =>
      command(() => api.acceptFriend(friendshipId).then(() => {})),
    )
  const remove = (friendshipId: string) =>
    command(() => api.removeFriend(friendshipId))

  const row = (friend: Friendship, index: number) => {
    const { peer } = friend
    const name = peer.displayName
    const id = peer.communityProfileId
    return (
      <PersonRow
        key={friend.friendshipId}
        step={Math.min(index, 5)}
        author={person(peer)}
        name={name}
        meta={
          friend.state === 'INCOMING'
            ? 'Muốn kết nối với bạn'
            : friend.state === 'OUTGOING'
              ? 'Đang chờ chấp nhận'
              : undefined
        }
        onOpen={() => onOpenMember(id)}
        trailing={
          friend.state === 'FRIENDS' ? (
            <View style={styles.trailing}>
              <CommunityButton
                label="Nhắn tin"
                accessibilityLabel={`Nhắn tin với ${name}`}
                icon="message-text-outline"
                onPress={() => onMessage(id)}
              />
              <IconButton
                icon="dots-horizontal"
                label={`Tùy chọn cho ${name}`}
                onPress={() => setSheet({ friend, open: true })}
              />
            </View>
          ) : undefined
        }
        actions={
          friend.state === 'INCOMING' ? (
            <>
              <CommunityButton
                variant="primary"
                label="Chấp nhận"
                accessibilityLabel={`Chấp nhận kết bạn với ${name}`}
                disabled={action.busy}
                onPress={() => void accept(friend.friendshipId)}
              />
              <CommunityButton
                variant="quiet"
                label="Từ chối"
                accessibilityLabel={`Từ chối lời mời của ${name}`}
                disabled={action.busy}
                onPress={() =>
                  void action.run(() => remove(friend.friendshipId))
                }
              />
            </>
          ) : friend.state === 'OUTGOING' ? (
            <CommunityButton
              label="Hủy lời mời"
              accessibilityLabel={`Hủy lời mời kết bạn với ${name}`}
              disabled={action.busy}
              onPress={() => void action.run(() => remove(friend.friendshipId))}
            />
          ) : undefined
        }
      />
    )
  }

  const found = (member: MemberIdentity, index: number) => {
    const id = member.communityProfileId
    const rel = relation(id)
    const name = member.displayName
    return (
      <PersonRow
        key={id}
        step={Math.min(index, 5)}
        author={person(member)}
        name={name}
        onOpen={() => onOpenMember(id)}
        trailing={
          rel.state === 'FRIENDS' ? (
            <CommunityButton
              label="Nhắn tin"
              accessibilityLabel={`Nhắn tin với ${name}`}
              onPress={() => onMessage(id)}
            />
          ) : rel.state === 'INCOMING' && rel.friendshipId ? (
            <CommunityButton
              variant="primary"
              label="Chấp nhận"
              accessibilityLabel={`Chấp nhận kết bạn với ${name}`}
              disabled={action.busy}
              onPress={() => void accept(rel.friendshipId!)}
            />
          ) : rel.state === 'OUTGOING' ? (
            <Txt style={communityText.meta}>Đã gửi lời mời</Txt>
          ) : rel.state === 'NONE' ? (
            <CommunityButton
              label="Kết bạn"
              accessibilityLabel={`Kết bạn với ${name}`}
              icon="account-plus-outline"
              disabled={action.busy}
              onPress={() => void request(id)}
            />
          ) : undefined
        }
      />
    )
  }

  const results = search.data?.pages.flatMap((page) => page.items) ?? []
  const list = itemsOf(active)
  return (
    <SocialFrame title="Bạn bè" backLabel="Quay lại cộng đồng" onBack={onBack}>
      <Reveal step={0}>
        <SearchField
          value={text}
          label="Tìm bạn theo tên cộng đồng"
          placeholder="Tìm bạn theo tên cộng đồng"
          onChange={setText}
        />
        {typed === 1 && (
          <Txt style={[communityText.meta, styles.hint]}>
            Nhập từ 2 đến 80 ký tự để tìm theo tên cộng đồng.
          </Txt>
        )}
      </Reveal>
      {action.error ? (
        <CommunityMessage>{action.error}</CommunityMessage>
      ) : null}
      {searching ? (
        search.isPending ? (
          <SocialSkeleton label="Đang tìm thành viên…" />
        ) : search.isError ? (
          <LoadFailure
            error={search.error}
            unavailableTitle="Bạn bè hiện chưa khả dụng."
            failureTitle="Chưa tìm được thành viên."
            onRetry={() => void search.refetch()}
            onBack={onBack}
          />
        ) : results.length === 0 ? (
          <StateCard
            icon="account-search-outline"
            title="Chưa tìm thấy tên cộng đồng phù hợp."
          />
        ) : (
          <>
            {results.map(found)}
            {search.hasNextPage && (
              <LoadMore
                label="Xem thêm kết quả"
                loading={search.isFetchingNextPage}
                onPress={() => void search.fetchNextPage()}
              />
            )}
          </>
        )
      ) : (
        <>
          <Reveal step={1} style={styles.chips}>
            {views.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                selected={view === item.key}
                onPress={() => setView(item.key)}
              />
            ))}
          </Reveal>
          {active.isPending ? (
            <SocialSkeleton label="Đang tải kết nối của bạn…" />
          ) : active.isError ? (
            <LoadFailure
              error={active.error}
              unavailableTitle="Bạn bè hiện chưa khả dụng."
              failureTitle="Chưa tải được kết nối."
              onRetry={() => void active.refetch()}
              onBack={onBack}
            />
          ) : list.length === 0 ? (
            <StateCard
              icon="account-group-outline"
              title={empty[view].title}
              body={empty[view].body}
            />
          ) : (
            <>
              {list.map(row)}
              {active.hasNextPage && (
                <LoadMore
                  label="Xem thêm kết nối"
                  loading={active.isFetchingNextPage}
                  onPress={() => void active.fetchNextPage()}
                />
              )}
            </>
          )}
        </>
      )}
      <ActionSheet
        visible={sheet?.open ?? false}
        onClose={() => setSheet((old) => old && { ...old, open: false })}
        title={sheet?.friend.peer.displayName ?? ''}
        actions={
          sheet
            ? [
                {
                  key: 'remove',
                  label: 'Hủy kết bạn',
                  icon: 'account-remove-outline',
                  danger: true,
                  run: () => remove(sheet.friend.friendshipId),
                  confirm: {
                    title: `Hủy kết bạn với ${sheet.friend.peer.displayName}?`,
                    message:
                      'Các cuộc trò chuyện hiện có vẫn tiếp tục dùng được. Lời mời vào nhóm mới sẽ cần kết bạn lại.',
                    label: 'Hủy kết bạn',
                  },
                },
              ]
            : []
        }
      />
    </SocialFrame>
  )
}

const styles = StyleSheet.create({
  hint: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  trailing: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
})
