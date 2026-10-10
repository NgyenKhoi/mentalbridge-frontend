import { useQuery } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { useEffect, useRef, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import type { DiscoveryApi } from '@/discovery/discovery-api'
import { DiscoveryScreen } from '@/discovery/DiscoveryScreen'
import {
  modalityLabels,
  selectedHandoff,
  slotLabel,
  type SlotSelection,
} from '@/discovery/discovery-model'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { AppointmentApi } from './appointment-api'
import type { Appointment, CreditAccount } from './appointment-contract'
import {
  ambiguous,
  appointmentCommands,
  appointmentError,
  appointmentLabel,
  cancellationLabels,
  changeCandidate,
  creditLabels,
  matchesFilter,
  sameSlot,
  sessionLabels,
  statusLabels,
  type AppointmentCommand,
  type AppointmentFilter,
} from './appointment-model'

type Props = Readonly<{
  api: AppointmentApi
  discovery: DiscoveryApi
  onBack: () => void
  initialSelection?: SlotSelection | undefined
}>
type Review =
  | { kind: 'cancel'; appointment: Appointment }
  | {
      kind: 'request'
      selection: SlotSelection
      replacement: Appointment | null
      credits: CreditAccount
    }
function Secondary({
  label,
  onPress,
  disabled = false,
  testID,
}: Readonly<{
  label: string
  onPress: () => void
  disabled?: boolean
  testID?: string
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  )
}
function dateLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}
function AppointmentFacts({ item }: Readonly<{ item: Appointment }>) {
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.subtitle}>
        {item.specialistDisplayName}
      </Text>
      <Text style={styles.body}>
        {dateLabel(item.scheduledStartAt, item.timezone)} –{' '}
        {dateLabel(item.scheduledEndAt, item.timezone)}
      </Text>
      <Text style={styles.muted}>
        {modalityLabels[item.modality]} · 60 phút · {item.timezone}
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.status}>
        {appointmentLabel(item)}
      </Text>
      {item.status === 'REQUESTED' && (
        <Text style={styles.body}>
          Chờ chuyên gia phản hồi đến{' '}
          {dateLabel(item.decisionDeadlineAt, item.timezone)}.
        </Text>
      )}
      {item.sessionOutcome && (
        <Text style={styles.body}>{sessionLabels[item.sessionOutcome]}</Text>
      )}
      <Text style={styles.muted}>{creditLabels[item.creditState]}</Text>
      {item.cancellationCreditOutcome && (
        <Text style={styles.body}>
          {cancellationLabels[item.cancellationCreditOutcome]}
        </Text>
      )}
    </View>
  )
}
function AccountAppointmentsScreen({
  api,
  discovery,
  onBack,
  initialSelection,
  subject,
}: Props & { subject: string }) {
  const list = useQuery({
    queryKey: ['appointments', subject],
    queryFn: () => api.list(),
    retry: false,
    staleTime: 0,
  })
  const credits = useQuery({
    queryKey: ['appointment-credits', subject],
    queryFn: () => api.credits(),
    retry: false,
    staleTime: 0,
  })
  const [filter, setFilter] = useState<AppointmentFilter>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [replacement, setReplacement] = useState<Appointment | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [pending, setPending] = useState(() =>
    appointmentCommands.read(subject),
  )
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const inFlight = useRef(false)
  const sequence = useRef(0)
  const mounted = useRef(true)
  const listRefetch = list.refetch
  const creditRefetch = credits.refetch
  useEffect(() => {
    mounted.current = true
    const subscription = AppState.addEventListener('change', (state) => {
      sequence.current += 1
      setReview(null)
      setChoosing(false)
      if (state === 'active') {
        void listRefetch()
        void creditRefetch()
      }
    })
    return () => {
      mounted.current = false
      sequence.current += 1
      subscription.remove()
    }
  }, [listRefetch, creditRefetch])
  async function refresh() {
    await Promise.all([listRefetch(), creditRefetch()])
  }
  function conflict(code = 'APPOINTMENT_VERSION_MISMATCH'): never {
    throw new ApiError({
      code,
      status: code === 'APPOINTMENT_VERSION_MISMATCH' ? 412 : 409,
      message: 'Fresh appointment facts changed.',
    })
  }
  async function freshAppointment(previous: Appointment) {
    const data = await api.list()
    const current = data.items.find((item) => item.id === previous.id)
    if (
      !current ||
      current.version !== previous.version ||
      !changeCandidate(current, data)
    )
      conflict()
    return current
  }
  async function freshSelection(
    selection: SlotSelection,
    replacing: Appointment | null,
  ) {
    const [page, profile, slots, account] = await Promise.all([
      discovery.list({}),
      discovery.detail(selection.slot.specialistAccountId, {}),
      api.slots(),
      api.credits(),
    ])
    const current = selectedHandoff(profile, selection.slot, page)
    if (
      !current ||
      current.bookingHandoff !== 'BOOKING_POLICY_CHECK_REQUIRED' ||
      !slots.items.some((slot) => sameSlot(selection.slot, slot)) ||
      (selection.slot.modality === 'IN_APP_VIDEO' && !slots.videoEnabled)
    )
      conflict('APPOINTMENT_SLOT_STALE')
    if (replacing) await freshAppointment(replacing)
    else {
      if (account.balance.available === 0)
        conflict('APPOINTMENT_CREDIT_UNAVAILABLE')
      if (account.reservationCapacity.remaining === 0)
        conflict('APPOINTMENT_RESERVATION_LIMIT_REACHED')
    }
    return {
      kind: 'request' as const,
      selection: current,
      replacement: replacing,
      credits: account,
    }
  }
  async function prepare(
    selection: SlotSelection,
    replacing: Appointment | null,
  ) {
    if (inFlight.current || appointmentCommands.read(subject)) return
    inFlight.current = true
    setBusy(true)
    setNotice('')
    setChoosing(false)
    const request = sequence.current
    try {
      const next = await freshSelection(selection, replacing)
      if (request === sequence.current) setReview(next)
    } catch (error) {
      if (request === sequence.current) {
        setReview(null)
        setNotice(appointmentError(error))
        void refresh()
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function prepareCancel(item: Appointment) {
    if (inFlight.current || pending) return
    inFlight.current = true
    setBusy(true)
    setNotice('')
    const request = sequence.current
    try {
      const current = await freshAppointment(item)
      if (request === sequence.current)
        setReview({ kind: 'cancel', appointment: current })
    } catch (error) {
      if (request === sequence.current) {
        setNotice(appointmentError(error))
        void refresh()
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function execute(replay?: AppointmentCommand) {
    if (inFlight.current || (!replay && (!review || pending))) return
    inFlight.current = true
    setBusy(true)
    setNotice('')
    const request = sequence.current
    let command = replay
    try {
      if (!command && review) {
        const key = `appointment-${randomUUID()}`
        if (review.kind === 'cancel') {
          const current = await freshAppointment(review.appointment)
          command = {
            kind: 'cancel',
            id: current.id,
            version: current.version,
            key,
          }
        } else {
          const current = await freshSelection(
            review.selection,
            review.replacement,
          )
          command = {
            kind: 'request',
            key,
            body: {
              slotId: current.selection.slot.id,
              modality: current.selection.slot.modality,
              ...(current.replacement
                ? { replacesAppointmentId: current.replacement.id }
                : {}),
            },
            ...(current.replacement
              ? { version: current.replacement.version }
              : {}),
          }
        }
        if (request !== sequence.current) return
        appointmentCommands.write(subject, command)
        setPending(command)
        setReview(null)
      }
      if (!command) return
      // Explicit replay skips mutable preflight; the owner resolves the original
      // idempotency record before eligibility checks. Never replace its version/key.
      const result =
        command.kind === 'cancel'
          ? await api.cancel(command.id, command.version, command.key)
          : await api.request(command.body, command.key, command.version)
      if (appointmentCommands.read(subject)?.key === command.key)
        appointmentCommands.remove(subject)
      if (request !== sequence.current) return
      setPending(null)
      setReview(null)
      setReplacement(null)
      setDetailId(result.id)
      setNotice(
        command.kind === 'cancel'
          ? 'Đã hủy lịch hẹn.'
          : 'Yêu cầu đã được ghi nhận. Hãy xem trạng thái lịch hẹn bên dưới.',
      )
      await refresh()
    } catch (error) {
      if (request !== sequence.current) return
      if (command && ambiguous(error)) {
        setPending(command)
        setNotice(
          error instanceof ApiError && error.status === 401
            ? appointmentError(error)
            : 'Chưa thể xác nhận kết quả yêu cầu. Hãy kiểm tra lại cùng yêu cầu trước khi thực hiện thao tác khác.',
        )
      } else {
        if (command && appointmentCommands.read(subject)?.key === command.key)
          appointmentCommands.remove(subject)
        setPending(null)
        setReview(null)
        setNotice(appointmentError(error))
        void refresh()
      }
    } finally {
      inFlight.current = false
      if (mounted.current) {
        setBusy(false)
        setPending(appointmentCommands.read(subject))
      }
    }
  }
  const data = !list.isError ? list.data : undefined
  const item = data?.items.find((item) => item.id === detailId)
  const changeAllowed =
    item &&
    data &&
    !list.isFetching &&
    !busy &&
    !pending &&
    changeCandidate(item, data)
  const FindSlotButton =
    initialSelection && !detailId ? Secondary : PrimaryButton
  if (choosing)
    return (
      <DiscoveryScreen
        api={discovery}
        onBack={() => setChoosing(false)}
        onBook={(selection) => void prepare(selection, replacement)}
      />
    )
  return (
    <Screen>
      <View style={styles.stack}>
        <Secondary label="Về trang trước" onPress={onBack} disabled={busy} />
        <Text accessibilityRole="header" style={styles.title}>
          Lịch hẹn của bạn
        </Text>
        <Text style={styles.body}>
          Đặt và quản lý buổi tư vấn. Yêu cầu mới cần được chuyên gia xác nhận.
        </Text>
        {notice !== '' && (
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            {notice}
          </Text>
        )}
        {busy && (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            Đang kiểm tra và xử lý yêu cầu…
          </Text>
        )}
        {pending && (
          <View style={styles.panel}>
            <Text style={styles.body}>
              Kết quả yêu cầu chưa được xác nhận. Kiểm tra lại không tạo một yêu
              cầu mới.
            </Text>
            <PrimaryButton
              label="Kiểm tra lại yêu cầu"
              disabled={busy}
              onPress={() => void execute(pending)}
            />
          </View>
        )}
        <View style={styles.group}>
          <Text accessibilityRole="header" style={styles.subtitle}>
            Lượt tư vấn
          </Text>
          {credits.isPending ? (
            <Text style={styles.body}>Đang tải quyền lợi…</Text>
          ) : credits.isError ? (
            <>
              <Text style={styles.body}>
                Chưa thể tải lượt tư vấn. Lịch hẹn vẫn có thể xem bên dưới.
              </Text>
              <Secondary
                label="Tải lại lượt tư vấn"
                onPress={() => void creditRefetch()}
              />
            </>
          ) : (
            credits.data && (
              <>
                <Text style={styles.body}>
                  Còn {credits.data.balance.available} lượt · đang giữ{' '}
                  {credits.data.balance.held} lượt
                </Text>
                <Text style={styles.muted}>
                  Đã sử dụng {credits.data.balance.consumed} lượt · không hoàn
                  lại {credits.data.balance.forfeited} lượt
                </Text>
                <Text style={styles.body}>
                  Lịch đang giữ: {credits.data.reservationCapacity.active} /{' '}
                  {credits.data.reservationCapacity.maximum} · còn có thể giữ{' '}
                  {credits.data.reservationCapacity.remaining} lịch
                </Text>
                {credits.isFetching && (
                  <Text style={styles.muted}>Đang cập nhật quyền lợi…</Text>
                )}
              </>
            )
          )}
        </View>
        {review ? (
          <View style={styles.panel} testID="appointment-review">
            <Text accessibilityRole="header" style={styles.subtitle}>
              {review.kind === 'cancel'
                ? 'Bạn muốn hủy lịch hẹn?'
                : review.replacement
                  ? 'Xác nhận đổi lịch'
                  : 'Kiểm tra trước khi đặt lịch'}
            </Text>
            {review.kind === 'cancel' ? (
              <>
                <AppointmentFacts item={review.appointment} />
                <Text style={styles.body}>
                  Việc hủy có thể làm lượt tư vấn không được hoàn lại nếu hủy
                  muộn. Kết quả sẽ được hiển thị sau khi xử lý.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.body}>
                  {review.selection.specialist.displayName}
                </Text>
                <Text style={styles.body}>
                  {slotLabel(review.selection.slot)}
                </Text>
                <Text style={styles.body}>
                  {modalityLabels[review.selection.slot.modality]} · 60 phút
                </Text>
                <Text style={styles.body}>
                  Còn {review.credits.balance.available} lượt tư vấn ·{' '}
                  {review.credits.reservationCapacity.remaining} lịch có thể
                  giữ.
                </Text>
                <Text style={styles.muted}>
                  {review.replacement
                    ? 'Chỉ khi yêu cầu mới thành công, lịch cũ mới được thay thế. Lượt tư vấn có thể được chuyển hoặc không hoàn lại; hệ thống sẽ xác định kết quả.'
                    : 'Gửi yêu cầu sẽ giữ khung giờ và lượt tư vấn nếu đủ điều kiện, chưa phải xác nhận của chuyên gia.'}
                </Text>
              </>
            )}
            <Secondary
              label="Giữ nguyên, chưa gửi"
              onPress={() => setReview(null)}
              disabled={busy}
            />
            <PrimaryButton
              label={
                review.kind === 'cancel'
                  ? 'Xác nhận hủy lịch'
                  : review.replacement
                    ? 'Gửi yêu cầu đổi lịch'
                    : 'Gửi yêu cầu đặt lịch'
              }
              testID="appointment-confirm"
              disabled={busy || pending !== null}
              onPress={() => void execute()}
            />
          </View>
        ) : (
          !pending && (
            <>
              {initialSelection && !detailId && (
                <View style={styles.panel}>
                  <Text style={styles.body}>
                    Khung giờ bạn vừa chọn: {slotLabel(initialSelection.slot)}.
                    Chưa gửi yêu cầu hoặc giữ chỗ.
                  </Text>
                  <PrimaryButton
                    label="Kiểm tra giờ đã chọn"
                    disabled={busy}
                    onPress={() => void prepare(initialSelection, null)}
                  />
                </View>
              )}
              <FindSlotButton
                label="Tìm giờ tư vấn"
                disabled={busy}
                onPress={() => {
                  setReplacement(null)
                  setChoosing(true)
                  setNotice('')
                }}
              />
            </>
          )
        )}
        <Secondary
          label="Cập nhật lịch hẹn và quyền lợi"
          onPress={() => {
            setReview(null)
            void refresh()
          }}
          disabled={busy}
        />
        {list.isPending ? (
          <Text style={styles.body}>Đang tải lịch hẹn…</Text>
        ) : list.isError ? (
          <>
            <Text style={styles.body}>{appointmentError(list.error)}</Text>
            <Secondary
              label="Tải lại lịch hẹn"
              onPress={() => void listRefetch()}
            />
          </>
        ) : (
          data && (
            <>
              {list.isFetching && (
                <Text style={styles.muted}>
                  Đang cập nhật lịch hẹn. Hành động thay đổi tạm dừng.
                </Text>
              )}
              {detailId && !item && (
                <Text style={styles.body}>
                  Lịch hẹn này không có trong danh sách hiện tại. Hãy tải lại
                  hoặc chọn lịch khác.
                </Text>
              )}
              {item && (
                <View style={styles.panel} testID="appointment-detail">
                  <Text accessibilityRole="header" style={styles.subtitle}>
                    Chi tiết lịch hẹn
                  </Text>
                  <AppointmentFacts item={item} />
                  {changeAllowed && !review && (
                    <>
                      <Secondary
                        label="Đổi lịch hẹn này"
                        disabled={busy || pending !== null}
                        onPress={() => {
                          setReplacement(item)
                          setChoosing(true)
                        }}
                      />
                      <Secondary
                        label="Hủy lịch hẹn này"
                        disabled={busy || pending !== null}
                        onPress={() => void prepareCancel(item)}
                      />
                    </>
                  )}
                  {item.replacedByAppointmentId && (
                    <>
                      <Text style={styles.body}>
                        Lịch cũ đã được thay thế; giờ hẹn cũ không còn dùng để
                        tham gia phiên.
                      </Text>
                      {data.items.some(
                        (next) => next.id === item.replacedByAppointmentId,
                      ) && (
                        <Secondary
                          label="Xem lịch thay thế"
                          onPress={() => {
                            setReview(null)
                            setDetailId(item.replacedByAppointmentId)
                          }}
                          disabled={busy}
                        />
                      )}
                    </>
                  )}
                  {item.replacesAppointmentId &&
                    data.items.some(
                      (previous) => previous.id === item.replacesAppointmentId,
                    ) && (
                      <Secondary
                        label="Xem lịch trước khi đổi"
                        onPress={() => {
                          setReview(null)
                          setDetailId(item.replacesAppointmentId)
                        }}
                        disabled={busy}
                      />
                    )}
                  {item.status === 'CANCELLED' &&
                    !item.replacedByAppointmentId && (
                      <Text style={styles.body}>
                        Giờ hẹn cũ không còn dùng để tham gia phiên.
                      </Text>
                    )}
                  <Text accessibilityRole="header" style={styles.subtitle}>
                    Lịch sử thay đổi
                  </Text>
                  {item.history.map((event) => (
                    <Text key={event.eventId} style={styles.muted}>
                      {dateLabel(event.occurredAt, item.timezone)} ·{' '}
                      {event.reason === 'USER_RESCHEDULED'
                        ? 'Đã đổi lịch'
                        : statusLabels[event.toStatus]}
                      {event.creditOutcome
                        ? ` · ${cancellationLabels[event.creditOutcome]}`
                        : ''}
                    </Text>
                  ))}
                  <Secondary
                    label="Đóng chi tiết"
                    onPress={() => {
                      setReview(null)
                      setDetailId(null)
                    }}
                    disabled={busy}
                  />
                </View>
              )}
              <Text accessibilityRole="header" style={styles.subtitle}>
                Danh sách lịch hẹn
              </Text>
              <View style={styles.choices}>
                {(
                  [
                    ['all', 'Tất cả'],
                    ['requested', 'Chờ xác nhận'],
                    ['upcoming', 'Sắp tới'],
                    ['history', 'Lịch sử'],
                  ] as const
                ).map(([value, label]) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: filter === value }}
                    onPress={() => setFilter(value)}
                    style={[
                      styles.secondary,
                      filter === value && styles.selected,
                    ]}
                  >
                    <Text style={styles.link}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {!data.items.length ? (
                <Text style={styles.body}>
                  Bạn chưa có lịch hẹn. Hãy tìm giờ tư vấn khi muốn bắt đầu.
                </Text>
              ) : (
                !data.items.some((entry) => matchesFilter(entry, filter)) && (
                  <Text style={styles.body}>
                    Chưa có lịch hẹn trong nhóm này. Hãy chọn nhóm khác.
                  </Text>
                )
              )}
              {data.items
                .filter((entry) => matchesFilter(entry, filter))
                .map((entry) => (
                  <View key={entry.id} style={styles.row}>
                    <AppointmentFacts item={entry} />
                    <Secondary
                      label={`Xem lịch ${entry.specialistDisplayName} · ${dateLabel(entry.scheduledStartAt, entry.timezone)}`}
                      testID="appointment-open-detail"
                      disabled={busy}
                      onPress={() => {
                        setReview(null)
                        setDetailId(entry.id)
                      }}
                    />
                  </View>
                ))}
            </>
          )
        )}
      </View>
    </Screen>
  )
}
export function AppointmentsScreen(props: Props) {
  const { session } = useSession()
  const [initialSubject] = useState(session?.subject)
  if (!session || session.role !== 'USER')
    return (
      <Screen>
        <Text style={styles.body}>
          Vui lòng đăng nhập bằng tài khoản người dùng để xem lịch hẹn.
        </Text>
      </Screen>
    )
  return (
    <AccountAppointmentsScreen
      key={session.subject}
      {...props}
      initialSelection={
        initialSubject === session.subject ? props.initialSelection : undefined
      }
      subject={session.subject}
    />
  )
}
const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  group: { gap: spacing.md },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    lineHeight: typography.headingLineHeight,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.ink,
    fontSize: typography.body + 4,
    fontWeight: '700',
  },
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
  status: {
    color: colors.tealDeep,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    fontWeight: '700',
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  secondary: {
    minHeight: 48,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.control,
  },
  link: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
  selected: { backgroundColor: colors.tealPale },
})
