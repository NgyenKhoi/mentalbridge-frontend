import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated'
import { ApiError } from '@/api/api-error'
import type { MobileRole } from '@/auth/session'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import type { PushApi } from '@/push/push-api'
import { PUSH_STATE_KEY, type PushState } from '@/push/push-constants'
import {
  disablePush,
  enablePush,
  isPushEnabledOnDevice,
} from '@/push/push-registration'
import { colors } from '@/theme/tokens'
import type { NotificationApi } from './notification-api'
import {
  clockTimeSchema,
  type NotificationPreferences,
  type PreferencePatch,
  specialistPreferencePatchSchema,
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
const specialistGroups = [
  'appointmentMessage',
  'resourceSystem',
] as const satisfies readonly (keyof NotificationPreferences['contentGroups'])[]
const specialistGroupLabels: Record<(typeof specialistGroups)[number], string> =
  {
    appointmentMessage: 'Lịch hẹn và tin nhắn',
    resourceSystem: 'Tài khoản và hệ thống',
  }

function preferencePatch(
  draft: NotificationPreferences,
  role: MobileRole,
): PreferencePatch {
  if (role === 'SPECIALIST')
    return specialistPreferencePatchSchema.parse({
      notificationsEnabled: draft.notificationsEnabled,
      channels: { inApp: draft.channels.inApp, push: draft.channels.push },
      contentGroups: {
        appointmentMessage: draft.contentGroups.appointmentMessage,
        resourceSystem: draft.contentGroups.resourceSystem,
      },
    })
  return {
    notificationsEnabled: draft.notificationsEnabled,
    channels: draft.channels,
    contentGroups: draft.contentGroups,
    quietHours: draft.quietHours,
    email: draft.email,
  }
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
  // The whole row is the switch for assistive tech; the native Switch stays tappable but is hidden from them.
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => change(!value)}
      style={({ pressed }) => [
        styles.row,
        { minHeight: 48 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.body, { flex: 1 }]}>{label}</Text>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Switch
          accessible={false}
          disabled={disabled}
          value={value}
          onValueChange={change}
        />
      </View>
    </Pressable>
  )
}
type PushLine = 'busy' | 'inApp' | null
// The permission dialog backgrounds the app and the screen can remount around it (focus refetch, route change),
// so the outcome of the last enable tap lives in the query cache, not only in component state.
const LAST_ENABLE_KEY = ['push', 'lastEnable'] as const
const ENABLING_KEY = ['push', 'enabling'] as const
const ENABLE_FRESH_MS = 60_000
type LastEnable = { result: PushState; at: number }
function useCached<T>(key: readonly unknown[]): T | null | undefined {
  return useQuery({
    queryKey: key,
    queryFn: () => null as T | null,
    enabled: false,
  }).data
}
function freshEnable(value: LastEnable | null | undefined) {
  return value && Date.now() - value.at < ENABLE_FRESH_MS
    ? value.result
    : undefined
}
const pushCopy = {
  default:
    'Nhắc nhở và thông báo hiện trên điện thoại, kể cả khi ứng dụng đang đóng.',
  busy: 'Đang bật thông báo đẩy…',
  DENIED:
    'Bạn đã tắt quyền thông báo cho MentalBridge. Hãy bật lại trong Cài đặt của điện thoại.',
  UNAVAILABLE:
    'Thông báo đẩy tạm thời chưa sẵn sàng. Bạn vẫn xem được thông báo trong ứng dụng.',
  inApp: 'Thông báo đẩy cần bật thông báo trong ứng dụng.',
  masterOff: 'Bật “Nhận thông báo” để dùng thông báo đẩy.',
} as const
function PushRow({
  value,
  disabled,
  line,
  state,
  masterOff,
  change,
}: Readonly<{
  value: boolean
  disabled: boolean
  masterOff: boolean
  line: PushLine
  state: PushState | undefined
  change: (value: boolean) => void
}>) {
  const reduceMotion = useReducedMotion()
  const key =
    line ??
    (masterOff
      ? 'masterOff'
      : state === 'DENIED' || state === 'UNAVAILABLE'
        ? state
        : 'default')
  return (
    <View style={styles.column}>
      <Toggle
        label="Thông báo đẩy"
        value={value}
        disabled={disabled || line === 'busy'}
        change={change}
      />
      <View accessibilityLiveRegion="polite">
        <Animated.View
          key={key}
          {...(reduceMotion ? {} : { entering: FadeIn.duration(160) })}
          style={styles.row}
        >
          {key === 'busy' && (
            <ActivityIndicator size="small" color={colors.teal} />
          )}
          <Text style={[styles.muted, { flex: 1 }]}>{pushCopy[key]}</Text>
        </Animated.View>
      </View>
      {key === 'DENIED' && (
        <NotificationButton
          label="Mở cài đặt"
          onPress={() => void Linking.openSettings()}
        />
      )}
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
  pushApi,
  role,
  onSaved,
  onReconcile,
  authority,
}: Readonly<{
  initial: VersionedPreferences
  api: NotificationApi
  pushApi: PushApi
  role: MobileRole
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
  const queryClient = useQueryClient()
  const [pushLine, setPushLine] = useState<PushLine>(null)
  const [deviceOn, setDeviceOn] = useState(false)
  const lastEnable = useCached<LastEnable>(LAST_ENABLE_KEY)
  const enabling = useCached<boolean>(ENABLING_KEY) === true
  // An enable that finished while this editor was not mounted still turns the draft on.
  const enabledAt =
    freshEnable(lastEnable) === 'ENABLED' ? lastEnable?.at : undefined
  const [appliedAt, setAppliedAt] = useState<number>()
  if (enabledAt && enabledAt !== appliedAt) {
    setAppliedAt(enabledAt)
    setDeviceOn(true)
    setDraft((current) => ({
      ...current,
      channels: { ...current.channels, inApp: true, push: true },
    }))
  }
  // PushBridge writes DENIED here when the system permission was withdrawn.
  const cachedState = useQuery({
    queryKey: PUSH_STATE_KEY,
    queryFn: () => 'OFF' as PushState,
    enabled: false,
  }).data
  // Every PushBridge refresh is the latest word on registration: only ENABLED means this device is registered.
  const [seenState, setSeenState] = useState(cachedState)
  if (cachedState !== seenState) {
    setSeenState(cachedState)
    if (cachedState) setDeviceOn(cachedState === 'ENABLED')
  }
  // The permission dialog and token rotation trigger a PushBridge refresh that writes 'OFF' over the cache
  // while enablePush is in flight, so the outcome of the last tap is kept here and wins over the cache.
  const [enableResult, setEnableResult] = useState<PushState>()
  const recent = freshEnable(lastEnable)
  const pushState =
    enableResult ?? (recent && recent !== 'ENABLED' ? recent : cachedState)
  useEffect(() => {
    void isPushEnabledOnDevice().then((on) => {
      // Only ever raises the flag: a stale false must not undo an enable that finished meanwhile.
      if (on && mounted.current) setDeviceOn(true)
    })
  }, [])
  const pushBusy = pushLine === 'busy' || enabling
  const disabled = busy || !authority
  const changed = JSON.stringify(draft) !== JSON.stringify(initial.preferences)
  const channels =
    role === 'SPECIALIST' ? (['inApp'] as const) : (['inApp', 'email'] as const)
  // No refresh result yet: the SecureStore flag read at mount decides; afterwards only ENABLED counts.
  const pushOn =
    draft.channels.push &&
    deviceOn &&
    (pushState === undefined || pushState === 'ENABLED')
  const changeInApp = (inApp: boolean) => {
    // Turning in-app back on clears the line; turning it off with push on explains why push went off.
    setPushLine(!inApp && pushOn ? 'inApp' : null)
    setDraft({
      ...draft,
      channels: { ...draft.channels, inApp, ...(inApp ? {} : { push: false }) },
    })
  }
  const changePush = async (on: boolean) => {
    setEnableResult(undefined)
    queryClient.setQueryData(LAST_ENABLE_KEY, null)
    if (!on) {
      setPushLine(null)
      setDraft({ ...draft, channels: { ...draft.channels, push: false } })
      return
    }
    setPushLine('busy')
    queryClient.setQueryData(ENABLING_KEY, true)
    const result = await enablePush(pushApi).catch(() => 'UNAVAILABLE' as const)
    queryClient.setQueryData(ENABLING_KEY, false)
    queryClient.setQueryData(PUSH_STATE_KEY, result)
    queryClient.setQueryData(LAST_ENABLE_KEY, { result, at: Date.now() })
    if (!mounted.current) return
    setEnableResult(result === 'ENABLED' ? undefined : result)
    setPushLine(null)
    if (result !== 'ENABLED') return
    setDeviceOn(true)
    // Push fans out from inbox rows, so in-app must be on too.
    setDraft((current) => ({
      ...current,
      channels: { ...current.channels, inApp: true, push: true },
    }))
  }
  const groups =
    role === 'SPECIALIST'
      ? specialistGroups
      : (Object.keys(groupLabels) as (keyof typeof groupLabels)[])
  const save = async () => {
    if (disabled || pushBusy || pending.current || !changed) return
    if (role === 'USER' && !validQuiet(draft)) {
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
        preferencePatch(draft, role),
        initial.etag,
      )
      queryClient.setQueryData(LAST_ENABLE_KEY, null)
      if (!result.preferences.channels.push && deviceOn) {
        await disablePush(pushApi)
        queryClient.setQueryData(PUSH_STATE_KEY, 'OFF')
      }
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
      {channels.map((channel) => (
        <Toggle
          key={channel}
          label={{ inApp: 'Trong ứng dụng', email: 'Email' }[channel]}
          value={draft.channels[channel]}
          disabled={disabled || !draft.notificationsEnabled}
          change={(value) =>
            channel === 'inApp'
              ? changeInApp(value)
              : setDraft({
                  ...draft,
                  channels: { ...draft.channels, [channel]: value },
                })
          }
        />
      ))}
      <PushRow
        value={pushOn}
        disabled={disabled || !draft.notificationsEnabled}
        line={pushBusy ? 'busy' : pushLine}
        masterOff={!draft.notificationsEnabled}
        state={pushState}
        change={(value) => void changePush(value)}
      />
      <Text accessibilityRole="header" style={styles.heading}>
        Nội dung muốn nhận
      </Text>
      {groups.map((group) => (
        <Toggle
          key={group}
          label={
            role === 'SPECIALIST'
              ? specialistGroupLabels[
                  group as (typeof specialistGroups)[number]
                ]
              : groupLabels[group]
          }
          value={draft.contentGroups[group]}
          disabled={disabled || !draft.notificationsEnabled}
          change={(value) =>
            setDraft({
              ...draft,
              contentGroups: { ...draft.contentGroups, [group]: value },
            })
          }
        />
      ))}
      <Text style={styles.muted}>
        Tắt một nhóm áp dụng cho thông báo mới, không xóa lịch sử đã lưu.
      </Text>
      {role === 'USER' && (
        <>
          <Text accessibilityRole="header" style={styles.heading}>
            Giờ yên lặng
          </Text>
          <Toggle
            label="Bật giờ yên lặng"
            value={draft.quietHours.enabled}
            disabled={disabled}
            change={(enabled) =>
              setDraft({
                ...draft,
                quietHours: { ...draft.quietHours, enabled },
              })
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
            Khung giờ có thể đi qua nửa đêm. Hệ thống áp dụng theo múi giờ đã
            lưu.
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
                  disabled ||
                  !draft.notificationsEnabled ||
                  !draft.channels.email
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
                  disabled ||
                  !draft.notificationsEnabled ||
                  !draft.channels.email
                }
                change={(value) =>
                  setDraft({
                    ...draft,
                    email: { ...draft.email, [field]: value },
                  })
                }
              />
            ),
          )}
          {(['dailyDigestTime', 'resourceReminderTime'] as const).map(
            (field) => (
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
                  setDraft({
                    ...draft,
                    email: { ...draft.email, [field]: value },
                  })
                }
              />
            ),
          )}
        </>
      )}
      <PrimaryButton
        label={busy ? 'Đang lưu tùy chọn…' : 'Lưu tùy chọn'}
        disabled={disabled || pushBusy || !changed}
        onPress={() => void save()}
      />
    </View>
  )
}
function AccountPreferences({
  api,
  pushApi,
  subject,
  role,
  onBack,
}: Readonly<{
  api: NotificationApi
  pushApi: PushApi
  subject: string
  role: MobileRole
  onBack: () => void
}>) {
  const client = useQueryClient()
  const key = ['notifications', subject, role, 'preferences'] as const
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.preferences(),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    // Returning from the push permission dialog is a focus event; a refetch would unmount the editor and drop the draft.
    refetchOnWindowFocus: false,
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
          {role === 'SPECIALIST'
            ? 'Tùy chọn thông báo chuyên môn'
            : 'Nhận thông báo theo ý bạn'}
        </Text>
        <Text style={styles.muted}>
          {role === 'SPECIALIST'
            ? 'Chọn các cập nhật về lịch hẹn, tin nhắn và tài khoản chuyên gia.'
            : 'Chọn nội dung, kênh nhận và khoảng thời gian bạn muốn yên lặng.'}
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
            key={`${subject}:${role}:${query.data.etag}`}
            initial={query.data}
            api={api}
            pushApi={pushApi}
            role={role}
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
  props: Omit<
    React.ComponentProps<typeof AccountPreferences>,
    'subject' | 'role'
  >,
) {
  const { session } = useSession()
  if (!session)
    return (
      <Screen>
        <Text style={styles.body}>Đăng nhập để đổi tùy chọn.</Text>
      </Screen>
    )
  return (
    <AccountPreferences
      key={`${session.subject}:${session.role}`}
      {...props}
      subject={session.subject}
      role={session.role}
    />
  )
}
