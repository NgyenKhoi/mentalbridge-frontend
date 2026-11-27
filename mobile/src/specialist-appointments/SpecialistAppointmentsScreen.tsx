import { randomUUID } from 'expo-crypto'
import { router } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { Screen } from '@/components/Screen'
import { SpecialistOverviewTabBar } from '@/navigation/SpecialistOverviewTabBar'
import { TourTarget } from '@/onboarding/tour-target'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type {
  AppointmentDecision,
  SpecialistAppointmentApi,
} from './specialist-appointment-api'
import type {
  SpecialistAppointment,
  SpecialistAppointmentList,
} from './specialist-appointment-contract'
import {
  canDecide,
  groupAppointments,
  type AppointmentCollection,
} from './specialist-appointment-model'
import {
  APPOINTMENT_CREDIT_LABELS,
  APPOINTMENT_STATUS_LABELS,
  appointmentErrorMessage,
  formatAppointmentRange,
} from './specialist-appointment-ui'
import {
  SpecialistAppointmentContent,
  type SpecialistAppointmentContentApis,
} from './SpecialistAppointmentContent'

import {
  SpecialistAgendaFooter,
  SpecialistAgendaHeader,
} from './SpecialistAgendaOverview'

type AuthorityRecovery = 'idle' | 'refreshing' | 'blocked'

const FILTERS: readonly {
  key: AppointmentCollection | 'all'
  label: string
}[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ xác nhận' },
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'history', label: 'Lịch sử' },
]

const AUTHORITY_ERROR_CODES = new Set([
  'APPOINTMENT_VERSION_MISMATCH',
  'APPOINTMENT_NOT_DECISION_ELIGIBLE',
  'APPOINTMENT_DECISION_DEADLINE_PASSED',
  'APPOINTMENT_NOT_FOUND',
  'APPOINTMENT_NOT_ASSIGNED',
])

export function SpecialistAppointmentsScreen({
  api,
  continuityApi,
  summaryApi,
  disputeApi,
}: Readonly<
  { api: SpecialistAppointmentApi } & SpecialistAppointmentContentApis
>) {
  const { session } = useSession()
  const queryClient = useQueryClient()
  const subject = session?.subject ?? 'anonymous'
  const queryKey = ['specialist-appointments', subject] as const
  const [filter, setFilter] = useState<AppointmentCollection | 'all'>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [authorityRecovery, setAuthorityRecovery] =
    useState<AuthorityRecovery>('idle')
  const authorityLockedRef = useRef(false)
  const commandKeys = useRef(new Map<string, string>())

  const appointmentsQuery = useQuery({
    queryKey,
    queryFn: () => api.listAssigned(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })

  const decisionMutation = useMutation({
    mutationFn: (input: {
      appointment: SpecialistAppointment
      decision: AppointmentDecision
      idempotencyKey: string
    }) => api.decide(input.appointment, input.decision, input.idempotencyKey),
  })

  const reconcileAuthority = async () => {
    authorityLockedRef.current = true
    setAuthorityRecovery('refreshing')
    const result = await appointmentsQuery.refetch()
    if (
      result.isError ||
      !result.data ||
      result.data.items.some((item) => item.specialistAccountId !== subject)
    ) {
      setAuthorityRecovery('blocked')
      return false
    }
    setAuthorityRecovery('idle')
    authorityLockedRef.current = false
    return true
  }

  const data = appointmentsQuery.data
  const assignmentMismatch = Boolean(
    data?.items.some((item) => item.specialistAccountId !== subject),
  )
  const groups = useMemo(
    () =>
      data && !assignmentMismatch
        ? groupAppointments(data.items, data.generatedAt)
        : { pending: [], upcoming: [], history: [] },
    [assignmentMismatch, data],
  )
  const all = [...groups.pending, ...groups.upcoming, ...groups.history]
  const collection = filter === 'all' ? all : groups[filter]
  const term = search.trim().toLocaleLowerCase('vi-VN')
  const visible = term
    ? collection.filter((item) =>
        [
          formatAppointmentRange(item),
          APPOINTMENT_STATUS_LABELS[item.status],
          item.id,
        ].some((field) => field.toLocaleLowerCase('vi-VN').includes(term)),
      )
    : collection
  const loadFailed =
    appointmentsQuery.isError ||
    authorityRecovery === 'blocked' ||
    assignmentMismatch
  const agenda = !loadFailed ? data : undefined
  const authorityConfirmed =
    appointmentsQuery.isSuccess &&
    !appointmentsQuery.isFetching &&
    !assignmentMismatch &&
    authorityRecovery === 'idle'
  const governedBusy = !authorityConfirmed || decisionMutation.isPending

  const decide = async (
    appointment: SpecialistAppointment,
    decision: AppointmentDecision,
  ) => {
    if (
      governedBusy ||
      authorityLockedRef.current ||
      appointment.specialistAccountId !== subject ||
      !data ||
      !canDecide(appointment, data.generatedAt)
    )
      return
    const signature = `${appointment.id}:${appointment.version}:${decision}`
    const idempotencyKey = commandKeys.current.get(signature) ?? randomUUID()
    commandKeys.current.set(signature, idempotencyKey)
    setNotice('')
    try {
      const updated = await decisionMutation.mutateAsync({
        appointment,
        decision,
        idempotencyKey,
      })
      queryClient.setQueryData<SpecialistAppointmentList>(
        queryKey,
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              }
            : current,
      )
      const reconciled = await reconcileAuthority()
      if (reconciled) commandKeys.current.delete(signature)
      setNotice(
        decision === 'accept'
          ? 'Đã xác nhận lịch hẹn theo trạng thái mới nhất.'
          : 'Đã từ chối yêu cầu lịch hẹn.',
      )
    } catch (error) {
      const authorityChanged =
        error instanceof ApiError &&
        (error.status === 409 ||
          error.status === 412 ||
          AUTHORITY_ERROR_CODES.has(error.code))
      if (authorityChanged) {
        await reconcileAuthority()
      }
      if (
        error instanceof ApiError &&
        error.code === 'IDEMPOTENCY_KEY_REUSED'
      ) {
        commandKeys.current.delete(signature)
      }
      setNotice(appointmentErrorMessage(error))
    }
  }

  return (
    <Screen
      layout="dashboard"
      backgroundColor="#F8F8F2"
      bottomActions={<SpecialistOverviewTabBar onAppointments />}
    >
      <SpecialistAgendaHeader
        data={agenda}
        next={agenda ? groups.upcoming[0] : undefined}
        refreshing={appointmentsQuery.isFetching}
        onRefresh={() => void reconcileAuthority()}
        onSearch={() => {
          if (searchOpen) setSearch('')
          setSearchOpen(!searchOpen)
        }}
      />
      {searchOpen && (
        <TextInput
          accessibilityLabel="Tìm theo ngày giờ, trạng thái hoặc mã lịch"
          placeholder="Tìm theo ngày, trạng thái hoặc mã lịch…"
          value={search}
          onChangeText={setSearch}
          autoFocus
          style={styles.search}
        />
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityRole="tablist"
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((item) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === item.key }}
            key={item.key}
            onPress={() => setFilter(item.key)}
            style={[
              styles.filter,
              filter === item.key && styles.filterSelected,
            ]}
          >
            <Text
              style={[
                styles.filterLabel,
                filter === item.key && styles.filterLabelSelected,
              ]}
            >
              {item.label} ·{' '}
              {agenda
                ? item.key === 'all'
                  ? all.length
                  : groups[item.key].length
                : '—'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <TourTarget
        id={!visible.length ? 'specialist-appointment-actions' : undefined}
        route="/appointments"
        title="Danh sách lịch hẹn"
        description="Các lịch hẹn và thao tác sẽ xuất hiện tại đây khi danh sách tải thành công. Khi chưa có lịch trong nhóm đang chọn, bạn có thể đổi nhóm hoặc tải lại."
        style={styles.toolbar}
      >
        <Text style={styles.toolbarText}>
          Danh sách yêu cầu{agenda ? ` (${visible.length})` : ''}
        </Text>
        {(filter === 'all' || filter === 'pending') && (
          <Text style={styles.toolbarText}>Ưu tiên: Sắp hết hạn trước</Text>
        )}
      </TourTarget>

      {(appointmentsQuery.isLoading || authorityRecovery === 'refreshing') && (
        <Text accessibilityLiveRegion="polite" style={styles.state}>
          Đang xác nhận lịch hẹn mới nhất…
        </Text>
      )}

      {(appointmentsQuery.isError ||
        authorityRecovery === 'blocked' ||
        assignmentMismatch) && (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon} aria-hidden>
            ↻
          </Text>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Chưa thể tải lịch hẹn
          </Text>
          <Text accessibilityRole="alert" style={styles.errorText}>
            {assignmentMismatch
              ? 'Dữ liệu lịch hẹn không khớp với chuyên gia đang đăng nhập. Nội dung và thao tác đã được khóa.'
              : authorityRecovery === 'blocked'
                ? 'Chưa thể xác nhận trạng thái mới nhất. Các thao tác đang được khóa để tránh xử lý từ dữ liệu cũ.'
                : `${appointmentErrorMessage(appointmentsQuery.error)} Các thao tác đang được khóa cho đến khi tải lại thành công.`}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={authorityRecovery === 'refreshing'}
            onPress={() => void reconcileAuthority()}
            style={styles.retry}
          >
            <Text style={styles.retryLabel}>⟳ Thử lại</Text>
          </Pressable>
        </View>
      )}

      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}

      {agenda && visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.cardTitle}>Chưa có lịch hẹn trong nhóm này</Text>
          <Text style={styles.cardCopy}>
            Bạn có thể chọn nhóm khác hoặc tải lại để xem thay đổi mới nhất.
          </Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {visible.map((appointment, appointmentIndex) => {
          const decisionEligible = canDecide(appointment, data!.generatedAt)
          return (
            <View key={appointment.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {formatAppointmentRange(appointment)}
                </Text>
                <Text
                  style={[
                    styles.badge,
                    ['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status) &&
                      styles.activeBadge,
                    ['REJECTED', 'EXPIRED', 'CANCELLED'].includes(
                      appointment.status,
                    ) && styles.closedBadge,
                  ]}
                >
                  {APPOINTMENT_STATUS_LABELS[appointment.status]}
                </Text>
              </View>
              <Text style={styles.cardCopy}>
                {appointment.modality === 'IN_APP_CHAT'
                  ? 'Chat trong ứng dụng'
                  : 'Video trong ứng dụng'}
              </Text>
              <Text style={styles.cardCopy}>
                Thân chủ: Người đặt lịch ·{' '}
                {APPOINTMENT_CREDIT_LABELS[appointment.creditState]}
              </Text>
              {appointment.status === 'REQUESTED' ? (
                <Text style={styles.deadline}>
                  Cần phản hồi trước{' '}
                  {new Intl.DateTimeFormat('vi-VN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: appointment.timezone,
                  }).format(new Date(appointment.decisionDeadlineAt))}
                </Text>
              ) : null}
              <TourTarget
                id={
                  appointmentIndex === 0
                    ? 'specialist-appointment-actions'
                    : undefined
                }
                route="/appointments"
                style={styles.actions}
              >
                {appointment.modality === 'IN_APP_CHAT' &&
                  (['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status) ||
                    appointment.history.some(
                      (event) => event.toStatus === 'CONFIRMED',
                    )) && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: '/(specialist)/messages',
                          params: { appointmentId: appointment.id },
                        })
                      }
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryLabel}>Mở tin nhắn</Text>
                    </Pressable>
                  )}
                {appointment.modality === 'IN_APP_VIDEO' &&
                  [
                    'CONFIRMED',
                    'IN_PROGRESS',
                    'SESSION_ENDED',
                    'COMPLETED',
                  ].includes(appointment.status) && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname:
                            '/(specialist)/appointments/[appointmentId]',
                          params: {
                            appointmentId: appointment.id,
                            view: 'video',
                          },
                        })
                      }
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryLabel}>
                        {['CONFIRMED', 'IN_PROGRESS'].includes(
                          appointment.status,
                        )
                          ? 'Mở phòng tư vấn'
                          : 'Xem phiên tư vấn video'}
                      </Text>
                    </Pressable>
                  )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/(specialist)/appointments/[appointmentId]',
                      params: { appointmentId: appointment.id },
                    })
                  }
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryLabel}>Xem chi tiết</Text>
                </Pressable>
                {decisionEligible ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: governedBusy }}
                      disabled={governedBusy}
                      onPress={() => void decide(appointment, 'accept')}
                      style={[
                        styles.primaryButton,
                        governedBusy && styles.disabled,
                      ]}
                    >
                      <Text style={styles.primaryLabel}>Xác nhận</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: governedBusy }}
                      disabled={governedBusy}
                      onPress={() => void decide(appointment, 'reject')}
                      style={[
                        styles.rejectButton,
                        governedBusy && styles.disabled,
                      ]}
                    >
                      <Text style={styles.rejectLabel}>Từ chối</Text>
                    </Pressable>
                  </>
                ) : null}
              </TourTarget>
              <SpecialistAppointmentContent
                appointment={appointment}
                subject={subject}
                serverNow={data!.generatedAt}
                authorityConfirmed={authorityConfirmed}
                refreshAuthority={reconcileAuthority}
                continuityApi={continuityApi}
                summaryApi={summaryApi}
                disputeApi={disputeApi}
              />
            </View>
          )
        })}
      </View>
      <SpecialistAgendaFooter />
    </Screen>
  )
}

const styles = StyleSheet.create({
  errorIcon: {
    color: '#A33B3C',
    fontSize: 24,
    backgroundColor: '#FAE5E1',
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  search: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    color: colors.ink,
    minHeight: 44,
    marginTop: 12,
    paddingHorizontal: 13,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  toolbarText: { color: colors.inkSoft, fontSize: 12 },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  filter: {
    backgroundColor: '#F0F2ED',
    borderRadius: radii.pill,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  filterSelected: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
  },
  filterLabel: { color: colors.tealDeep, fontSize: 14, fontWeight: '700' },
  filterLabelSelected: { color: colors.white },
  state: {
    color: colors.inkSoft,
    fontSize: typography.body,
    marginBottom: spacing.lg,
  },
  errorBox: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: 23,
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    color: colors.inkSoft,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#143831',
    borderRadius: 22,
    paddingHorizontal: 23,
  },
  retryLabel: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: '700',
  },
  notice: {
    color: colors.tealDeep,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.lg,
  },
  list: { gap: spacing.lg, marginBottom: spacing.lg },
  empty: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.panel,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  cardHeader: { gap: spacing.sm },
  cardTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FD',
    borderRadius: radii.pill,
    color: '#59636E',
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  activeBadge: { backgroundColor: '#DCF4E9', color: '#1F5C3F' },
  closedBadge: { backgroundColor: '#FDE3DF', color: '#A63848' },
  cardCopy: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  deadline: { color: colors.terracotta, fontSize: 14, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  secondaryButton: {
    borderColor: colors.tealDeep,
    borderRadius: radii.control,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryLabel: { color: colors.tealDeep, fontSize: 15, fontWeight: '700' },
  primaryButton: {
    backgroundColor: colors.tealDeep,
    borderRadius: radii.control,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryLabel: { color: colors.white, fontSize: 15, fontWeight: '700' },
  rejectButton: {
    borderRadius: radii.control,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  rejectLabel: { color: colors.terracotta, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
})
