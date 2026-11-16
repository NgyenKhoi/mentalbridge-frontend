import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'
import type { CommunityApi } from '@/community/community-api'
import type { CommunityPage } from '@/community/community-contract'
import { usePostCommands } from '@/community/community-reaction-hooks'
import { CommunityFeedPost } from '@/community/CommunityFeedPost'
import { CommunityPostMenu } from '@/community/CommunityPostMenu'
import {
  Avatar,
  Band,
  CommunityButton,
  IconButton,
  Reveal,
  StateCard,
  useCommunityAction,
} from '@/community/community-ui'
import { communityColors } from '@/community/community-theme'

import type { CommunitySocialApi } from './community-social-api'
import type {
  FriendshipState,
  MemberIdentity,
} from './community-social-contract'
import {
  ActionSheet,
  LoadFailure,
  LoadMore,
  SocialFrame,
  SocialSkeleton,
  socialKey,
  type SheetAction,
} from './community-social-ui'

type MemberFeed = CommunityPage & {
  member: MemberIdentity
  friendship: FriendshipState
}

type Props = Readonly<{
  social: CommunitySocialApi
  community: CommunityApi
  subject: string
  profileId: string
  onBack: () => void
  onMessage: (profileId: string) => void
  onOpenPost: (postId: string) => void
  onBlocked: () => void
}>

/** Member page: display identity, one friendship action, and the member's visible named posts. */
export function CommunityMemberScreen({
  social,
  community,
  subject,
  profileId,
  onBack,
  onMessage,
  onOpenPost,
  onBlocked,
}: Props) {
  const client = useQueryClient()
  const [changed, setChanged] = useState<{
    state: FriendshipState | null
    at: number | undefined
  } | null>(null)
  const [sheet, setSheet] = useState(false)
  const [menu, setMenu] = useState<{ postId: string; open: boolean } | null>(
    null,
  )
  const action = useCommunityAction()
  // The key matches the feed's prefix so reaction and bookmark commands patch these posts too.
  const memberKey = ['community', subject, 'feed', 'member', profileId]
  const query = useInfiniteQuery({
    queryKey: memberKey,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<MemberFeed> => {
      const { member, friendship, posts } = await social.member(
        profileId,
        pageParam,
      )
      return { ...posts, member, friendship }
    },
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
    staleTime: 0,
    retry: false,
  })
  const topics = useQuery({
    queryKey: ['community', subject, 'topics'],
    queryFn: () => community.topics(),
  })
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['community', subject] })
    await client.invalidateQueries({ queryKey: socialKey(subject) })
  }
  const commands = usePostCommands(community, subject, refresh)
  const first = query.data?.pages[0]
  const member = first?.member
  // The command result only bridges until the next successful member response replaces it.
  const relation =
    (changed?.at === query.dataUpdatedAt ? changed?.state : null) ??
    first?.friendship
  const posts = query.data?.pages.flatMap((page) => page.items) ?? []
  const topicLabels = new Map(
    (topics.data ?? []).map((topic) => [topic.code, topic.label]),
  )
  const command = async (work: () => Promise<FriendshipState | null>) => {
    try {
      const state = await work()
      setChanged({ state, at: client.getQueryState(memberKey)?.dataUpdatedAt })
    } finally {
      await client.invalidateQueries({ queryKey: memberKey })
      await client.invalidateQueries({ queryKey: socialKey(subject) })
    }
  }
  const none = { state: 'NONE', friendshipId: null } as const
  const request = () =>
    action.run(() =>
      command(async () => {
        const result = await social.requestFriend(profileId)
        return { state: result.state, friendshipId: result.friendshipId }
      }),
    )
  const accept = (friendshipId: string) =>
    action.run(() =>
      command(async () => {
        const result = await social.acceptFriend(friendshipId)
        return { state: result.state, friendshipId: result.friendshipId }
      }),
    )
  const unlink = (friendshipId: string) => () =>
    command(async () => {
      await social.removeFriend(friendshipId)
      return none
    })

  if (query.isPending)
    return (
      <SocialFrame title="Trang cá nhân" backLabel="Quay lại" onBack={onBack}>
        <SocialSkeleton label="Đang tải trang cá nhân…" size={84} rows={1} />
      </SocialFrame>
    )
  if (query.isError || !member || !relation)
    return (
      <SocialFrame title="Trang cá nhân" backLabel="Quay lại" onBack={onBack}>
        <LoadFailure
          error={query.error}
          unavailableTitle="Trang này hiện không khả dụng."
          failureTitle="Chưa tải được trang cá nhân."
          onRetry={() => void query.refetch()}
          onBack={onBack}
        />
      </SocialFrame>
    )

  const name = member.displayName
  const self = relation.state === 'SELF'
  const actions: SheetAction[] = [
    ...(relation.state === 'FRIENDS' && relation.friendshipId
      ? [
          {
            key: 'unfriend',
            label: 'Hủy kết bạn',
            icon: 'account-remove-outline' as const,
            danger: true,
            run: unlink(relation.friendshipId),
            confirm: {
              title: `Hủy kết bạn với ${name}?`,
              message:
                'Các cuộc trò chuyện hiện có vẫn tiếp tục dùng được. Lời mời vào nhóm mới sẽ cần kết bạn lại.',
              label: 'Hủy kết bạn',
            },
          },
        ]
      : []),
    ...(relation.state === 'OUTGOING' && relation.friendshipId
      ? [
          {
            key: 'cancel',
            label: 'Hủy lời mời kết bạn',
            icon: 'account-remove-outline' as const,
            run: unlink(relation.friendshipId),
          },
        ]
      : []),
    ...(self
      ? []
      : [
          {
            key: 'block',
            label: 'Chặn thành viên',
            icon: 'account-cancel-outline' as const,
            danger: true,
            run: async () => {
              await community.block(profileId)
              await refresh()
              onBlocked()
            },
            confirm: {
              title: `Chặn ${name}?`,
              message:
                'Nội dung và tương tác giữa hai bên sẽ không còn hiển thị theo quy tắc cộng đồng.',
              label: 'Xác nhận chặn',
            },
          },
        ]),
  ]
  return (
    <SocialFrame
      title="Trang cá nhân"
      backLabel="Quay lại"
      onBack={onBack}
      right={
        actions.length > 0 ? (
          <IconButton
            icon="dots-horizontal"
            label={`Tùy chọn cho ${name}`}
            onPress={() => setSheet(true)}
          />
        ) : undefined
      }
    >
      <Reveal step={0} style={styles.hero}>
        <Avatar author={member} size={84} />
        <Txt accessibilityRole="header" style={styles.name}>
          {name}
        </Txt>
        {!self && (
          <View style={styles.actions}>
            {relation.state === 'NONE' && (
              <CommunityButton
                variant="primary"
                icon="account-plus-outline"
                label="Kết bạn"
                disabled={action.busy}
                onPress={() => void request()}
              />
            )}
            {relation.state === 'OUTGOING' && (
              <CommunityButton
                label="Đã gửi lời mời"
                onPress={() => setSheet(true)}
              />
            )}
            {relation.state === 'INCOMING' && relation.friendshipId && (
              <>
                <CommunityButton
                  variant="primary"
                  label="Chấp nhận"
                  disabled={action.busy}
                  onPress={() => void accept(relation.friendshipId!)}
                />
                <CommunityButton
                  variant="quiet"
                  label="Từ chối"
                  disabled={action.busy}
                  onPress={() =>
                    void action.run(async () => {
                      await unlink(relation.friendshipId!)()
                    })
                  }
                />
              </>
            )}
            {relation.state === 'FRIENDS' && (
              <CommunityButton
                variant="primary"
                icon="message-text-outline"
                label="Nhắn tin"
                onPress={() => onMessage(profileId)}
              />
            )}
          </View>
        )}
        {action.error ? (
          <Txt accessibilityLiveRegion="polite" style={styles.error}>
            {action.error}
          </Txt>
        ) : null}
      </Reveal>
      <Band />
      {posts.length === 0 ? (
        <StateCard
          icon="text-box-outline"
          title="Chưa có bài viết nào trong mục này"
        />
      ) : (
        posts.map((post, index) => (
          <CommunityFeedPost
            key={post.postId}
            post={post}
            topicLabels={topicLabels}
            step={Math.min(index + 1, 5)}
            animate
            commands={commands}
            onOpen={() => onOpenPost(post.postId)}
            onMenu={() => setMenu({ postId: post.postId, open: true })}
            onEntered={() => {}}
          />
        ))
      )}
      {query.hasNextPage && (
        <LoadMore
          label="Xem thêm bài viết"
          loading={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
      <ActionSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title={name}
        actions={actions}
      />
      {menu && (
        <CommunityPostMenu
          api={community}
          subject={subject}
          postId={menu.postId}
          open={menu.open}
          onClose={() => setMenu({ ...menu, open: false })}
          onEdit={() => onOpenPost(menu.postId)}
          onHelp={() => setMenu({ ...menu, open: false })}
          onHidden={async () => {
            setMenu({ ...menu, open: false })
            await refresh()
          }}
          onRefresh={refresh}
          onPeerChat={onMessage}
        />
      )}
    </SocialFrame>
  )
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  name: {
    color: communityColors.ink,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 28,
    textAlign: 'center',
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  error: {
    color: communityColors.danger,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
})
