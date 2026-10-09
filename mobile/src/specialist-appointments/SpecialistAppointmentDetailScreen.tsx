import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useSession } from '@/auth/session-context'
import { Screen } from '@/components/Screen'
import type { SpecialistContinuityApi } from '@/specialist-continuity/specialist-continuity-api'
import { SpecialistContinuityPanel } from '@/specialist-continuity/SpecialistContinuityPanel'
import type { SpecialistSummaryApi } from '@/specialist-summary/specialist-summary-api'
import { SpecialistSummaryPanel } from '@/specialist-summary/SpecialistSummaryPanel'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { SpecialistAppointmentApi } from './specialist-appointment-api'
import {
  canPublishSummary,
  canReadContinuity,
} from './specialist-appointment-model'
import {
  APPOINTMENT_STATUS_LABELS,
  appointmentErrorMessage,
  formatAppointmentRange,
} from './specialist-appointment-ui'
import type { SpecialistChatHandoff } from './specialist-chat-handoff'

const HISTORY_LABELS: Record<string, string> = {
  APPOINTMENT_REQUESTED: 'Yêu cầu được tạo',
  USER_CANCELLED: 'Người dùng đã hủy',
  USER_RESCHEDULED: 'Người dùng đã đổi lịch',
  SPECIALIST_ACCEPTED: 'Bạn đã xác nhận',
  SPECIALIST_REJECTED: 'Bạn đã từ chối',
  DECISION_DEADLINE_EXPIRED: 'Yêu cầu đã hết hạn',
  SPECIALIST_SUSPENDED: 'Lịch hẹn bị hủy do trạng thái tài khoản',
  SESSION_ACTIVITY_OBSERVED: 'Phiên đã ghi nhận hoạt động',
  SCHEDULED_WINDOW_ENDED: 'Khung giờ tư vấn đã kết thúc',
  EVIDENCE_REQUIREMENTS_MET: 'Phiên đã được xác nhận hoàn thành',
}

export function SpecialistAppointmentDetailScreen({
  appointmentApi,
  appointmentId,
  chatHandoff,
  continuityApi,
  summaryApi,
}: Readonly<{
  appointmentApi: SpecialistAppointmentApi
  appointmentId: string
  chatHandoff: SpecialistChatHandoff
  continuityApi: SpecialistContinuityApi
  summaryApi: SpecialistSummaryApi
}>) {
  const { session } = useSession()
  const queryKey = [
    'specialist-appointments',
    session?.subject ?? 'anonymous',
  ] as const
  const appointmentsQuery = useQuery({
    queryKey,
    queryFn: () => appointmentApi.listAssigned(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
  const appointment = appointmentsQuery.data?.items.find(
    (item) =>
      item.id === appointmentId &&
      item.specialistAccountId === session?.subject,
  )
  const authorityConfirmed =
    appointmentsQuery.isSuccess && !appointmentsQuery.isFetching

  const refreshAuthority = async () => {
    const result = await appointmentsQuery.refetch()
    return result.isSuccess && Boolean(result.data)
  }

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={styles.back}
      >
        <Text style={styles.backLabel}>← Danh sách lịch hẹn</Text>
      </Pressable>
      <Text style={styles.eyebrow}>CHI TIẾT LỊCH HẸN</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Chuẩn bị và tiếp nối phiên tư vấn
      </Text>

      {appointmentsQuery.isFetching ? (
        <Text accessibilityLiveRegion="polite" style={styles.state}>
          Đang xác nhận lịch hẹn mới nhất…
        </Text>
      ) : null}
      {appointmentsQuery.isError ? (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.copy}>
            {appointmentErrorMessage(appointmentsQuery.error)} Mọi thao tác và
            nội dung riêng tư đang được khóa.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refreshAuthority()}
            style={styles.linkButton}
          >
            <Text style={styles.linkLabel}>Tải lại an toàn</Text>
          </Pressable>
        </View>
      ) : null}

      {appointmentsQuery.isSuccess && !appointment ? (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.copy}>
            Lịch hẹn không còn trong danh sách được giao cho bạn.
          </Text>
        </View>
      ) : null}

      {appointment ? (
        <>
          <View style={styles.overview}>
            <Text style={styles.range}>
              {formatAppointmentRange(appointment)}
            </Text>
            <Text style={styles.badge}>
              {APPOINTMENT_STATUS_LABELS[appointment.status]}
            </Text>
            <Text style={styles.copy}>
              {appointment.modality === 'IN_APP_CHAT'
                ? 'Tư vấn qua trò chuyện trong ứng dụng'
                : 'Tư vấn video trong ứng dụng'}
            </Text>
          </View>

          {appointment.modality === 'IN_APP_CHAT' &&
          ['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status) ? (
            <View style={styles.chatPanel}>
              <Text style={styles.sectionTitle}>Trò chuyện của lịch hẹn</Text>
              <Text style={styles.copy}>
                Cuộc trò chuyện dùng chung sẽ giữ đúng phạm vi của lịch hẹn này.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !chatHandoff.available }}
                disabled={!chatHandoff.available}
                onPress={() => chatHandoff.openAppointmentChat(appointment.id)}
                style={[
                  styles.primaryButton,
                  !chatHandoff.available && styles.disabled,
                ]}
              >
                <Text style={styles.primaryLabel}>Mở trò chuyện tư vấn</Text>
              </Pressable>
              {!chatHandoff.available ? (
                <Text style={styles.footnote}>
                  Trò chuyện chưa khả dụng trong phiên bản ứng dụng này.
                </Text>
              ) : null}
            </View>
          ) : null}

          {authorityConfirmed && canReadContinuity(appointment) ? (
            <SpecialistContinuityPanel
              api={continuityApi}
              appointmentId={appointment.id}
              appointmentVersion={appointment.version}
            />
          ) : null}

          {authorityConfirmed && canPublishSummary(appointment) ? (
            <SpecialistSummaryPanel
              api={summaryApi}
              appointmentAuthorityConfirmed={authorityConfirmed}
              appointmentId={appointment.id}
              refreshAppointmentAuthority={refreshAuthority}
            />
          ) : authorityConfirmed ? (
            <View style={styles.readOnlyPanel}>
              <Text style={styles.sectionTitle}>Tóm tắt sau phiên</Text>
              <Text style={styles.copy}>
                {appointment.status === 'COMPLETED'
                  ? 'Hệ thống chưa cung cấp bằng chứng hoàn thành cần thiết để tạo tóm tắt. Hãy tải lại trạng thái trước khi tiếp tục.'
                  : 'Tóm tắt chỉ được tạo sau khi hệ thống xác nhận phiên đã hoàn thành. Ứng dụng không tự kết thúc lịch hẹn.'}
              </Text>
            </View>
          ) : null}

          <View style={styles.historyPanel}>
            <Text style={styles.sectionTitle}>Lịch sử trạng thái</Text>
            {appointment.history.length === 0 ? (
              <Text style={styles.state}>
                Chưa có thay đổi trạng thái để hiển thị.
              </Text>
            ) : (
              appointment.history.map((event) => (
                <View key={event.eventId} style={styles.historyRow}>
                  <Text style={styles.historyTitle}>
                    {HISTORY_LABELS[event.reason] ?? 'Trạng thái được cập nhật'}
                  </Text>
                  <Text style={styles.footnote}>
                    {new Intl.DateTimeFormat('vi-VN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: appointment.timezone,
                    }).format(new Date(event.occurredAt))}
                  </Text>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
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
    marginBottom: spacing.xl,
  },
  state: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  copy: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
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
  linkButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  overview: {
    backgroundColor: colors.tealDeep,
    borderRadius: radii.shell,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.xl,
  },
  range: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 29,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 13,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chatPanel: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.panel,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.xl,
  },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealDeep,
    borderRadius: radii.control,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  primaryLabel: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: '700',
  },
  disabled: { opacity: 0.5 },
  footnote: { color: colors.inkFaint, fontSize: 13, lineHeight: 19 },
  readOnlyPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.xl,
  },
  historyPanel: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
  },
  historyRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  historyTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
})
