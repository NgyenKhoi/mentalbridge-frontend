import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import type {
  SessionSummary,
  SessionSummaryList,
  UpdateAgreedNextStepRequest,
} from '@/specialist-summary/specialist-summary-contract'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { UserSummaryApi } from './user-summary-api'

type StepState = UpdateAgreedNextStepRequest['state']
type Command =
  | {
      kind: 'consent'
      summary: SessionSummary
      approved: boolean
    }
  | {
      kind: 'step'
      summary: SessionSummary
      step: SessionSummary['agreedNextSteps'][number]
      state: StepState
      hidden: boolean
    }

const STEP_LABELS: Record<
  SessionSummary['agreedNextSteps'][number]['type'],
  string
> = {
  CHECKLIST: 'Việc cần làm',
  JOURNAL: 'Viết nhật ký',
  EMOTION_CHECK_IN: 'Ghi nhận cảm xúc',
  REASSESSMENT: 'Làm lại bài sàng lọc',
  FOLLOW_UP_APPOINTMENT: 'Lịch hẹn tiếp theo',
  PLATFORM_RESOURCE: 'Tài nguyên trên MentalBridge',
}

const STATE_OPTIONS: readonly { value: StepState; label: string }[] = [
  { value: 'PENDING', label: 'Đang thực hiện' },
  { value: 'COMPLETED', label: 'Đã hoàn thành' },
  { value: 'SKIPPED', label: 'Bỏ qua' },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function isStale(error: unknown) {
  return (
    error instanceof ApiError && (error.status === 412 || error.status === 428)
  )
}

function errorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.'
    if (error.status === 403 || error.status === 404)
      return 'Không thể xem hoặc thay đổi tóm tắt cho lịch hẹn này.'
    if (error.status === 412 || error.status === 428)
      return 'Nội dung vừa thay đổi. Hãy tải lại tóm tắt trước khi thử tiếp.'
  }
  return 'Chưa thể hoàn tất thay đổi. Nội dung đã xác nhận vẫn được giữ nguyên; hãy thử lại.'
}

function replaceSummary(
  list: SessionSummaryList | undefined,
  updated: SessionSummary,
): SessionSummaryList {
  const current = list?.items ?? []
  const items = current.some((item) => item.id === updated.id)
    ? current.map((item) => (item.id === updated.id ? updated : item))
    : [updated, ...current]
  return {
    items,
    count: items.length,
    generatedAt: list?.generatedAt ?? updated.publishedAt,
  }
}

function ActionButton({
  disabled,
  label,
  onPress,
  selected = false,
  testID,
}: Readonly<{
  disabled: boolean
  label: string
  onPress: () => void
  selected?: boolean
  testID?: string
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        selected && styles.actionSelected,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      testID={testID}
    >
      <Text style={selected ? styles.actionLabelSelected : styles.actionLabel}>
        {label}
      </Text>
    </Pressable>
  )
}

function SummaryCard({
  busy,
  command,
  locked,
  onCommand,
  summary,
}: Readonly<{
  busy: boolean
  command: Command | undefined
  locked: boolean
  onCommand: (command: Command) => void
  summary: SessionSummary
}>) {
  const controlsDisabled = busy || locked
  return (
    <View style={styles.summary} testID="user-session-summary">
      <Text style={styles.meta}>
        Đã chia sẻ {formatDate(summary.publishedAt)}
      </Text>
      <View style={styles.section}>
        <Text style={styles.label}>Chủ đề đã trao đổi</Text>
        <View style={styles.tags}>
          {summary.topicsDiscussed.map((topic) => (
            <Text key={topic} style={styles.tag}>
              {topic}
            </Text>
          ))}
        </View>
      </View>
      {summary.progressSummary ? (
        <View style={styles.section}>
          <Text style={styles.label}>Điều đã ghi nhận</Text>
          <Text style={styles.body}>{summary.progressSummary}</Text>
        </View>
      ) : null}
      {summary.specialistNoteForUser ? (
        <View style={styles.quote}>
          <Text style={styles.label}>Lời nhắn từ chuyên gia</Text>
          <Text style={styles.body}>{summary.specialistNoteForUser}</Text>
        </View>
      ) : null}
      {summary.followUpSuggested ? (
        <Text style={styles.followUp}>
          Chuyên gia đề xuất một buổi trao đổi tiếp theo khi bạn sẵn sàng.
        </Text>
      ) : null}

      {summary.agreedNextSteps.length > 0 ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.subtitle}>
            Các bước đã thống nhất
          </Text>
          {summary.agreedNextSteps.map((step) => {
            const state = step.state ?? 'PENDING'
            const pending =
              command?.kind === 'step' && command.step.id === step.id
            return (
              <View
                key={step.id}
                style={[styles.step, step.hidden && styles.hiddenStep]}
                testID={`user-summary-step-${step.id}`}
              >
                <Text style={styles.kind}>{STEP_LABELS[step.type]}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
                {step.details ? (
                  <Text style={styles.body}>{step.details}</Text>
                ) : null}
                {step.hidden ? (
                  <Text style={styles.hint}>Đã ẩn khỏi danh sách của bạn</Text>
                ) : null}
                <View
                  accessibilityLabel={`Trạng thái ${step.title}`}
                  accessibilityRole="radiogroup"
                  style={styles.stateChoices}
                >
                  {STATE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityLabel={`${option.label}: ${step.title}`}
                      accessibilityRole="radio"
                      accessibilityState={{
                        disabled: controlsDisabled,
                        selected: state === option.value,
                      }}
                      disabled={controlsDisabled}
                      onPress={() =>
                        onCommand({
                          kind: 'step',
                          summary,
                          step,
                          state: option.value,
                          hidden: step.hidden,
                        })
                      }
                      style={({ pressed }) => [
                        styles.stateChoice,
                        state === option.value && styles.actionSelected,
                        pressed && styles.pressed,
                        controlsDisabled && styles.disabled,
                      ]}
                    >
                      <Text
                        style={
                          state === option.value
                            ? styles.stateLabelSelected
                            : styles.stateLabel
                        }
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <ActionButton
                  disabled={controlsDisabled}
                  label={step.hidden ? 'Hiện lại bước này' : 'Ẩn bước này'}
                  onPress={() =>
                    onCommand({
                      kind: 'step',
                      summary,
                      step,
                      state,
                      hidden: !step.hidden,
                    })
                  }
                  testID={`user-summary-hide-${step.id}`}
                />
                {pending ? (
                  <Text accessibilityLiveRegion="polite" style={styles.hint}>
                    Đang lưu thay đổi bước này…
                  </Text>
                ) : null}
              </View>
            )
          })}
        </View>
      ) : (
        <Text style={styles.hint}>
          Phiên này không có bước tiếp theo được thống nhất.
        </Text>
      )}

      <View style={styles.consent}>
        <Text accessibilityRole="header" style={styles.subtitle}>
          Quyền tái sử dụng tóm tắt này
        </Text>
        <Text style={styles.body}>
          Chỉ cho phép dùng lại đúng bản tóm tắt này khi bạn chủ động chọn trong
          lần tư vấn sau. Quyền này tách biệt với nội dung chuẩn bị trước buổi
          tư vấn.
        </Text>
        <Pressable
          accessibilityLabel="Cho phép tái sử dụng tóm tắt này"
          accessibilityRole="switch"
          accessibilityState={{
            checked: summary.reuseConsent?.approved ?? false,
            disabled: controlsDisabled,
          }}
          disabled={controlsDisabled}
          onPress={() =>
            onCommand({
              kind: 'consent',
              summary,
              approved: !(summary.reuseConsent?.approved ?? false),
            })
          }
          style={({ pressed }) => [
            styles.switchRow,
            pressed && styles.pressed,
            controlsDisabled && styles.disabled,
          ]}
          testID={`user-summary-consent-${summary.id}`}
        >
          <Text style={styles.switchLabel}>
            {summary.reuseConsent?.approved ? 'Đang cho phép' : 'Chưa cho phép'}
          </Text>
          <View
            style={[
              styles.switchTrack,
              summary.reuseConsent?.approved && styles.switchTrackOn,
            ]}
          >
            <View
              style={[
                styles.switchThumb,
                summary.reuseConsent?.approved && styles.switchThumbOn,
              ]}
            />
          </View>
        </Pressable>
        {command?.kind === 'consent' && command.summary.id === summary.id ? (
          <Text accessibilityLiveRegion="polite" style={styles.hint}>
            Đang lưu quyền tái sử dụng…
          </Text>
        ) : null}
      </View>
    </View>
  )
}

export function UserSessionSummaryPanel({
  api,
  appointmentId,
}: Readonly<{
  api: UserSummaryApi
  appointmentId: string
}>) {
  const queryClient = useQueryClient()
  const queryKey = ['user-session-summaries', appointmentId] as const
  const [locked, setLocked] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success')
  const [showHistory, setShowHistory] = useState(false)
  const summariesQuery = useQuery({
    queryKey,
    queryFn: () => api.list(appointmentId),
    retry: false,
    staleTime: 0,
  })
  const mutation = useMutation({
    mutationFn: (command: Command) => {
      if (command.kind === 'consent') {
        return api.updateConsent(
          appointmentId,
          command.summary.id,
          command.approved,
          command.summary.reuseConsent?.version ?? 0,
        )
      }
      return api.updateStep(
        appointmentId,
        command.step.id,
        { state: command.state, hidden: command.hidden },
        command.step.stateVersion ?? 0,
      )
    },
    onSuccess: (updated, command) => {
      queryClient.setQueryData<SessionSummaryList>(queryKey, (current) =>
        replaceSummary(current, updated),
      )
      setNotice(
        command.kind === 'consent'
          ? 'Đã cập nhật quyền tái sử dụng.'
          : 'Đã cập nhật bước tiếp theo.',
      )
      setNoticeTone('success')
    },
    onError: (error) => {
      if (isStale(error)) setLocked(true)
      setNotice(errorCopy(error))
      setNoticeTone('error')
    },
  })

  const refresh = async () => {
    setNotice('')
    const result = await summariesQuery.refetch()
    if (result.isSuccess) {
      setLocked(false)
      setNotice('Đã tải tóm tắt mới nhất.')
      setNoticeTone('success')
    } else {
      setNotice(errorCopy(result.error))
      setNoticeTone('error')
    }
  }

  const list = summariesQuery.data
  const latest = list?.items[0]
  const older = list?.items.slice(1) ?? []
  const run = (command: Command) => {
    if (mutation.isPending || locked || summariesQuery.isFetching) return
    setNotice('')
    mutation.mutate(command)
  }

  return (
    <View style={styles.panel} testID="user-session-summary-panel">
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>SAU BUỔI TƯ VẤN</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Tóm tắt sau buổi tư vấn
        </Text>
        <Text style={styles.body}>
          Xem nội dung đã được chia sẻ và tự quản lý các bước hai bên đã thống
          nhất.
        </Text>
      </View>

      {summariesQuery.isPending ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          Đang tải tóm tắt…
        </Text>
      ) : null}
      {summariesQuery.isFetching && list ? (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          Đang cập nhật tóm tắt. Các thay đổi tạm dừng.
        </Text>
      ) : null}
      {notice ? (
        <Text
          accessibilityLiveRegion={
            noticeTone === 'error' ? 'assertive' : 'polite'
          }
          style={noticeTone === 'error' ? styles.error : styles.notice}
        >
          {notice}
        </Text>
      ) : null}
      {summariesQuery.isError && list && !notice ? (
        <View style={styles.stateBox}>
          <Text accessibilityRole="alert" style={styles.body}>
            {errorCopy(summariesQuery.error)}
          </Text>
          <ActionButton
            disabled={summariesQuery.isFetching}
            label="Tải lại tóm tắt"
            onPress={() => void refresh()}
          />
        </View>
      ) : null}
      {summariesQuery.isError && !list ? (
        <View style={styles.stateBox}>
          <Text accessibilityRole="alert" style={styles.body}>
            {errorCopy(summariesQuery.error)}
          </Text>
          <ActionButton
            disabled={summariesQuery.isFetching}
            label="Tải lại"
            onPress={() => void refresh()}
          />
        </View>
      ) : null}
      {locked ? (
        <ActionButton
          disabled={summariesQuery.isFetching}
          label="Tải lại tóm tắt"
          onPress={() => void refresh()}
          testID="user-summary-reload-stale"
        />
      ) : null}
      {summariesQuery.isSuccess && !latest ? (
        <View style={styles.stateBox}>
          <Text style={styles.subtitle}>Chưa có tóm tắt được chia sẻ</Text>
          <Text style={styles.body}>
            Tóm tắt sẽ xuất hiện tại đây khi được chia sẻ cho bạn.
          </Text>
          <ActionButton
            disabled={summariesQuery.isFetching}
            label="Tải lại"
            onPress={() => void refresh()}
          />
        </View>
      ) : null}
      {latest ? (
        <SummaryCard
          busy={mutation.isPending || summariesQuery.isFetching}
          command={mutation.isPending ? mutation.variables : undefined}
          locked={locked}
          onCommand={run}
          summary={latest}
        />
      ) : null}
      {older.length > 0 ? (
        <View style={styles.history}>
          <ActionButton
            disabled={mutation.isPending || summariesQuery.isFetching}
            label={
              showHistory
                ? 'Ẩn các bản tóm tắt trước'
                : `Xem ${older.length} bản tóm tắt trước`
            }
            onPress={() => setShowHistory((value) => !value)}
          />
          {showHistory
            ? older.map((summary) => (
                <SummaryCard
                  key={summary.id}
                  busy={mutation.isPending || summariesQuery.isFetching}
                  command={mutation.isPending ? mutation.variables : undefined}
                  locked={locked}
                  onCommand={run}
                  summary={summary}
                />
              ))
            : null}
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
  notice: {
    backgroundColor: colors.backgroundDeep,
    borderRadius: radii.control,
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 21,
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
  stateBox: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  summary: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  meta: { color: colors.tealDeep, fontSize: 13, fontWeight: '800' },
  section: { gap: spacing.md },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 13,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quote: {
    backgroundColor: colors.surfaceSoft,
    borderLeftColor: colors.teal,
    borderLeftWidth: 4,
    borderRadius: radii.control,
    gap: spacing.sm,
    padding: spacing.md,
  },
  followUp: {
    backgroundColor: colors.tealDeep,
    borderRadius: radii.control,
    color: colors.white,
    fontSize: 14,
    lineHeight: 21,
    padding: spacing.md,
  },
  step: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  hiddenStep: { opacity: 0.65 },
  kind: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  stepTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  stateChoices: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  stateChoice: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  stateLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateLabelSelected: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  action: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.teal,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionSelected: { backgroundColor: colors.tealDeep },
  actionLabel: { color: colors.tealDeep, fontSize: 14, fontWeight: '800' },
  actionLabelSelected: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  consent: {
    backgroundColor: colors.backgroundDeep,
    borderRadius: radii.control,
    gap: spacing.md,
    padding: spacing.md,
  },
  switchRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  switchLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  switchTrack: {
    backgroundColor: colors.backgroundDeep,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 2,
    width: 48,
  },
  switchTrackOn: { backgroundColor: colors.teal },
  switchThumb: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: 22,
    width: 22,
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  history: { gap: spacing.lg },
})
