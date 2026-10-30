import { randomUUID } from 'expo-crypto'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import type { Appointment } from '@/appointments/appointment-contract'
import { PrimaryButton } from '@/components/PrimaryButton'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { AppointmentDisputeApi } from './appointment-dispute-api'
import type {
  AppointmentDispute,
  OpenAppointmentDispute,
} from './appointment-dispute-contract'
import {
  ambiguousDisputeFailure,
  appointmentDisputeCommands,
  type AppointmentDisputeCommand,
} from './appointment-dispute-model'

type ReasonCode = OpenAppointmentDispute['reasonCode']

export const appointmentDisputeReasonOptions: readonly {
  value: ReasonCode
  label: string
}[] = [
  { value: 'OUTCOME_INCORRECT', label: 'Kết quả phiên chưa chính xác' },
  {
    value: 'PARTICIPATION_EVIDENCE_INCORRECT',
    label: 'Thông tin tham gia chưa chính xác',
  },
  {
    value: 'SESSION_DELIVERY_NOT_RECOGNIZED',
    label: 'Tôi không nhận ra phiên tư vấn này',
  },
  { value: 'TECHNICAL_FAILURE', label: 'Phiên gặp sự cố kỹ thuật' },
]

function reasonLabel(value: ReasonCode) {
  return (
    appointmentDisputeReasonOptions.find((option) => option.value === value)
      ?.label ?? 'Lý do vận hành đã ghi nhận'
  )
}

function dateLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

function readErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.'
    if (error.status === 403)
      return 'Không thể xem yêu cầu của lịch hẹn này. Hãy tải lại lịch hẹn.'
  }
  return 'Chưa thể tải trạng thái yêu cầu. Hãy kiểm tra kết nối và thử lại.'
}

function unavailableCopy(error: ApiError) {
  if (error.code === 'APPOINTMENT_DISPUTE_WINDOW_EXPIRED')
    return 'Thời hạn 24 giờ để mở yêu cầu mới đã kết thúc.'
  if (error.code === 'APPOINTMENT_DISPUTE_NOT_ELIGIBLE')
    return 'Kết quả phiên này hiện không đủ điều kiện để mở yêu cầu xem xét.'
  if (error.code === 'APPOINTMENT_DISPUTE_ALREADY_EXISTS')
    return 'Lịch hẹn này đã có một yêu cầu xem xét. Hãy tải trạng thái đã ghi nhận.'
  if (error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại trước khi tiếp tục.'
  if (error.status === 403 || error.status === 404)
    return 'Không thể mở yêu cầu cho lịch hẹn này. Hãy tải lại lịch hẹn.'
  return ''
}

function resolutionTitle(dispute: AppointmentDispute) {
  return dispute.resolutionOutcome === 'RELEASE_USER_CREDIT'
    ? 'Đã trả lại lượt tư vấn'
    : 'Đã giữ nguyên kết quả phiên'
}

function ActionButton({
  disabled = false,
  label,
  onPress,
  testID,
}: Readonly<{
  disabled?: boolean
  label: string
  onPress: () => void
  testID?: string
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      testID={testID}
    >
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  )
}

export function AppointmentDisputePanel({
  api,
  appointment,
  serverNow,
  subject,
}: Readonly<{
  api: AppointmentDisputeApi
  appointment: Pick<
    Appointment,
    'id' | 'sessionOutcome' | 'sessionSettledAt' | 'status' | 'timezone'
  >
  serverNow: string
  subject: string
}>) {
  const scope = `${subject}:${appointment.id}`
  const sequence = useRef(0)
  const mounted = useRef(true)
  const inFlight = useRef(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [readError, setReadError] = useState('')
  const [notice, setNotice] = useState('')
  const [unavailable, setUnavailable] = useState('')
  const [deferred, setDeferred] = useState(false)
  const [dispute, setDispute] = useState<AppointmentDispute | null>(null)
  const [reason, setReason] = useState<ReasonCode | null>(null)
  const [pending, setPending] = useState<AppointmentDisputeCommand | null>(() =>
    appointmentDisputeCommands.read(scope),
  )

  const load = useCallback(
    async (clearUnavailable = true) => {
      const request = ++sequence.current
      setLoading(true)
      setReadError('')
      setDispute(null)
      if (clearUnavailable) setUnavailable('')
      try {
        const current = await api.get(appointment.id)
        if (!mounted.current || request !== sequence.current) return
        appointmentDisputeCommands.remove(scope)
        setPending(null)
        setReason(null)
        setDeferred(false)
        setUnavailable('')
        setNotice('')
        setDispute(current)
      } catch (error) {
        if (!mounted.current || request !== sequence.current) return
        if (error instanceof ApiError && error.status === 404) {
          setDispute(null)
        } else {
          setReadError(readErrorCopy(error))
        }
      } finally {
        if (mounted.current && request === sequence.current) setLoading(false)
      }
    },
    [api, appointment.id, scope],
  )

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    void Promise.resolve().then(() => {
      if (!cancelled) return load()
    })
    return () => {
      cancelled = true
      mounted.current = false
      sequence.current += 1
    }
  }, [load])

  const eligibleUntil = useMemo(() => {
    if (!appointment.sessionSettledAt) return null
    return new Date(
      Date.parse(appointment.sessionSettledAt) + 24 * 60 * 60 * 1000,
    ).toISOString()
  }, [appointment.sessionSettledAt])
  const locallyEligible = Boolean(
    appointment.sessionOutcome &&
    appointment.sessionSettledAt &&
    ['SESSION_ENDED', 'COMPLETED'].includes(appointment.status) &&
    Date.parse(serverNow) >= Date.parse(appointment.sessionSettledAt) &&
    eligibleUntil &&
    Date.parse(serverNow) <= Date.parse(eligibleUntil),
  )

  async function submit(replay?: AppointmentDisputeCommand) {
    if (inFlight.current || loading || readError || dispute || unavailable)
      return
    let command = replay ?? pending
    if (!command) {
      if (!reason || !locallyEligible) return
      command = {
        appointmentId: appointment.id,
        body: {
          reasonCode: reason,
          evidenceType: null,
          evidenceOccurredAt: null,
        },
        key: `appointment-dispute-${randomUUID()}`,
      }
      appointmentDisputeCommands.write(scope, command)
      setPending(command)
    }
    inFlight.current = true
    setBusy(true)
    setNotice('')
    const request = sequence.current
    try {
      const current = await api.open(
        command.appointmentId,
        command.body,
        command.key,
      )
      if (!mounted.current || request !== sequence.current) return
      appointmentDisputeCommands.remove(scope)
      setPending(null)
      setReason(null)
      setDispute(current)
    } catch (error) {
      if (!mounted.current || request !== sequence.current) return
      if (ambiguousDisputeFailure(error)) {
        setPending(command)
        setNotice(
          'Chưa thể xác nhận kết quả yêu cầu. Hãy kiểm tra lại cùng yêu cầu; thao tác này không tạo yêu cầu mới.',
        )
      } else {
        appointmentDisputeCommands.remove(scope)
        setPending(null)
        if (error instanceof ApiError) {
          const blocked = unavailableCopy(error)
          if (blocked) {
            setUnavailable(blocked)
            setReason(null)
            if (error.code === 'APPOINTMENT_DISPUTE_ALREADY_EXISTS')
              await load(false)
          } else if (error.code === 'IDEMPOTENCY_KEY_REUSED') {
            setNotice(
              'Yêu cầu trước không còn khớp với lựa chọn này. Trạng thái máy chủ đã được tải lại; hãy kiểm tra trước khi gửi lại.',
            )
            await load(false)
          } else {
            setNotice(
              'Máy chủ chưa chấp nhận yêu cầu. Hãy tải lại trạng thái trước khi thử tiếp.',
            )
          }
        } else {
          setNotice(
            'Máy chủ chưa chấp nhận yêu cầu. Hãy tải lại trạng thái trước khi thử tiếp.',
          )
        }
      }
    } finally {
      inFlight.current = false
      if (mounted.current && request === sequence.current) setBusy(false)
    }
  }

  return (
    <View style={styles.panel} testID="appointment-dispute-panel">
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>QUYỀN LỢI NGƯỜI DÙNG</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Yêu cầu xem xét kết quả phiên
        </Text>
        <Text style={styles.body}>
          MentalBridge chỉ rà soát dữ kiện vận hành đã được hệ thống ghi nhận.
          Mỗi lịch hẹn chỉ có một yêu cầu.
        </Text>
      </View>

      {loading ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          Đang tải trạng thái yêu cầu…
        </Text>
      ) : null}

      {!loading && readError ? (
        <View style={styles.stateBox}>
          <Text accessibilityRole="alert" style={styles.error}>
            {readError}
          </Text>
          <ActionButton
            disabled={busy}
            label="Tải lại trạng thái yêu cầu"
            onPress={() => void load()}
            testID="appointment-dispute-reload"
          />
        </View>
      ) : null}

      {!loading && !readError && dispute ? (
        <View style={styles.stateBox} testID="appointment-dispute-status">
          <Text style={styles.meta}>
            {dispute.status === 'OPEN' ? 'ĐANG XEM XÉT' : 'ĐÃ GIẢI QUYẾT'}
          </Text>
          <Text accessibilityRole="header" style={styles.subtitle}>
            {dispute.status === 'OPEN'
              ? 'Yêu cầu đang được xem xét'
              : resolutionTitle(dispute)}
          </Text>
          <Text style={styles.body}>
            Lý do: {reasonLabel(dispute.reasonCode)}
          </Text>
          {dispute.status === 'OPEN' ? (
            <>
              <Text style={styles.hint}>
                Yêu cầu do máy chủ xác nhận lúc{' '}
                {dateLabel(dispute.openedAt, appointment.timezone)}. Kết quả sẽ
                xuất hiện tại đây sau khi hoàn tất rà soát.
              </Text>
              <ActionButton
                disabled={busy}
                label="Cập nhật trạng thái yêu cầu"
                onPress={() => void load()}
              />
            </>
          ) : (
            <Text style={styles.hint}>
              Đây là kết quả quyền lợi tư vấn do máy chủ xác nhận, không phải
              cam kết hoàn tiền hoặc thanh toán.
            </Text>
          )}
        </View>
      ) : null}

      {!loading && !readError && !dispute && unavailable ? (
        <View style={styles.stateBox} testID="appointment-dispute-unavailable">
          <Text accessibilityRole="header" style={styles.subtitle}>
            Không thể mở yêu cầu mới
          </Text>
          <Text style={styles.body}>{unavailable}</Text>
          <ActionButton
            disabled={busy}
            label="Tải lại trạng thái yêu cầu"
            onPress={() => void load(false)}
          />
        </View>
      ) : null}

      {!loading && !readError && !dispute && !unavailable && pending ? (
        <View style={styles.stateBox} testID="appointment-dispute-pending">
          <Text accessibilityRole="header" style={styles.subtitle}>
            Kết quả yêu cầu chưa được xác nhận
          </Text>
          <Text style={styles.body}>
            Lý do: {reasonLabel(pending.body.reasonCode)}
          </Text>
          {notice ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {notice}
            </Text>
          ) : null}
          <PrimaryButton
            disabled={busy}
            label="Kiểm tra lại cùng yêu cầu"
            onPress={() => void submit(pending)}
            testID="appointment-dispute-retry"
          />
        </View>
      ) : null}

      {!loading &&
      !readError &&
      !dispute &&
      !unavailable &&
      !pending &&
      !locallyEligible ? (
        <View style={styles.stateBox} testID="appointment-dispute-expired">
          <Text accessibilityRole="header" style={styles.subtitle}>
            Đã hết thời hạn gửi yêu cầu
          </Text>
          <Text style={styles.body}>
            Thời hạn mở yêu cầu là 24 giờ sau khi phiên được quyết toán. Yêu cầu
            đã tồn tại, nếu có, vẫn được hiển thị sau thời hạn này.
          </Text>
          <ActionButton
            disabled={busy}
            label="Tải lại trạng thái yêu cầu"
            onPress={() => void load()}
          />
        </View>
      ) : null}

      {!loading &&
      !readError &&
      !dispute &&
      !unavailable &&
      !pending &&
      locallyEligible &&
      deferred ? (
        <View style={styles.stateBox} testID="appointment-dispute-deferred">
          <Text style={styles.body}>
            Chưa có yêu cầu nào được gửi. Bạn có thể quay lại trước khi hết thời
            hạn 24 giờ.
          </Text>
          <ActionButton
            disabled={busy}
            label="Chọn lý do xem xét"
            onPress={() => setDeferred(false)}
          />
        </View>
      ) : null}

      {!loading &&
      !readError &&
      !dispute &&
      !unavailable &&
      !pending &&
      locallyEligible &&
      !deferred ? (
        <View style={styles.form}>
          {eligibleUntil ? (
            <Text style={styles.deadline}>
              Có thể gửi đến {dateLabel(eligibleUntil, appointment.timezone)}
            </Text>
          ) : null}
          <Text style={styles.label}>Chọn lý do phù hợp nhất</Text>
          <View accessibilityRole="radiogroup" style={styles.reasons}>
            {appointmentDisputeReasonOptions.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{
                  disabled: busy,
                  selected: reason === option.value,
                }}
                disabled={busy}
                onPress={() => {
                  setNotice('')
                  setReason(option.value)
                }}
                style={({ pressed }) => [
                  styles.reason,
                  reason === option.value && styles.reasonSelected,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    reason === option.value && styles.radioSelected,
                  ]}
                />
                <Text style={styles.reasonLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.privacy}>
            Lưu ý bảo mật: không gửi nội dung sức khỏe hoặc cuộc trò chuyện.
            Không cần tải lên tệp; hệ thống chỉ dùng dữ kiện vận hành hiện có.
          </Text>
          {notice ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {notice}
            </Text>
          ) : null}
          <PrimaryButton
            disabled={busy || !reason}
            label={busy ? 'Đang gửi yêu cầu…' : 'Gửi yêu cầu xem xét'}
            onPress={() => void submit()}
            testID="appointment-dispute-submit"
          />
          <ActionButton
            disabled={busy}
            label="Để sau"
            onPress={() => {
              setReason(null)
              setNotice('')
              setDeferred(true)
            }}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.tealPale,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  heading: { gap: spacing.xs },
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.ink,
    fontSize: typography.body + 5,
    fontWeight: '800',
    lineHeight: typography.bodyLineHeight + 5,
  },
  subtitle: {
    color: colors.ink,
    fontSize: typography.body + 2,
    fontWeight: '800',
    lineHeight: typography.bodyLineHeight + 2,
  },
  body: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  hint: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  meta: { color: colors.tealDeep, fontSize: 13, fontWeight: '800' },
  stateBox: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  form: { gap: spacing.lg },
  deadline: {
    backgroundColor: colors.backgroundDeep,
    borderRadius: radii.control,
    color: colors.tealDeep,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 21,
    padding: spacing.md,
  },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  reasons: { gap: spacing.sm },
  reason: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reasonSelected: { borderColor: colors.teal, borderWidth: 2 },
  radio: {
    borderColor: colors.inkSoft,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 20,
    width: 20,
  },
  radioSelected: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
    borderWidth: 5,
  },
  reasonLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  privacy: {
    backgroundColor: colors.backgroundDeep,
    borderRadius: radii.control,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 19,
    padding: spacing.md,
  },
  error: {
    backgroundColor: '#FFF1EE',
    borderRadius: radii.control,
    color: '#7D2B25',
    fontSize: 14,
    lineHeight: 21,
    padding: spacing.md,
  },
  action: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.teal,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionLabel: { color: colors.tealDeep, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
})
