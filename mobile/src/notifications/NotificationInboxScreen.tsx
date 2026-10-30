import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import type { MobileRole } from '@/auth/session'
import { useSession } from '@/auth/session-context'
import { Screen } from '@/components/Screen'
import type { NotificationApi } from './notification-api'
import { notificationDestination } from './notification-link'
import {
  NotificationButton,
  notificationError,
  styles,
} from './notification-ui'

function AccountInbox({
  api,
  subject,
  role,
  onBack,
  onPreferences,
  onOpen,
}: Readonly<{
  api: NotificationApi
  subject: string
  role: MobileRole
  onBack: () => void
  onPreferences: () => void
  onOpen: (
    destination: NonNullable<ReturnType<typeof notificationDestination>>,
  ) => void
}>) {
  const client = useQueryClient()
  const mounted = useRef(true)
  const commandPending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const key = ['notifications', subject, role, 'inbox'] as const
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.list(pageParam),
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
  const ready = query.isSuccess && !query.isFetching && !busy
  const items =
    query.isSuccess && !query.isRefetching
      ? [
          ...new Map(
            query.data.pages
              .flatMap((page) => page.items)
              .map((item) => [item.id, item]),
          ).values(),
        ]
      : []
  const unreadCount = query.data?.pages.at(-1)?.unreadCount
  const run = async (id?: string, open = false) => {
    if (!ready || commandPending.current) return
    commandPending.current = true
    setBusy(true)
    setNotice(null)
    try {
      const item = id ? await api.markRead(id) : null
      if (!id) await api.markAllRead()
      await client.invalidateQueries({ queryKey: key })
      if (!mounted.current) return
      if (open) {
        const destination = notificationDestination(item?.action ?? null, role)
        if (destination) onOpen(destination)
        else
          setNotice(
            'Liên kết này chưa khả dụng trong ứng dụng. Thông báo đã được đánh dấu đã đọc.',
          )
      } else
        setNotice(
          id
            ? 'Thông báo đã được đánh dấu đã đọc.'
            : 'Đã cập nhật trạng thái đọc từ hệ thống.',
        )
    } catch (error) {
      await client.invalidateQueries({ queryKey: key })
      if (mounted.current) setNotice(notificationError(error))
    } finally {
      commandPending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <Screen>
      <View style={styles.column}>
        <NotificationButton label="Về không gian của bạn" onPress={onBack} />
        <Text accessibilityRole="header" style={styles.title}>
          Thông báo của bạn
        </Text>
        <Text style={styles.muted}>
          Xem lời nhắc và cập nhật. Mở thông báo để tiếp tục đúng hoạt động.
        </Text>
        <NotificationButton
          label="Tùy chọn nhận thông báo"
          onPress={onPreferences}
        />
        {notice && (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {notice}
          </Text>
        )}
        {query.isPending || query.isRefetching ? (
          <Text accessibilityLiveRegion="polite" style={styles.muted}>
            Đang tải thông báo…
          </Text>
        ) : null}
        {query.isError && (
          <Text accessibilityRole="alert" style={styles.body}>
            {notificationError(query.error)}
          </Text>
        )}
        <NotificationButton
          label="Tải lại thông báo"
          disabled={query.isFetching || busy}
          onPress={() => void query.refetch()}
        />
        {query.isSuccess && !query.isRefetching && (
          <>
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {unreadCount} thông báo chưa đọc
            </Text>
            <NotificationButton
              label="Đánh dấu tất cả đã đọc"
              disabled={!ready || unreadCount === 0}
              onPress={() => void run()}
            />
            {items.length === 0 && (
              <Text style={styles.muted}>
                Chưa có thông báo. Những cập nhật mới sẽ xuất hiện tại đây.
              </Text>
            )}
            {items.map((item) => (
              <View key={item.id} style={styles.item}>
                <Text style={styles.heading}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.muted}>
                  {item.read ? 'Đã đọc' : 'Chưa đọc'} ·{' '}
                  {new Intl.DateTimeFormat('vi-VN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(item.createdAt))}
                </Text>
                {item.action &&
                  (notificationDestination(item.action, role) ? (
                    <NotificationButton
                      label={`Mở: ${item.title}`}
                      disabled={!ready}
                      onPress={() => void run(item.id, true)}
                    />
                  ) : (
                    <Text style={styles.muted}>
                      Liên kết này chưa khả dụng trong ứng dụng.
                    </Text>
                  ))}
                {!item.read && (
                  <NotificationButton
                    label={`Đánh dấu đã đọc: ${item.title}`}
                    disabled={!ready}
                    onPress={() => void run(item.id)}
                  />
                )}
              </View>
            ))}
            {query.hasNextPage && (
              <NotificationButton
                label={
                  query.isFetchingNextPage
                    ? 'Đang tải thêm…'
                    : 'Xem thông báo cũ hơn'
                }
                disabled={!ready}
                onPress={() => void query.fetchNextPage()}
              />
            )}
          </>
        )}
      </View>
    </Screen>
  )
}
export function NotificationInboxScreen(
  props: Omit<React.ComponentProps<typeof AccountInbox>, 'subject' | 'role'>,
) {
  const { session } = useSession()
  if (!session)
    return (
      <Screen>
        <Text style={styles.body}>Đăng nhập để xem thông báo.</Text>
      </Screen>
    )
  return (
    <AccountInbox
      key={`${session.subject}:${session.role}`}
      {...props}
      subject={session.subject}
      role={session.role}
    />
  )
}
