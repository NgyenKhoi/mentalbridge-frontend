import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState, useSyncExternalStore } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'
import {
  reminderCategories,
  reminderDate,
  reminderDestination,
  reminderStatuses,
  reminderTime,
  type ReminderDelivery,
  type ReminderSource,
} from './reminder-model'

type Props = Readonly<{
  source: ReminderSource
  onBack: () => void
  onInbox: () => void
  onPreferences: () => void
  onOpen: (
    destination: NonNullable<ReturnType<typeof reminderDestination>>,
  ) => void
}>

function deliveryMessage(delivery: ReminderDelivery, timeZone: string) {
  switch (delivery.state) {
    case 'paused':
      return 'Lời nhắc đang tạm dừng. Các hoạt động vẫn được giữ nguyên.'
    case 'quiet-hours':
      return `Bạn đang trong giờ yên tĩnh (${delivery.start}–${delivery.end}, ${timeZone}). Thời điểm gửi lời nhắc có thể thay đổi.`
    case 'available':
      return delivery.nextEligibleAt
        ? `Thời điểm nhắc dự kiến: ${reminderTime(delivery.nextEligibleAt, timeZone)}. Đây không phải xác nhận đã gửi.`
        : 'Chưa có thời điểm nhắc tiếp theo. Bạn có thể chủ động mở hoạt động.'
    case 'unavailable':
      return 'Chưa có thông tin về thời điểm gửi lời nhắc.'
  }
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để xem lịch của bạn.'
    if (error.status === 403) return 'Tài khoản này chưa thể xem lịch nhắc.'
    if (error.status === 409)
      return 'Tùy chọn vừa thay đổi. Tải lại để xem lịch nhắc hiện tại.'
    if (error.code === 'NETWORK_ERROR')
      return 'Chưa thể kết nối. Kiểm tra mạng rồi tải lại lịch.'
    if (error.code === 'REQUEST_TIMEOUT')
      return 'Tải lịch mất quá nhiều thời gian. Bạn có thể thử lại.'
  }
  return 'Chưa thể tải lịch của bạn. Vui lòng thử lại.'
}

function AccountReminderCenter({
  subject,
  ...props
}: Props & { subject: string }) {
  const client = useQueryClient()
  const online = useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
  )
  const [tab, setTab] = useState<'today' | 'upcoming'>('today')
  const key = ['reminders', subject, 'overview'] as const
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => props.source.read(signal),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
  useFocusEffect(
    useCallback(() => {
      void client.invalidateQueries(
        { queryKey: ['reminders', subject, 'overview'] },
        { cancelRefetch: false },
      )
    }, [client, subject]),
  )
  const busy = query.isFetching || query.isPending
  const overview =
    online && query.isSuccess && !query.isFetching ? query.data : null
  const ready = overview?.state === 'ready' ? overview : null
  const rows = ready ? (tab === 'today' ? ready.today : ready.upcoming) : []

  return (
    <Screen>
      <View style={styles.column}>
        <PrimaryButton label="Về không gian của bạn" onPress={props.onBack} />
        <Text accessibilityRole="header" style={styles.title}>
          Hôm nay của bạn
        </Text>
        <Text style={styles.muted}>
          Xem việc cần làm và tiếp tục hoạt động phù hợp với bạn.
        </Text>
        <View style={styles.row} accessibilityRole="tablist">
          {(['today', 'upcoming'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              onPress={() => setTab(value)}
              testID={`reminders-tab-${value}`}
              style={({ pressed }) => [
                styles.tab,
                tab === value && styles.selectedTab,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.tabText, tab === value && styles.selectedText]}
              >
                {value === 'today' ? 'Hôm nay' : 'Sắp tới'}
              </Text>
            </Pressable>
          ))}
        </View>
        {!online ? (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            Bạn đang ngoại tuyến. Kết nối mạng rồi tải lại để xem lịch mới nhất.
          </Text>
        ) : busy ? (
          <Text accessibilityLiveRegion="polite" style={styles.muted}>
            Đang tải lịch…
          </Text>
        ) : query.isError ? (
          <Text accessibilityRole="alert" style={styles.body}>
            {errorMessage(query.error)}
          </Text>
        ) : null}
        {overview?.state === 'unavailable' && (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            Chưa thể hiển thị lịch nhắc. Bạn vẫn có thể xem thông báo và mở các
            hoạt động của mình.
          </Text>
        )}
        {ready && (
          <>
            <View style={styles.notice}>
              <Text style={styles.body}>
                {deliveryMessage(ready.delivery, ready.timeZone)}
              </Text>
            </View>
            <Text style={styles.muted}>
              {reminderDate(ready.localDate)} · {ready.timeZone}
            </Text>
            {rows.length === 0 &&
              (tab === 'today' || !ready.deliveryPreviews?.length) && (
                <Text accessibilityLiveRegion="polite" style={styles.body}>
                  {tab === 'today'
                    ? 'Chưa có hoạt động nào trong hôm nay.'
                    : 'Chưa có hoạt động sắp tới.'}
                </Text>
              )}
            {rows.map((item) => {
              const destination = reminderDestination(item)
              return (
                <View key={item.id} style={styles.item}>
                  <Text accessibilityRole="header" style={styles.heading}>
                    {item.title}
                  </Text>
                  <Text style={styles.muted}>
                    {reminderCategories[item.category]} ·{' '}
                    {reminderStatuses[item.status]}
                  </Text>
                  {item.scheduledAt && (
                    <Text style={styles.muted}>
                      {reminderTime(item.scheduledAt, ready.timeZone)}
                    </Text>
                  )}
                  {destination && (
                    <PrimaryButton
                      label={`Mở: ${item.title}`}
                      onPress={() => props.onOpen(destination)}
                      testID={`reminders-open-${item.id}`}
                    />
                  )}
                </View>
              )
            })}
            {tab === 'upcoming' && ready.deliveryPreviews && (
              <>
                <Text style={styles.muted}>
                  Thời điểm lời nhắc là dự kiến và có thể thay đổi theo hoạt
                  động và tùy chọn của bạn.
                </Text>
                {ready.deliveryPreviews.map((preview) => (
                  <View key={preview.id} style={styles.item}>
                    <Text accessibilityRole="header" style={styles.heading}>
                      {preview.title}
                    </Text>
                    <Text style={styles.body}>
                      {preview.channel} · {preview.status}
                    </Text>
                    {preview.nextEligibleAt && (
                      <Text style={styles.muted}>
                        Dự kiến:{' '}
                        {reminderTime(preview.nextEligibleAt, ready.timeZone)}
                      </Text>
                    )}
                    {preview.latestDelivery && (
                      <Text style={styles.muted}>
                        Ghi nhận gần nhất: {preview.latestDelivery.label} ·{' '}
                        {reminderTime(
                          preview.latestDelivery.recordedAt,
                          ready.timeZone,
                        )}
                      </Text>
                    )}
                  </View>
                ))}
                {!!ready.unsupportedCategories?.length && (
                  <Text style={styles.muted}>
                    Lịch nhắc chưa hỗ trợ:{' '}
                    {ready.unsupportedCategories.join(', ')}.
                  </Text>
                )}
              </>
            )}
          </>
        )}
        <View style={styles.row}>
          <PrimaryButton
            label="Tải lại lịch"
            disabled={!online || query.isFetching}
            onPress={() => void query.refetch()}
          />
          <PrimaryButton label="Xem thông báo" onPress={props.onInbox} />
          <PrimaryButton
            label="Tùy chọn lời nhắc"
            onPress={props.onPreferences}
          />
        </View>
      </View>
    </Screen>
  )
}

export function ReminderCenterScreen(props: Props) {
  const { session } = useSession()
  if (session?.role !== 'USER')
    return (
      <Screen>
        <Text style={styles.body}>
          Đăng nhập bằng tài khoản cá nhân để xem lịch nhắc.
        </Text>
      </Screen>
    )
  return (
    <AccountReminderCenter
      key={session.subject}
      {...props}
      subject={session.subject}
    />
  )
}

const styles = StyleSheet.create({
  column: { gap: spacing.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    lineHeight: typography.headingLineHeight,
    fontWeight: '700',
  },
  heading: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  body: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  muted: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  notice: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.panel,
    padding: spacing.lg,
  },
  item: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tab: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.tealDeep,
    borderRadius: radii.control,
  },
  selectedTab: { backgroundColor: colors.tealDeep },
  tabText: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  selectedText: { color: colors.white },
  pressed: { opacity: 0.82 },
})
