import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { PressableScale } from '@/components/PressableScale'
import { Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'
import type { CommunityApi } from '@/community/community-api'
import { PostBody, PostHeader } from '@/community/CommunityPostBlock'
import {
  Avatar,
  Band,
  CommunityButton,
  CommunityIcon,
  CommunityMessage,
  communityMessage,
  communityText,
  IconButton,
  relativeTime,
  Reveal,
  SkeletonGroup,
  SkeletonRow,
  StateCard,
  useCommandKey,
  useCommunityAction,
  type AvatarAuthor,
} from '@/community/community-ui'
import { communityColors } from '@/community/community-theme'

import type { CommunitySocialApi } from './community-social-api'
import type { CircleDetail, CircleEntry } from './community-social-contract'
import {
  ActionSheet,
  LoadFailure,
  LoadMore,
  PersonRow,
  roleLabel,
  SocialFrame,
  SocialSkeleton,
  StickyInput,
  socialKey,
  useBackOverride,
  type SheetAction,
} from './community-social-ui'

const unknownMember: AvatarAuthor = {
  displayName: 'Thành viên',
  avatarPreset: null,
  state: 'ACTIVE',
}
const deleteCopy = {
  post: { label: 'Xóa bài viết', title: 'Xóa bài viết này?' },
  comment: { label: 'Xóa bình luận', title: 'Xóa bình luận này?' },
} as const
type Panel =
  | Readonly<{ kind: 'feed' }>
  | Readonly<{ kind: 'members' }>
  | Readonly<{ kind: 'entry'; entry: CircleEntry }>
type Removal = Readonly<{
  id: string
  kind: 'post' | 'comment'
  open: boolean
}>

type Props = Readonly<{
  api: CommunitySocialApi
  community: CommunityApi
  subject: string
  circleId: string
  onBack: () => void
  /** The viewer left or archived the group. */
  onLeft: () => void
}>

function EntryBlock({
  entry,
  onMenu,
  onComments,
}: Readonly<{
  entry: CircleEntry
  onMenu?: () => void
  onComments?: () => void
}>) {
  const author = entry.author ?? unknownMember
  return (
    <View style={styles.entry}>
      <PostHeader
        author={author}
        publishedAt={entry.createdAt}
        topics={[]}
        {...(entry.canDelete && onMenu
          ? { menuLabel: 'Tùy chọn bài viết', onMenu }
          : {})}
      />
      <View style={styles.entryBody}>
        <PostBody>{entry.text}</PostBody>
      </View>
      {onComments && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Bình luận bài viết của ${author.displayName}`}
          scaleTo={0.96}
          onPress={onComments}
          style={styles.commentButton}
        >
          <CommunityIcon
            name="comment-outline"
            size={22}
            color={communityColors.ink}
          />
          <Txt style={styles.commentLabel}>Bình luận</Txt>
        </PressableScale>
      )}
    </View>
  )
}

function CommentRow({
  comment,
  onMenu,
}: Readonly<{ comment: CircleEntry; onMenu: () => void }>) {
  const author = comment.author ?? unknownMember
  return (
    <View style={styles.comment}>
      <Avatar author={author} size={30} />
      <View style={styles.commentText}>
        <Txt style={communityText.author}>
          {author.displayName}
          <Txt
            style={communityText.meta}
          >{`  ${relativeTime(comment.createdAt)}`}</Txt>
        </Txt>
        <Txt style={communityText.body}>{comment.text}</Txt>
      </View>
      {comment.canDelete && (
        <IconButton
          icon="dots-horizontal"
          label="Tùy chọn bình luận"
          onPress={onMenu}
        />
      )}
    </View>
  )
}

function EntryComments({
  api,
  subject,
  circleId,
  entry,
  onBack,
  onRemove,
}: Readonly<{
  api: CommunitySocialApi
  subject: string
  circleId: string
  entry: CircleEntry
  onBack: () => void
  onRemove: (id: string) => void
}>) {
  const client = useQueryClient()
  const [text, setText] = useState('')
  const action = useCommunityAction()
  const key = useCommandKey()
  const queryKey = socialKey(subject, 'circle', circleId, 'comments', entry.id)
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.comments(circleId, entry.id, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const comments = query.data?.pages.flatMap((page) => page.items) ?? []
  const send = () =>
    action.run(async () => {
      const value = text.trim()
      await api.comment(circleId, entry.id, value, key({ value }))
      key.done()
      setText('')
      await client.invalidateQueries({ queryKey })
    })
  return (
    <SocialFrame
      title="Bình luận"
      backLabel="Quay lại nhóm"
      onBack={onBack}
      footer={
        <StickyInput
          label="Viết bình luận"
          placeholder="Gửi một lời chia sẻ tôn trọng…"
          sendLabel="Gửi bình luận"
          maxLength={5000}
          value={text}
          busy={action.busy}
          error={action.error}
          onChange={setText}
          onSend={() => void send()}
        />
      }
    >
      <Reveal step={0}>
        <EntryBlock entry={entry} />
        <Band />
      </Reveal>
      {query.isPending ? (
        <View style={styles.pad}>
          <SkeletonGroup label="Đang tải bình luận…">
            <SkeletonRow size={30} />
            <SkeletonRow size={30} />
          </SkeletonGroup>
        </View>
      ) : query.isError ? (
        <View style={styles.pad}>
          <CommunityMessage>{communityMessage(query.error)}</CommunityMessage>
          <CommunityButton
            variant="quiet"
            label="Thử lại"
            onPress={() => void query.refetch()}
          />
        </View>
      ) : comments.length === 0 ? (
        <Txt style={[communityText.meta, styles.pad]}>
          Chưa có bình luận. Bạn có thể bắt đầu bằng một lời đồng hành.
        </Txt>
      ) : (
        <>
          {comments.map((comment, index) => (
            <Reveal key={comment.id} step={Math.min(index + 1, 5)}>
              <CommentRow
                comment={comment}
                onMenu={() => onRemove(comment.id)}
              />
            </Reveal>
          ))}
          {query.hasNextPage && (
            <LoadMore
              label="Xem bình luận trước"
              loading={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          )}
        </>
      )}
    </SocialFrame>
  )
}

function Members({
  api,
  subject,
  detail,
  ownId,
  onBack,
}: Readonly<{
  api: CommunitySocialApi
  subject: string
  detail: CircleDetail
  ownId: string | null
  onBack: () => void
}>) {
  const client = useQueryClient()
  const [invited, setInvited] = useState<string[]>([])
  const [sheet, setSheet] = useState<{
    id: string
    name: string
    open: boolean
  }>()
  const action = useCommunityAction()
  const { group } = detail
  const owner = group.role === 'OWNER'
  const friends = useInfiniteQuery({
    queryKey: socialKey(subject, 'friends', 'accepted'),
    enabled: owner,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.friends('accepted', pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const refresh = () =>
    client.invalidateQueries({
      queryKey: socialKey(subject, 'circle', group.id),
    })
  const memberIds = new Set(
    detail.members.map((member) => member.profile.communityProfileId),
  )
  const candidates = (
    friends.data?.pages.flatMap((page) => page.items) ?? []
  ).filter((friend) => !memberIds.has(friend.peer.communityProfileId))
  const invite = (profileId: string) =>
    action.run(async () => {
      await api.invite(group.id, profileId)
      setInvited((old) => [...old, profileId])
    })
  const removeAction = (): SheetAction[] =>
    sheet
      ? [
          {
            key: 'remove',
            label: `Xóa ${sheet.name} khỏi nhóm`,
            icon: 'account-remove-outline',
            danger: true,
            run: async () => {
              await api.removeMember(group.id, sheet.id)
              await refresh()
            },
            confirm: {
              title: `Xóa ${sheet.name} khỏi nhóm?`,
              message:
                'Người rời nhóm sẽ không còn xem được bài viết, bình luận và thành viên.',
              label: 'Xác nhận',
            },
          },
        ]
      : []
  return (
    <SocialFrame
      title="Thành viên & thông tin"
      backLabel="Quay lại nhóm"
      onBack={onBack}
    >
      <Reveal step={0} style={styles.info}>
        <Txt style={communityText.section}>{group.name}</Txt>
        {group.description ? (
          <Txt style={communityText.body}>{group.description}</Txt>
        ) : null}
      </Reveal>
      {action.error ? (
        <CommunityMessage>{action.error}</CommunityMessage>
      ) : null}
      {owner && candidates.length > 0 && (
        <Reveal step={1}>
          <Txt
            accessibilityRole="header"
            style={[communityText.author, styles.pad]}
          >
            Mời bạn bè
          </Txt>
          {candidates.map((friend) => {
            const id = friend.peer.communityProfileId
            const sent = invited.includes(id)
            return (
              <PersonRow
                key={id}
                author={friend.peer}
                name={friend.peer.displayName}
                trailing={
                  sent ? (
                    <Txt style={communityText.meta}>Đã mời</Txt>
                  ) : (
                    <CommunityButton
                      label="Mời"
                      accessibilityLabel={`Mời ${friend.peer.displayName}`}
                      icon="account-plus-outline"
                      disabled={action.busy}
                      onPress={() => void invite(id)}
                    />
                  )
                }
              />
            )
          })}
          {friends.hasNextPage && (
            <LoadMore
              label="Xem thêm bạn bè"
              loading={friends.isFetchingNextPage}
              onPress={() => void friends.fetchNextPage()}
            />
          )}
          <Band />
        </Reveal>
      )}
      <Reveal step={2}>
        <Txt
          accessibilityRole="header"
          style={[communityText.author, styles.pad]}
        >
          {`${group.memberCount} thành viên`}
        </Txt>
        {detail.members.map((member, index) => {
          const id = member.profile.communityProfileId
          const name = member.profile.displayName
          return (
            <PersonRow
              key={id ?? `${name}-${index}`}
              author={member.profile}
              name={name}
              meta={`${roleLabel(member.role)}${id && id === ownId ? ' · Bạn' : ''}`}
              trailing={
                owner && member.role !== 'OWNER' && id ? (
                  <IconButton
                    icon="dots-horizontal"
                    label={`Tùy chọn cho ${name}`}
                    onPress={() => setSheet({ id, name, open: true })}
                  />
                ) : undefined
              }
            />
          )
        })}
      </Reveal>
      <ActionSheet
        visible={sheet?.open ?? false}
        onClose={() => setSheet((old) => old && { ...old, open: false })}
        title={sheet?.name ?? ''}
        actions={removeAction()}
      />
    </SocialFrame>
  )
}

export function CommunityCircleScreen({
  api,
  community,
  subject,
  circleId,
  onBack,
  onLeft,
}: Props) {
  const client = useQueryClient()
  const [panel, setPanel] = useState<Panel>({ kind: 'feed' })
  const [menu, setMenu] = useState(false)
  const [removal, setRemoval] = useState<Removal>()
  const [text, setText] = useState('')
  const action = useCommunityAction()
  const key = useCommandKey()
  const toFeed = useCallback(() => setPanel({ kind: 'feed' }), [])
  useBackOverride(panel.kind !== 'feed', toFeed)
  const detail = useQuery({
    queryKey: socialKey(subject, 'circle', circleId),
    queryFn: () => api.circle(circleId),
  })
  const entriesKey = socialKey(subject, 'circle', circleId, 'entries')
  const entries = useInfiniteQuery({
    queryKey: entriesKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.entries(circleId, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  // Same key as the Community screen, so the profile is usually cached already.
  const profile = useQuery({
    queryKey: ['community', subject, 'profile'],
    queryFn: () => community.profile(),
  })
  const ownId =
    profile.data?.profile.status === 'ACTIVE'
      ? profile.data.profile.communityProfileId
      : null
  const group = detail.data?.group
  const leave = async (work: () => Promise<void>) => {
    await work()
    await client.invalidateQueries({ queryKey: socialKey(subject, 'circles') })
    onLeft()
  }
  const send = () =>
    action.run(async () => {
      const value = text.trim()
      await api.publish(circleId, value, key({ value }))
      key.done()
      setText('')
      await client.invalidateQueries({ queryKey: entriesKey })
    })
  const sheetActions = (): SheetAction[] => {
    if (!group) return []
    return [
      {
        key: 'members',
        label: 'Thành viên & thông tin',
        icon: 'account-group-outline',
        run: async () => setPanel({ kind: 'members' }),
      },
      ...(group.role === 'OWNER'
        ? [
            {
              key: 'archive',
              label: 'Lưu trữ nhóm',
              icon: 'archive-outline' as const,
              danger: true,
              run: () => leave(() => api.archiveCircle(circleId)),
              confirm: {
                title: 'Lưu trữ nhóm này?',
                message: 'Bài viết và lời mời của nhóm sẽ không còn mở được.',
                label: 'Xác nhận',
              },
            },
          ]
        : ownId
          ? [
              {
                key: 'leave',
                label: 'Rời nhóm',
                icon: 'exit-run' as const,
                danger: true,
                run: () => leave(() => api.removeMember(circleId, ownId)),
                confirm: {
                  title: 'Rời nhóm này?',
                  message:
                    'Người rời nhóm sẽ không còn xem được bài viết, bình luận và thành viên.',
                  label: 'Xác nhận',
                },
              },
            ]
          : []),
    ]
  }
  const removalActions = (): SheetAction[] => {
    if (!removal) return []
    const copy = deleteCopy[removal.kind]
    return [
      {
        key: 'delete',
        label: copy.label,
        icon: 'trash-can-outline',
        danger: true,
        run: async () => {
          if (removal.kind === 'post')
            await api.deleteEntry(circleId, removal.id)
          else await api.deleteComment(circleId, removal.id)
          await client.invalidateQueries({
            queryKey: socialKey(subject, 'circle', circleId),
          })
        },
        confirm: {
          title: copy.title,
          message: 'Nội dung sẽ được gỡ khỏi nhóm.',
          label: 'Xóa nội dung',
        },
      },
    ]
  }

  if (detail.isPending)
    return (
      <SocialFrame title="Nhóm" backLabel="Quay lại nhóm" onBack={onBack}>
        <SocialSkeleton label="Đang mở nhóm của bạn…" />
      </SocialFrame>
    )
  if (detail.isError || !group)
    return (
      <SocialFrame title="Nhóm" backLabel="Quay lại nhóm" onBack={onBack}>
        <LoadFailure
          error={detail.error}
          unavailableTitle="Nhóm hoặc nội dung này không còn khả dụng với bạn."
          failureTitle="Chưa mở được nhóm."
          onRetry={() => void detail.refetch()}
          onBack={onBack}
        />
      </SocialFrame>
    )

  const removalSheet = (
    <ActionSheet
      visible={removal?.open ?? false}
      onClose={() => setRemoval((old) => old && { ...old, open: false })}
      title={removal ? deleteCopy[removal.kind].label : ''}
      actions={removalActions()}
    />
  )
  if (panel.kind === 'members')
    return (
      <Members
        api={api}
        subject={subject}
        detail={detail.data}
        ownId={ownId}
        onBack={toFeed}
      />
    )
  if (panel.kind === 'entry')
    return (
      <>
        <EntryComments
          api={api}
          subject={subject}
          circleId={circleId}
          entry={panel.entry}
          onBack={toFeed}
          onRemove={(id) => setRemoval({ id, kind: 'comment', open: true })}
        />
        {removalSheet}
      </>
    )

  const list = entries.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <SocialFrame
      title={group.name}
      backLabel="Quay lại danh sách nhóm"
      onBack={onBack}
      right={
        <IconButton
          icon="dots-horizontal"
          label="Tùy chọn nhóm"
          onPress={() => setMenu(true)}
        />
      }
      footer={
        <StickyInput
          label="Chia sẻ cùng nhóm"
          placeholder="Một câu chuyện, một điều bạn muốn chia sẻ hôm nay…"
          sendLabel="Đăng bài"
          maxLength={5000}
          value={text}
          busy={action.busy}
          error={action.error}
          onChange={setText}
          onSend={() => void send()}
        />
      }
    >
      <Reveal step={0} style={styles.info}>
        {group.description ? (
          <Txt style={communityText.body}>{group.description}</Txt>
        ) : null}
        <Txt style={communityText.meta}>
          {`${roleLabel(group.role)} · ${group.memberCount} thành viên`}
        </Txt>
      </Reveal>
      <Band />
      {entries.isPending ? (
        <SocialSkeleton
          label="Đang tải bài viết của nhóm…"
          size={38}
          rows={3}
        />
      ) : entries.isError ? (
        <LoadFailure
          error={entries.error}
          unavailableTitle="Nhóm hoặc nội dung này không còn khả dụng với bạn."
          failureTitle="Chưa tải được bài viết."
          onRetry={() => void entries.refetch()}
          onBack={onBack}
        />
      ) : list.length === 0 ? (
        <StateCard
          icon="message-text-outline"
          title="Bắt đầu câu chuyện đầu tiên"
          body="Một lời chào cũng có thể mở đầu một kết nối."
        />
      ) : (
        <>
          {list.map((entry, index) => (
            <Reveal key={entry.id} step={Math.min(index + 1, 5)}>
              <EntryBlock
                entry={entry}
                onMenu={() =>
                  setRemoval({ id: entry.id, kind: 'post', open: true })
                }
                onComments={() => setPanel({ kind: 'entry', entry })}
              />
              <Band />
            </Reveal>
          ))}
          {entries.hasNextPage && (
            <LoadMore
              label="Xem bài viết trước"
              loading={entries.isFetchingNextPage}
              onPress={() => void entries.fetchNextPage()}
            />
          )}
        </>
      )}
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={group.name}
        actions={sheetActions()}
      />
      {removalSheet}
    </SocialFrame>
  )
}

const styles = StyleSheet.create({
  pad: { gap: spacing.sm, padding: spacing.md },
  info: { gap: spacing.xs, padding: spacing.md },
  entry: { paddingTop: spacing.md },
  entryBody: { paddingHorizontal: spacing.md, paddingTop: spacing.sm + 2 },
  commentButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm - 2,
    height: 44,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  commentLabel: {
    color: communityColors.ink,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  comment: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  commentText: { flex: 1, gap: 2 },
})
