import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import type { MobileRole } from '@/auth/session'
import { useForegroundRefresh } from '@/api/use-foreground-refresh'
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
  initialAppointmentFilter,
}: Readonly<{
  api: NotificationApi
  subject: string
  role: MobileRole
  onBack: () => void
  onPreferences: () => void
  initialAppointmentFilter?: boolean
  onOpen: (
    destination: NonNullable<ReturnType<typeof notificationDestination>>,
  ) => void
}>) {
  const client = useQueryClient()
  const mounted = useRef(true)
  const commandPending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [onlyAppointments, setOnlyAppointments] = useState(
    initialAppointmentFilter ?? false,
  )
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
  useForegroundRefresh(() => {
    if (!commandPending.current && !query.isFetching)
      void query.refetch({ cancelRefetch: false })
  }, role === 'USER')
  const ready = query.isSuccess && !busy
  const items = query.isSuccess
    ? [
        ...new Map(
          query.data.pages
            .flatMap((page) => page.items)
            .map((item) => [item.id, item]),
        ).values(),
      ].filter(
        (item) =>
          !onlyAppointments ||
          item.kind === 'APPOINTMENT' ||
          item.action?.type === 'OPEN_APPOINTMENTS' ||
          item.action?.type === 'OPEN_APPOINTMENT',
      )
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
      await client.invalidateQueries({
        queryKey: ['notifications', subject, role],
      })
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
      await client.invalidateQueries({
        queryKey: ['notifications', subject, role],
      })
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
        {role === 'USER' && (
          <NotificationButton
            label={
              onlyAppointments
                ? 'Xem tất cả thông báo'
                : 'Chỉ xem thông báo lịch hẹn'
            }
            onPress={() => setOnlyAppointments((value) => !value)}
          />
        )}
        {query.isPending ? (
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
        {query.isSuccess && (
          <>
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {unreadCount} thông báo chưa đọc
              {onlyAppointments ? ' trong hộp thư' : ''}
            </Text>
            {!onlyAppointments && (
              <NotificationButton
                label="Đánh dấu tất cả đã đọc"
                disabled={!ready || unreadCount === 0}
                onPress={() => void run()}
              />
            )}
            {items.length === 0 && (
              <Text style={styles.muted}>
                {onlyAppointments
                  ? 'Chưa có thông báo lịch hẹn trong các mục đã tải.'
                  : 'Chưa có thông báo. Những cập nhật mới sẽ xuất hiện tại đây.'}
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
                disabled={!ready || query.isFetching}
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
