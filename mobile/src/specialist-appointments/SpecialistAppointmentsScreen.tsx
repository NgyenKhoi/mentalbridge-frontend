import { randomUUID } from 'expo-crypto'
import { router } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { Screen } from '@/components/Screen'
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
  APPOINTMENT_STATUS_LABELS,
  appointmentErrorMessage,
  formatAppointmentRange,
} from './specialist-appointment-ui'

type AuthorityRecovery = 'idle' | 'refreshing' | 'blocked'

const FILTERS: readonly {
  key: AppointmentCollection
  label: string
}[] = [
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
}: Readonly<{ api: SpecialistAppointmentApi }>) {
  const { session } = useSession()
  const queryClient = useQueryClient()
  const subject = session?.subject ?? 'anonymous'
  const queryKey = ['specialist-appointments', subject] as const
  const [filter, setFilter] = useState<AppointmentCollection>('pending')
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
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={styles.back}
      >
        <Text style={styles.backLabel}>← Không gian chuyên gia</Text>
      </Pressable>
      <Text style={styles.eyebrow}>LỊCH TƯ VẤN</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Lịch hẹn được giao cho bạn
      </Text>
      <Text style={styles.description}>
        Phản hồi yêu cầu đang chờ, chuẩn bị cho phiên sắp tới và xem lại lịch sử
        theo trạng thái từ MentalBridge.
      </Text>

      <View accessibilityRole="tablist" style={styles.filters}>
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
              {item.label} · {groups[item.key].length}
            </Text>
          </Pressable>
        ))}
      </View>

      {(appointmentsQuery.isLoading || authorityRecovery === 'refreshing') && (
        <Text accessibilityLiveRegion="polite" style={styles.state}>
          Đang xác nhận lịch hẹn mới nhất…
        </Text>
      )}

      {(appointmentsQuery.isError ||
        authorityRecovery === 'blocked' ||
        assignmentMismatch) && (
        <View style={styles.errorBox}>
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
            <Text style={styles.retryLabel}>Tải lại an toàn</Text>
          </Pressable>
        </View>
      )}

      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}

      {data && !assignmentMismatch && groups[filter].length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.cardTitle}>Chưa có lịch hẹn trong nhóm này</Text>
          <Text style={styles.cardCopy}>
            Bạn có thể chọn nhóm khác hoặc tải lại để xem thay đổi mới nhất.
          </Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {groups[filter].map((appointment) => {
          const decisionEligible = canDecide(appointment, data!.generatedAt)
          return (
            <View key={appointment.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {formatAppointmentRange(appointment)}
                </Text>
                <Text style={styles.badge}>
                  {APPOINTMENT_STATUS_LABELS[appointment.status]}
                </Text>
              </View>
              <Text style={styles.cardCopy}>
                {appointment.modality === 'IN_APP_CHAT'
                  ? 'Tư vấn qua trò chuyện trong ứng dụng'
                  : 'Tư vấn video trong ứng dụng'}
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
              <View style={styles.actions}>
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
              </View>
            </View>
          )
        })}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  back: { minHeight: 44, justifyContent: 'center', marginBottom: spacing.lg },
  backLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    fontWeight: '700',
    lineHeight: typography.headingLineHeight,
    marginBottom: spacing.md,
  },
  description: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.xl,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  filter: {
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
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
    borderColor: colors.terracotta,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  errorText: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  retry: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  retryLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  notice: {
    color: colors.tealDeep,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.lg,
  },
  list: { gap: spacing.lg },
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
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
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
