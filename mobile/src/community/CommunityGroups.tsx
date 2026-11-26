import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { colors, radii, spacing } from '@/theme/tokens'
import type { CircleApi, CommunityCircle } from './community-circle-api'
import {
  CommunityButton,
  CommunityMessage,
  useCommandKey,
  useCommunityAction,
} from './community-ui'

function GroupPosts({
  api,
  group,
  subject,
  onBack,
}: Readonly<{
  api: CircleApi
  group: CommunityCircle
  subject: string
  onBack: () => void
}>) {
  const [text, setText] = useState('')
  const action = useCommunityAction()
  const key = useCommandKey()
  const posts = useInfiniteQuery({
    queryKey: ['community-circles', subject, group.id, 'posts'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.posts(group.id, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: false,
  })
  const publish = () =>
    action.run(async () => {
      const body = text.trim()
      await api.publish(group.id, body, key({ group: group.id, text: body }))
      setText('')
      await posts.refetch()
    })
  return (
    <View style={s.column}>
      <CommunityButton label="Về danh sách nhóm" onPress={onBack} />
      <Text accessibilityRole="header" style={s.heading}>
        {group.name}
      </Text>
      <Text style={s.muted}>{group.description}</Text>
      <Text style={s.muted}>
        {group.memberCount} thành viên · Chia sẻ trong nhóm
      </Text>
      <View style={s.card}>
        <TextInput
          accessibilityLabel="Chia sẻ với nhóm"
          placeholder="Bạn muốn chia sẻ điều gì?"
          multiline
          maxLength={5000}
          style={s.input}
          value={text}
          onChangeText={setText}
          editable={!action.busy}
        />
        <CommunityButton
          label={action.busy ? 'Đang gửi…' : 'Gửi chia sẻ vào nhóm'}
          disabled={action.busy || !text.trim()}
          onPress={() => void publish()}
        />
        {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
      </View>
      {posts.isPending && (
        <CommunityMessage>Đang tải chia sẻ trong nhóm…</CommunityMessage>
      )}
      {posts.isError ? (
        <CommunityButton
          label="Tải lại chia sẻ trong nhóm"
          onPress={() => void posts.refetch()}
        />
      ) : (
        posts.data?.pages
          .flatMap((page) => page.items)
          .map((entry) => (
            <View key={entry.id} style={s.card}>
              <Text style={s.name}>
                {entry.author?.displayName ?? 'Thành viên đã rời nhóm'}
              </Text>
              <Text style={s.body}>{entry.text}</Text>
              <Text style={s.muted}>
                {new Intl.DateTimeFormat('vi-VN', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(entry.createdAt))}
              </Text>
            </View>
          ))
      )}
      {posts.isSuccess &&
        posts.data.pages.every((page) => !page.items.length) && (
          <Text style={s.muted}>Chưa có chia sẻ trong nhóm.</Text>
        )}
      {posts.hasNextPage && (
        <CommunityButton
          label="Xem thêm chia sẻ trong nhóm"
          disabled={posts.isFetching}
          onPress={() => void posts.fetchNextPage()}
        />
      )}
    </View>
  )
}

export function CommunityGroups({
  api,
  subject,
}: Readonly<{ api: CircleApi; subject: string }>) {
  const [group, setGroup] = useState<CommunityCircle | null>(null)
  const action = useCommunityAction()
  const groups = useInfiniteQuery({
    queryKey: ['community-circles', subject],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.list(pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: false,
  })
  if (group)
    return (
      <GroupPosts
        key={group.id}
        api={api}
        group={group}
        subject={subject}
        onBack={() => setGroup(null)}
      />
    )
  return (
    <View style={s.column}>
      <Text accessibilityRole="header" style={s.heading}>
        Nhóm đồng hành
      </Text>
      <Text style={s.muted}>Các nhóm bạn đã tham gia và lời mời đang chờ.</Text>
      {groups.isPending && (
        <CommunityMessage>Đang tải nhóm đồng hành…</CommunityMessage>
      )}
      {groups.isError ? (
        <CommunityButton
          label="Tải lại nhóm đồng hành"
          onPress={() => void groups.refetch()}
        />
      ) : (
        groups.data?.pages
          .flatMap((page) => page.items)
          .map((item) => (
            <View key={item.id} style={s.card}>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.body}>{item.description}</Text>
              <Text style={s.muted}>
                {item.memberCount} thành viên
                {item.membership === 'PENDING' ? ' · Lời mời tham gia' : ''}
              </Text>
              {item.membership === 'ACTIVE' ? (
                <CommunityButton
                  label={`Mở nhóm ${item.name}`}
                  onPress={() => setGroup(item)}
                />
              ) : (
                <View style={s.column}>
                  {(['ACCEPT', 'DECLINE'] as const).map((decision) => (
                    <CommunityButton
                      key={decision}
                      label={
                        decision === 'ACCEPT'
                          ? 'Nhận lời mời'
                          : 'Từ chối lời mời'
                      }
                      disabled={action.busy}
                      onPress={() =>
                        void action.run(async () => {
                          await api.decide(item.id, decision)
                          await groups.refetch()
                        })
                      }
                    />
                  ))}
                </View>
              )}
            </View>
          ))
      )}
      {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
      {groups.isSuccess &&
        groups.data.pages.every((page) => !page.items.length) && (
          <View style={s.card}>
            <Text style={s.body}>
              Bạn chưa tham gia nhóm nào. Nhóm sẽ xuất hiện khi bạn nhận lời mời
              từ cộng đồng.
            </Text>
          </View>
        )}
      {groups.hasNextPage && (
        <CommunityButton
          label="Xem thêm nhóm"
          disabled={groups.isFetching}
          onPress={() => void groups.fetchNextPage()}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  column: { gap: spacing.md },
  heading: { fontSize: 20, fontWeight: '800', color: colors.ink },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, lineHeight: 22, color: colors.ink },
  muted: { fontSize: 12, lineHeight: 18, color: colors.inkSoft },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.panel,
  },
  input: {
    minHeight: 90,
    textAlignVertical: 'top',
    padding: spacing.md,
    backgroundColor: '#F3F6F3',
    borderRadius: radii.control,
    color: colors.ink,
  },
})
