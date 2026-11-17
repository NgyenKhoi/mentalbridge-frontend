import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import { PressableScale } from '@/components/PressableScale'
import { Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'
import {
  Avatar,
  Band,
  CommunityButton,
  CommunityIcon,
  CommunityMessage,
  communityMessage,
  communityStyles,
  communityText,
  IconButton,
  StateCard,
  useCommandKey,
  useCommunityAction,
} from '@/community/community-ui'
import { communityColors } from '@/community/community-theme'

import type { CommunitySocialApi } from './community-social-api'
import type { Circle } from './community-social-contract'
import {
  LoadFailure,
  LoadMore,
  Reveal,
  roleLabel,
  SocialFrame,
  SocialSkeleton,
  socialKey,
  useBackOverride,
} from './community-social-ui'

type Props = Readonly<{
  api: CommunitySocialApi
  subject: string
  onBack: () => void
  onOpenCircle: (circleId: string) => void
}>

function CircleRow({
  group,
  step,
  onOpen,
}: Readonly<{ group: Circle; step: number; onOpen: () => void }>) {
  return (
    <Reveal step={step}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Mở nhóm ${group.name}`}
        scaleTo={0.98}
        onPress={onOpen}
        style={styles.circle}
      >
        <Avatar group size={52} />
        <View style={styles.circleText}>
          <Txt numberOfLines={1} style={communityText.author}>
            {group.name}
          </Txt>
          <Txt numberOfLines={1} style={communityText.meta}>
            {`${roleLabel(group.role)} · ${group.memberCount} thành viên`}
          </Txt>
        </View>
        <CommunityIcon name="chevron-right" color={communityColors.inkSoft} />
      </PressableScale>
    </Reveal>
  )
}

function Invitation({
  group,
  busy,
  onDecide,
}: Readonly<{
  group: Circle
  busy: boolean
  onDecide: (decision: 'ACCEPT' | 'DECLINE') => void
}>) {
  return (
    <View style={styles.invite}>
      <Txt style={communityText.author}>{group.name}</Txt>
      <Txt style={communityText.body}>
        {group.description || 'Bạn được mời tham gia nhóm cộng đồng riêng.'}
      </Txt>
      <Txt style={communityText.meta}>Nội dung mở sau khi bạn chấp nhận</Txt>
      <View style={styles.inviteActions}>
        <CommunityButton
          variant="primary"
          label="Tham gia"
          accessibilityLabel={`Tham gia nhóm ${group.name}`}
          disabled={busy}
          onPress={() => onDecide('ACCEPT')}
        />
        <CommunityButton
          variant="quiet"
          label="Từ chối"
          accessibilityLabel={`Từ chối lời mời vào nhóm ${group.name}`}
          disabled={busy}
          onPress={() => onDecide('DECLINE')}
        />
      </View>
    </View>
  )
}

function CreateCircle({
  api,
  subject,
  onClose,
  onCreated,
}: Readonly<{
  api: CommunitySocialApi
  subject: string
  onClose: () => void
  onCreated: (group: Circle) => void
}>) {
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [invitees, setInvitees] = useState<string[]>([])
  const action = useCommunityAction()
  const key = useCommandKey()
  const friends = useInfiniteQuery({
    queryKey: socialKey(subject, 'friends', 'accepted'),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.friends('accepted', pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  useBackOverride(true, onClose)
  const list = friends.data?.pages.flatMap((page) => page.items) ?? []
  const body = { name: name.trim(), description: description.trim(), invitees }
  const toggle = (id: string) =>
    setInvitees((old) =>
      old.includes(id)
        ? old.filter((item) => item !== id)
        : old.length < 19
          ? [...old, id]
          : old,
    )
  const create = () =>
    action.run(async () => {
      const group = await api.createCircle(body, key(body))
      await client.invalidateQueries({
        queryKey: socialKey(subject, 'circles'),
      })
      onCreated(group)
    })
  return (
    <SocialFrame
      title="Tạo nhóm cộng đồng riêng"
      backLabel="Đóng tạo nhóm"
      onBack={onClose}
      footer={
        <View style={styles.footer}>
          {action.error ? (
            <CommunityMessage>{action.error}</CommunityMessage>
          ) : null}
          <CommunityButton
            variant="primary"
            label={action.busy ? 'Đang tạo…' : 'Tạo nhóm riêng'}
            disabled={action.busy || !name.trim()}
            onPress={() => void create()}
          />
        </View>
      }
    >
      <Reveal step={0} style={styles.form}>
        <Txt style={communityText.meta}>
          Một bảng tin dành cho những người bạn chọn.
        </Txt>
        <Txt style={communityText.author}>Tên nhóm</Txt>
        <TextInput
          accessibilityLabel="Tên nhóm"
          maxLength={80}
          placeholder="Đặt tên cho không gian chia sẻ"
          placeholderTextColor={communityColors.inkSoft}
          value={name}
          editable={!action.busy}
          onChangeText={setName}
          style={[communityStyles.input, styles.field]}
        />
        <Txt style={communityText.author}>Giới thiệu nhóm</Txt>
        <TextInput
          accessibilityLabel="Giới thiệu nhóm"
          multiline
          maxLength={500}
          placeholder="Nhóm dành để chia sẻ điều gì?"
          placeholderTextColor={communityColors.inkSoft}
          value={description}
          editable={!action.busy}
          onChangeText={setDescription}
          style={[communityStyles.input, styles.field, styles.area]}
        />
        <Txt style={communityText.meta}>
          Chỉ người được mời và đã chấp nhận mới xem được bài viết, bình luận và
          danh sách thành viên.
        </Txt>
      </Reveal>
      <Reveal step={1}>
        <Txt style={[communityText.author, styles.heading]}>
          {`Mời bạn bè ${invitees.length}/19`}
        </Txt>
        {friends.isPending ? (
          <SocialSkeleton label="Đang tải bạn bè…" size={40} rows={3} />
        ) : friends.isError ? (
          <View style={styles.form}>
            <CommunityMessage>
              {communityMessage(friends.error)}
            </CommunityMessage>
            <CommunityButton
              variant="quiet"
              label="Thử lại"
              onPress={() => void friends.refetch()}
            />
          </View>
        ) : list.length === 0 ? (
          <Txt style={[communityText.meta, styles.heading]}>
            Bạn có thể tạo nhóm trước và mời bạn bè sau.
          </Txt>
        ) : (
          list.map((friend) => {
            const id = friend.peer.communityProfileId
            const picked = invitees.includes(id)
            return (
              <PressableScale
                key={friend.friendshipId}
                accessibilityRole="checkbox"
                accessibilityLabel={friend.peer.displayName}
                accessibilityState={{
                  checked: picked,
                  disabled: action.busy || (!picked && invitees.length >= 19),
                }}
                disabled={action.busy}
                scaleTo={0.98}
                onPress={() => toggle(id)}
                style={styles.pick}
              >
                <Avatar author={friend.peer} size={40} />
                <Txt
                  numberOfLines={1}
                  style={[communityText.body, styles.pickName]}
                >
                  {friend.peer.displayName}
                </Txt>
                <CommunityIcon
                  name={picked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  color={
                    picked
                      ? communityColors.primaryDeep
                      : communityColors.inkSoft
                  }
                />
              </PressableScale>
            )
          })
        )}
        {friends.hasNextPage && (
          <LoadMore
            label="Xem thêm bạn bè"
            loading={friends.isFetchingNextPage}
            onPress={() => void friends.fetchNextPage()}
          />
        )}
      </Reveal>
    </SocialFrame>
  )
}

export function CommunityGroupsScreen({
  api,
  subject,
  onBack,
  onOpenCircle,
}: Props) {
  const client = useQueryClient()
  const [creating, setCreating] = useState(false)
  const action = useCommunityAction()
  const query = useInfiniteQuery({
    queryKey: socialKey(subject, 'circles'),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.circles(pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  if (creating)
    return (
      <CreateCircle
        api={api}
        subject={subject}
        onClose={() => setCreating(false)}
        onCreated={(group) => {
          setCreating(false)
          onOpenCircle(group.id)
        }}
      />
    )
  const all = query.data?.pages.flatMap((page) => page.items) ?? []
  const invitations = all.filter((group) => group.membership === 'PENDING')
  const joined = all.filter((group) => group.membership === 'ACTIVE')
  const decide = (group: Circle, decision: 'ACCEPT' | 'DECLINE') =>
    action.run(async () => {
      await api.decide(group.id, decision)
      await client.invalidateQueries({
        queryKey: socialKey(subject, 'circles'),
      })
      if (decision === 'ACCEPT') onOpenCircle(group.id)
    })
  return (
    <SocialFrame
      title="Nhóm"
      backLabel="Quay lại cộng đồng"
      onBack={onBack}
      right={
        query.isError ? undefined : (
          <IconButton
            icon="plus"
            label="Tạo nhóm riêng"
            filled
            onPress={() => setCreating(true)}
          />
        )
      }
    >
      {action.error ? (
        <CommunityMessage>{action.error}</CommunityMessage>
      ) : null}
      {query.isPending ? (
        <SocialSkeleton label="Đang tải nhóm…" />
      ) : query.isError ? (
        <LoadFailure
          error={query.error}
          unavailableTitle="Nhóm cộng đồng hiện chưa khả dụng"
          failureTitle="Chưa tải được nhóm."
          onRetry={() => void query.refetch()}
          onBack={onBack}
        />
      ) : (
        <>
          {invitations.length > 0 && (
            <Reveal step={0}>
              <Txt
                accessibilityRole="header"
                style={[communityText.section, styles.heading]}
              >
                {`Lời mời tham gia (${invitations.length})`}
              </Txt>
              {invitations.map((group) => (
                <Invitation
                  key={group.id}
                  group={group}
                  busy={action.busy}
                  onDecide={(decision) => void decide(group, decision)}
                />
              ))}
              <Band />
            </Reveal>
          )}
          {joined.length === 0 && invitations.length === 0 ? (
            <StateCard
              icon="account-group-outline"
              title="Một nơi để cùng chia sẻ"
              body="Tạo nhóm hoặc chấp nhận lời mời để bắt đầu chia sẻ."
              actionLabel="Tạo nhóm"
              onAction={() => setCreating(true)}
            />
          ) : (
            joined.map((group, index) => (
              <CircleRow
                key={group.id}
                group={group}
                step={Math.min(index + 1, 5)}
                onOpen={() => onOpenCircle(group.id)}
              />
            ))
          )}
          {query.hasNextPage && (
            <LoadMore
              label="Xem thêm nhóm"
              loading={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          )}
        </>
      )}
    </SocialFrame>
  )
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  circleText: { flex: 1 },
  heading: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  invite: { gap: spacing.sm, padding: spacing.md },
  inviteActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  form: { gap: spacing.sm, padding: spacing.md },
  field: { borderColor: communityColors.line, borderRadius: radii.control },
  area: { minHeight: 88 },
  pick: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  pickName: { flex: 1 },
  footer: {
    backgroundColor: communityColors.background,
    borderTopColor: communityColors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.md,
  },
})
