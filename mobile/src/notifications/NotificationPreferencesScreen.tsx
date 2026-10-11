import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Switch, Text, TextInput, View } from 'react-native'
import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import type { NotificationApi } from './notification-api'
import {
  clockTimeSchema,
  type NotificationPreferences,
  type VersionedPreferences,
} from './notification-contract'
import {
  NotificationButton,
  notificationError,
  styles,
} from './notification-ui'

const groupLabels: Record<
  keyof NotificationPreferences['contentGroups'],
  string
> = {
  journalReminder: 'Nhắc viết nhật ký',
  emotionCheckIn: 'Nhắc ghi nhận cảm xúc',
  streakMilestone: 'Cột mốc hoạt động',
  screeningReassessment: 'Sàng lọc lại',
  appointmentMessage: 'Lịch hẹn và tin nhắn',
  resourceSystem: 'Tài nguyên và hệ thống',
  communityInteraction: 'Tương tác cộng đồng',
}
function Toggle({
  label,
  value,
  disabled,
  change,
}: Readonly<{
  label: string
  value: boolean
  disabled: boolean
  change: (value: boolean) => void
}>) {
  return (
    <View style={styles.row}>
      <Text style={[styles.body, { flex: 1 }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        accessibilityState={{ disabled, checked: value }}
        disabled={disabled}
        value={value}
        onValueChange={change}
      />
    </View>
  )
}
function Field({
  label,
  value,
  change,
  disabled,
}: Readonly<{
  label: string
  value: string
  change: (value: string) => void
  disabled: boolean
}>) {
  return (
    <View style={styles.column}>
      <Text style={styles.body}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  )
}
function validQuiet(draft: NotificationPreferences) {
  const quiet = draft.quietHours
  if (
    !clockTimeSchema.safeParse(quiet.start).success ||
    !clockTimeSchema.safeParse(quiet.end).success ||
    (quiet.enabled && quiet.start === quiet.end)
  )
    return false
  if (
    !clockTimeSchema.safeParse(draft.email.dailyDigestTime).success ||
    !clockTimeSchema.safeParse(draft.email.resourceReminderTime).success
  )
    return false
  try {
    new Intl.DateTimeFormat('vi-VN', { timeZone: quiet.timeZone }).format()
    return true
  } catch {
    return false
  }
}
function PreferenceEditor({
  initial,
  api,
  onSaved,
  onReconcile,
  authority,
}: Readonly<{
  initial: VersionedPreferences
  api: NotificationApi
  onSaved: (value: VersionedPreferences) => void
  onReconcile: () => Promise<void>
  authority: boolean
}>) {
  const [draft, setDraft] = useState(initial.preferences)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const [notice, setNotice] = useState<string | null>(null)
  const disabled = busy || !authority
  const changed = JSON.stringify(draft) !== JSON.stringify(initial.preferences)
  const save = async () => {
    if (disabled || pending.current || !changed) return
    if (!validQuiet(draft)) {
      setNotice(
        'Nhập giờ theo HH:mm, múi giờ hợp lệ và giờ bắt đầu khác giờ kết thúc khi bật giờ yên lặng.',
      )
      return
    }
    pending.current = true
    setBusy(true)
    setNotice(null)
    try {
      const result = await api.savePreferences(
        {
          notificationsEnabled: draft.notificationsEnabled,
          channels: draft.channels,
          contentGroups: draft.contentGroups,
          quietHours: draft.quietHours,
          email: draft.email,
        },
        initial.etag,
      )
      if (mounted.current) onSaved(result)
    } catch (error) {
      if (!mounted.current) return
      setNotice(notificationError(error))
      // A timeout may have persisted the update. Read the current version before
      // allowing another write; never silently replay an obsolete replacement.
      if (!(error instanceof ApiError) || error.status !== 422)
        await onReconcile()
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <View style={styles.column}>
      {notice && (
        <Text accessibilityRole="alert" style={styles.body}>
          {notice}
        </Text>
      )}
      <Toggle
        label="Nhận thông báo"
        value={draft.notificationsEnabled}
        disabled={disabled}
        change={(notificationsEnabled) =>
          setDraft({ ...draft, notificationsEnabled })
        }
      />
      {!draft.notificationsEnabled && (
        <Text style={styles.muted}>
          Thông báo mới đang tắt. Bạn vẫn xem được lịch sử đã lưu.
        </Text>
      )}
      <Text accessibilityRole="header" style={styles.heading}>
        Kênh nhận
      </Text>
      {(['inApp', 'email', 'push'] as const).map((channel) => (
        <Toggle
          key={channel}
          label={
            {
              inApp: 'Trong ứng dụng',
              email: 'Email',
              push: 'Lưu tùy chọn PUSH (chưa hỗ trợ gửi)',
            }[channel]
          }
          value={draft.channels[channel]}
          disabled={disabled || !draft.notificationsEnabled}
          change={(value) =>
            setDraft({
              ...draft,
              channels: { ...draft.channels, [channel]: value },
            })
          }
        />
      ))}
      <Text style={styles.muted}>
        PUSH chỉ lưu lựa chọn của bạn. Ứng dụng chưa đăng ký thiết bị hoặc gửi
        push; bật mục này không bật dịch vụ push.
      </Text>
      <Text accessibilityRole="header" style={styles.heading}>
        Nội dung muốn nhận
      </Text>
      {(Object.keys(groupLabels) as (keyof typeof groupLabels)[]).map(
        (group) => (
          <Toggle
            key={group}
            label={groupLabels[group]}
            value={draft.contentGroups[group]}
            disabled={disabled || !draft.notificationsEnabled}
            change={(value) =>
              setDraft({
                ...draft,
                contentGroups: { ...draft.contentGroups, [group]: value },
              })
            }
          />
        ),
      )}
      <Text style={styles.muted}>
        Tắt một nhóm áp dụng cho thông báo mới, không xóa lịch sử đã lưu.
      </Text>
      <Text accessibilityRole="header" style={styles.heading}>
        Giờ yên lặng
      </Text>
      <Toggle
        label="Bật giờ yên lặng"
        value={draft.quietHours.enabled}
        disabled={disabled}
        change={(enabled) =>
          setDraft({ ...draft, quietHours: { ...draft.quietHours, enabled } })
        }
      />
      {(['start', 'end', 'timeZone'] as const).map((field) => (
        <Field
          key={field}
          label={
            {
              start: 'Bắt đầu (HH:mm)',
              end: 'Kết thúc (HH:mm)',
              timeZone: 'Múi giờ (IANA, ví dụ Asia/Ho_Chi_Minh)',
            }[field]
          }
          value={draft.quietHours[field]}
          disabled={disabled}
          change={(value) =>
            setDraft({
              ...draft,
              quietHours: { ...draft.quietHours, [field]: value },
            })
          }
        />
      ))}
      <Text style={styles.muted}>
        Khung giờ có thể đi qua nửa đêm. Hệ thống áp dụng theo múi giờ đã lưu.
      </Text>
      <Text accessibilityRole="header" style={styles.heading}>
        Tùy chọn email
      </Text>
      {(['IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST'] as const).map(
        (cadence) => (
          <NotificationButton
            key={cadence}
            label={`${draft.email.cadence === cadence ? 'Đang chọn: ' : ''}${{ IMMEDIATE: 'Nhận ngay', DAILY_DIGEST: 'Tổng hợp mỗi ngày', WEEKLY_DIGEST: 'Tổng hợp mỗi tuần' }[cadence]}`}
            disabled={
              disabled || !draft.notificationsEnabled || !draft.channels.email
            }
            onPress={() =>
              setDraft({ ...draft, email: { ...draft.email, cadence } })
            }
          />
        ),
      )}
      {(
        [
          'wellbeingDigestEnabled',
          'resourceRemindersEnabled',
          'appointmentRemindersEnabled',
        ] as const
      ).map((field) =>
        draft.email[field] === undefined ? null : (
          <Toggle
            key={field}
            label={
              {
                wellbeingDigestEnabled: 'Email nhắc chăm sóc bản thân',
                resourceRemindersEnabled: 'Email nhắc tài nguyên',
                appointmentRemindersEnabled: 'Email nhắc lịch hẹn',
              }[field]
            }
            value={draft.email[field]}
            disabled={
              disabled || !draft.notificationsEnabled || !draft.channels.email
            }
            change={(value) =>
              setDraft({ ...draft, email: { ...draft.email, [field]: value } })
            }
          />
        ),
      )}
      {(['dailyDigestTime', 'resourceReminderTime'] as const).map((field) => (
        <Field
          key={field}
          label={
            {
              dailyDigestTime: 'Giờ email tổng hợp (HH:mm)',
              resourceReminderTime: 'Giờ nhắc tài nguyên (HH:mm)',
            }[field]
          }
          value={draft.email[field]}
          disabled={disabled}
          change={(value) =>
            setDraft({ ...draft, email: { ...draft.email, [field]: value } })
          }
        />
      ))}
      <PrimaryButton
        label={busy ? 'Đang lưu tùy chọn…' : 'Lưu tùy chọn'}
        disabled={disabled || !changed}
        onPress={() => void save()}
      />
    </View>
  )
}
function AccountPreferences({
  api,
  subject,
  onBack,
}: Readonly<{ api: NotificationApi; subject: string; onBack: () => void }>) {
  const client = useQueryClient()
  const key = ['notifications', subject, 'preferences'] as const
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.preferences(),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const [notice, setNotice] = useState<string | null>(null)
  const reconcile = async () => {
    setNotice('Tải lại tùy chọn hiện tại trước khi tiếp tục lưu.')
    await query.refetch()
  }
  return (
    <Screen>
      <View style={styles.column}>
        <NotificationButton label="Về thông báo" onPress={onBack} />
        <Text accessibilityRole="header" style={styles.title}>
          Nhận thông báo theo ý bạn
        </Text>
        <Text style={styles.muted}>
          Chọn nội dung, kênh nhận và khoảng thời gian bạn muốn yên lặng.
        </Text>
        {notice && (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {notice}
          </Text>
        )}
        {query.isFetching && (
          <Text style={styles.muted}>Đang tải tùy chọn…</Text>
        )}
        {query.isError && (
          <Text accessibilityRole="alert" style={styles.body}>
            {notificationError(query.error)}
          </Text>
        )}
        <NotificationButton
          label="Tải lại tùy chọn (bỏ thay đổi chưa lưu)"
          disabled={query.isFetching}
          onPress={() => void query.refetch()}
        />
        {query.isSuccess && !query.isFetching && (
          <PreferenceEditor
            key={`${subject}:${query.data.etag}`}
            initial={query.data}
            api={api}
            authority={!query.isFetching}
            onReconcile={reconcile}
            onSaved={(value) => {
              client.setQueryData(key, value)
              setNotice('Tùy chọn đã được lưu.')
            }}
          />
        )}
      </View>
    </Screen>
  )
}
export function NotificationPreferencesScreen(
  props: Omit<React.ComponentProps<typeof AccountPreferences>, 'subject'>,
) {
  const { session } = useSession()
  if (session?.role !== 'USER')
    return (
      <Screen>
        <Text style={styles.body}>
          Đăng nhập bằng tài khoản cá nhân để đổi tùy chọn.
        </Text>
      </Screen>
    )
  return (
    <AccountPreferences
      key={session.subject}
      {...props}
      subject={session.subject}
    />
  )
}
