import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { ConsultationBriefApi } from './consultation-brief-api'
import {
  consultationBriefDraftRequestSchema,
  type ConsultationBrief,
  type ConsultationBriefDraftRequest,
  type ConsultationBriefScreeningContext,
  type ConsultationBriefScreeningContextChoice,
} from './consultation-brief-contract'

type Confirmation = 'approve' | 'revoke' | null

const levelLabels: Record<
  ConsultationBriefScreeningContext['screeningLevel'],
  string
> = {
  MINIMAL: 'tối thiểu',
  MILD: 'nhẹ',
  MODERATE: 'vừa',
  MODERATELY_SEVERE: 'khá nặng',
  SEVERE: 'nặng',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function contextLabel(
  value:
    | ConsultationBriefScreeningContextChoice
    | Pick<ConsultationBrief, 'screeningContext' | 'updatedAt'>,
) {
  const contexts = value.screeningContext
    .map(
      (context) =>
        `${context.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'}: ${levelLabels[context.screeningLevel]}`,
    )
    .join(' · ')
  const evaluatedAt =
    'evaluatedAt' in value
      ? value.evaluatedAt
      : (value.screeningContext[0]?.evaluatedAt ?? value.updatedAt)
  return `${contexts} · ${formatDate(evaluatedAt)}`
}

function errorCopy(error: unknown) {
  if (!(error instanceof ApiError))
    return 'Chưa thể tải bản tóm tắt. Hãy thử lại.'
  if (error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại trước khi tiếp tục.'
  if (error.status === 403 || error.code.endsWith('ACCESS_DENIED'))
    return 'Bạn không có quyền xem hoặc thay đổi bản tóm tắt của lịch hẹn này.'
  if (
    error.status === 412 ||
    error.code === 'CONSULTATION_BRIEF_VERSION_MISMATCH' ||
    error.code === 'CONSULTATION_BRIEF_APPOINTMENT_CHANGED'
  )
    return 'Lịch hẹn hoặc bản tóm tắt vừa thay đổi. Nội dung cũ đã được đóng để tránh chia sẻ nhầm. Hãy tải lại trước khi tiếp tục.'
  if (error.code === 'CONSULTATION_BRIEF_APPOINTMENT_NOT_CONFIRMED')
    return 'Lịch hẹn cần được xác nhận trước khi bạn chuẩn bị bản tóm tắt.'
  if (error.code === 'CONSULTATION_BRIEF_APPOINTMENT_ALREADY_STARTED')
    return 'Không thể thay đổi quyền chia sẻ sau khi buổi hẹn đã bắt đầu.'
  if (error.status === 404 || error.code === 'SUPPORT_EVALUATION_NOT_FOUND')
    return 'Không còn đủ dữ liệu hợp lệ cho bản tóm tắt này. Hãy tải lại lịch hẹn.'
  if (error.status === 503 || error.code === 'APPOINTMENT_CONTEXT_UNAVAILABLE')
    return 'Chưa thể xác nhận lịch hẹn lúc này. Nội dung không được chia sẻ; hãy thử lại sau.'
  return 'Chưa thể hoàn tất yêu cầu. Nội dung không được chia sẻ; hãy tải lại rồi thử lại.'
}

function goalsFrom(value: string) {
  return value
    .split('\n')
    .map((goal) => goal.trim())
    .filter(Boolean)
}

function ActionButton({
  danger = false,
  disabled = false,
  label,
  onPress,
  testID,
  triggerRef,
}: Readonly<{
  danger?: boolean
  disabled?: boolean
  label: string
  onPress: () => void
  testID?: string
  triggerRef?: React.Ref<View>
}>) {
  return (
    <Pressable
      ref={triggerRef}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        danger ? styles.dangerAction : styles.secondaryAction,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      testID={testID}
    >
      <Text style={danger ? styles.dangerLabel : styles.secondaryLabel}>
        {label}
      </Text>
    </Pressable>
  )
}

function BriefReview({ brief }: Readonly<{ brief: ConsultationBrief }>) {
  return (
    <View style={styles.review} testID="consultation-brief-review">
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Tình hình hiện tại</Text>
        <Text style={styles.body}>{brief.currentSituation}</Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Bối cảnh sàng lọc</Text>
        <Text style={styles.body}>{contextLabel(brief)}</Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Mục tiêu</Text>
        {brief.userGoals.map((goal, index) => (
          <Text key={`${index}-${goal}`} style={styles.body}>
            • {goal}
          </Text>
        ))}
      </View>
    </View>
  )
}

export function ConsultationBriefPanel({
  api,
  appointmentId,
}: Readonly<{
  api: ConsultationBriefApi
  appointmentId: string
}>) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [brief, setBrief] = useState<ConsultationBrief | null>(null)
  const [choices, setChoices] = useState<
    ConsultationBriefScreeningContextChoice[]
  >([])
  const [currentSituation, setCurrentSituation] = useState('')
  const [goals, setGoals] = useState('')
  const [supportEvaluationId, setSupportEvaluationId] = useState('')
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const sequence = useRef(0)
  const mounted = useRef(true)
  const confirmationTriggerRef = useRef<View>(null)
  const confirmationHeadingRef = useRef<Text>(null)

  const clearSensitiveState = useCallback(() => {
    setBrief(null)
    setChoices([])
    setCurrentSituation('')
    setGoals('')
    setSupportEvaluationId('')
    setConfirmation(null)
    setNotice('')
  }, [])

  const applyBrief = useCallback((next: ConsultationBrief) => {
    setBrief(next)
    setCurrentSituation(next.currentSituation)
    setGoals(next.userGoals.join('\n'))
    setSupportEvaluationId(next.supportEvaluationId)
  }, [])

  const load = useCallback(async () => {
    const request = ++sequence.current
    clearSensitiveState()
    setError('')
    setLoading(true)
    try {
      const [contextList, current] = await Promise.all([
        api.screeningContexts(),
        api.get(appointmentId).catch((loadError: unknown) => {
          if (
            loadError instanceof ApiError &&
            loadError.status === 404 &&
            loadError.code === 'CONSULTATION_BRIEF_NOT_FOUND'
          )
            return null
          throw loadError
        }),
      ])
      if (request !== sequence.current || !mounted.current) return
      setChoices(contextList.items)
      if (current) applyBrief(current)
      else if (contextList.items[0])
        setSupportEvaluationId(contextList.items[0].supportEvaluationId)
    } catch (loadError) {
      if (request !== sequence.current || !mounted.current) return
      clearSensitiveState()
      setError(errorCopy(loadError))
    } finally {
      if (request === sequence.current && mounted.current) setLoading(false)
    }
  }, [api, appointmentId, applyBrief, clearSensitiveState])

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

  useEffect(() => {
    if (!confirmation) return
    const frame = requestAnimationFrame(() => {
      if (confirmationHeadingRef.current)
        AccessibilityInfo.sendAccessibilityEvent?.(
          confirmationHeadingRef.current,
          'focus',
        )
    })
    return () => cancelAnimationFrame(frame)
  }, [confirmation])

  const draft = useMemo<ConsultationBriefDraftRequest | null>(() => {
    const parsed = consultationBriefDraftRequestSchema.safeParse({
      currentSituation,
      supportEvaluationId,
      userGoals: goalsFrom(goals),
    })
    return parsed.success ? parsed.data : null
  }, [currentSituation, goals, supportEvaluationId])

  const exactSavedDraft = Boolean(
    brief &&
    brief.status === 'DRAFT' &&
    draft &&
    draft.currentSituation === brief.currentSituation &&
    draft.supportEvaluationId === brief.supportEvaluationId &&
    choices.some(
      (choice) => choice.supportEvaluationId === brief.supportEvaluationId,
    ) &&
    JSON.stringify(draft.userGoals) === JSON.stringify(brief.userGoals),
  )

  const closeConfirmation = useCallback(() => {
    setConfirmation(null)
    requestAnimationFrame(() => {
      if (confirmationTriggerRef.current)
        AccessibilityInfo.sendAccessibilityEvent?.(
          confirmationTriggerRef.current,
          'focus',
        )
    })
  }, [])

  async function runAction(
    action: () => Promise<ConsultationBrief>,
    successCopy: string,
  ) {
    if (busy) return
    const request = ++sequence.current
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const next = await action()
      if (request !== sequence.current || !mounted.current) return
      applyBrief(next)
      setConfirmation(null)
      setNotice(successCopy)
    } catch (actionError) {
      if (request !== sequence.current || !mounted.current) return
      clearSensitiveState()
      setError(errorCopy(actionError))
    } finally {
      if (request === sequence.current && mounted.current) setBusy(false)
    }
  }

  function save() {
    if (!draft) {
      setNotice(
        'Hãy nhập tình hình hiện tại và từ 1 đến 5 mục tiêu, mỗi mục tiêu trên một dòng.',
      )
      return
    }
    void runAction(
      () => api.save(appointmentId, draft, brief?.version),
      'Bản nháp đã được lưu. Hãy xem lại trước khi chia sẻ.',
    )
  }

  function confirm() {
    if (!brief) return
    if (confirmation === 'approve' && exactSavedDraft)
      void runAction(
        () => api.approve(appointmentId, brief.version),
        'Quyền chia sẻ đã được xác nhận.',
      )
    if (confirmation === 'revoke' && brief.sharingStatus === 'ACTIVE')
      void runAction(
        () => api.revoke(appointmentId, brief.version),
        'Quyền truy cập đã được thu hồi.',
      )
  }

  const selectedChoice = choices.find(
    (choice) => choice.supportEvaluationId === supportEvaluationId,
  )
  const isApproved = brief?.status === 'APPROVED'
  const active = isApproved && brief.sharingStatus === 'ACTIVE'
  const revoked = isApproved && brief.sharingStatus === 'REVOKED'

  return (
    <View style={styles.panel} testID="consultation-brief-panel">
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>
            {active
              ? 'NỘI DUNG ĐÃ PHÊ DUYỆT'
              : revoked
                ? 'QUYỀN CHIA SẺ'
                : 'CHUẨN BỊ TRƯỚC BUỔI HẸN'}
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            Tóm tắt trước buổi tư vấn
          </Text>
        </View>
        {!loading && !error && (
          <Text style={styles.chip}>
            {active
              ? 'Đang chia sẻ'
              : revoked
                ? 'Đã thu hồi'
                : 'Bản nháp riêng tư'}
          </Text>
        )}
      </View>

      {loading ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          Đang tải bản tóm tắt…
        </Text>
      ) : error ? (
        <>
          <Text accessibilityLiveRegion="assertive" style={styles.error}>
            {error}
          </Text>
          <ActionButton label="Tải lại" onPress={() => void load()} />
        </>
      ) : active || revoked ? (
        brief && (
          <>
            <Text style={styles.notice}>
              {active
                ? `Chỉ chuyên gia được giao lịch có thể đọc đúng bản chụp này trong khung thời gian ${brief.accessStartAt ? formatDate(brief.accessStartAt) : 'đã xác nhận'} – ${brief.accessEndAt ? formatDate(brief.accessEndAt) : 'đã xác nhận'}.`
                : 'Các lượt đọc trong tương lai đã bị chặn. Nội dung vẫn thuộc tài khoản của bạn và không còn được chia sẻ cho lịch hẹn này.'}
            </Text>
            <BriefReview brief={brief} />
            {active && (
              <ActionButton
                danger
                disabled={busy}
                label="Thu hồi quyền truy cập"
                onPress={() => setConfirmation('revoke')}
                testID="consultation-brief-open-revoke"
                triggerRef={confirmationTriggerRef}
              />
            )}
          </>
        )
      ) : choices.length === 0 ? (
        <Text style={styles.notice}>
          Bạn cần hoàn thành đủ PHQ-9 và GAD-7 trong cùng một lần đánh giá trước
          khi tạo bản tóm tắt. Không có nội dung nào được chia sẻ.
        </Text>
      ) : (
        <>
          <Text style={styles.notice}>
            Chỉ tình hình hiện tại, mức sàng lọc đã chọn và mục tiêu bạn phê
            duyệt mới được chia sẻ. Nhật ký, câu trả lời sàng lọc, chat và ghi
            chú riêng không được chia sẻ.
          </Text>
          <View style={styles.field}>
            <Text style={styles.label}>Tình hình hiện tại</Text>
            <TextInput
              accessibilityLabel="Tình hình hiện tại"
              editable={!busy}
              maxLength={1000}
              multiline
              onChangeText={(value) => {
                setCurrentSituation(value)
                setNotice('')
              }}
              style={styles.input}
              testID="consultation-brief-situation"
              value={currentSituation}
            />
            <Text style={styles.hint}>
              Tối đa 1.000 ký tự. Không nhập thông tin bạn không muốn chuyên gia
              đọc.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Bối cảnh sàng lọc</Text>
            {choices.map((choice) => {
              const selected =
                choice.supportEvaluationId === supportEvaluationId
              return (
                <Pressable
                  key={choice.supportEvaluationId}
                  accessibilityLabel={contextLabel(choice)}
                  accessibilityRole="radio"
                  accessibilityState={{ disabled: busy, selected }}
                  disabled={busy}
                  onPress={() => {
                    setSupportEvaluationId(choice.supportEvaluationId)
                    setNotice('')
                  }}
                  style={({ pressed }) => [
                    styles.contextChoice,
                    selected && styles.contextChoiceSelected,
                    pressed && styles.pressed,
                  ]}
                  testID="consultation-brief-context-choice"
                >
                  <View
                    style={[styles.radio, selected && styles.radioSelected]}
                  />
                  <Text style={styles.contextLabel}>
                    {contextLabel(choice)}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mục tiêu cho buổi tư vấn</Text>
            <TextInput
              accessibilityLabel="Mục tiêu cho buổi tư vấn"
              editable={!busy}
              maxLength={1004}
              multiline
              onChangeText={(value) => {
                setGoals(value)
                setNotice('')
              }}
              style={styles.input}
              testID="consultation-brief-goals"
              value={goals}
            />
            <Text style={styles.hint}>
              Mỗi dòng là một mục tiêu, tối đa 5 mục tiêu và 200 ký tự mỗi mục
              tiêu.
            </Text>
          </View>

          {notice ? (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              {notice}
            </Text>
          ) : null}
          {selectedChoice && brief?.status === 'DRAFT' && exactSavedDraft ? (
            <Text style={styles.hint}>
              Bản nháp đang hiển thị khớp với nội dung đã lưu.
            </Text>
          ) : null}
          <ActionButton
            disabled={busy}
            label={busy ? 'Đang lưu…' : 'Lưu bản nháp'}
            onPress={save}
            testID="consultation-brief-save"
          />
          <ActionButton
            disabled={busy || !exactSavedDraft}
            label="Xem lại để chia sẻ"
            onPress={() => setConfirmation('approve')}
            testID="consultation-brief-open-approve"
            triggerRef={confirmationTriggerRef}
          />
        </>
      )}

      <Modal
        animationType="none"
        onRequestClose={closeConfirmation}
        transparent
        visible={confirmation !== null}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Đóng xác nhận chia sẻ"
            onPress={closeConfirmation}
            style={styles.backdrop}
            testID="consultation-brief-modal-backdrop"
          />
          <ScrollView
            accessibilityViewIsModal
            contentContainerStyle={styles.modalContent}
            onAccessibilityEscape={closeConfirmation}
            style={styles.modal}
            testID="consultation-brief-modal"
          >
            <Text
              ref={confirmationHeadingRef}
              accessible
              accessibilityRole="header"
              style={styles.modalTitle}
            >
              {confirmation === 'approve'
                ? 'Bạn muốn chia sẻ bản tóm tắt này?'
                : 'Thu hồi quyền truy cập?'}
            </Text>
            <Text style={styles.body}>
              {confirmation === 'approve'
                ? 'Chuyên gia được giao lịch chỉ đọc đúng nội dung đã lưu dưới đây. Nhật ký, câu trả lời sàng lọc, chat và ghi chú riêng không được chia sẻ.'
                : 'Các lượt đọc trong tương lai của chuyên gia sẽ bị chặn ngay sau khi MentalBridge xác nhận.'}
            </Text>
            {confirmation === 'approve' && brief ? (
              <>
                <BriefReview brief={brief} />
                <Text style={styles.notice}>
                  Quyền đọc áp dụng từ 24 giờ trước đến 24 giờ sau giờ bắt đầu.
                  Lịch hoặc chuyên gia thay đổi sẽ cần phê duyệt mới.
                </Text>
              </>
            ) : null}
            <ActionButton
              disabled={busy}
              label={
                confirmation === 'approve'
                  ? 'Quay lại chỉnh sửa'
                  : 'Giữ quyền chia sẻ'
              }
              onPress={closeConfirmation}
            />
            <ActionButton
              danger={confirmation === 'revoke'}
              disabled={busy}
              label={
                confirmation === 'approve'
                  ? 'Phê duyệt chia sẻ'
                  : 'Thu hồi quyền truy cập'
              }
              onPress={confirm}
              testID="consultation-brief-confirm"
            />
          </ScrollView>
        </View>
      </Modal>
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
    padding: spacing.lg,
  },
  headingRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headingCopy: { flex: 1 },
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: typography.body + 4,
    fontWeight: '800',
    lineHeight: typography.bodyLineHeight + 2,
  },
  chip: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
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
  field: { gap: spacing.sm },
  label: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    minHeight: 112,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
  },
  hint: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  contextChoice: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.md,
  },
  contextChoiceSelected: { borderColor: colors.teal },
  radio: {
    borderColor: colors.teal,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 20,
    width: 20,
  },
  radioSelected: { backgroundColor: colors.teal },
  contextLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  action: {
    alignItems: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    width: '100%',
  },
  secondaryAction: {
    backgroundColor: colors.surface,
    borderColor: colors.teal,
  },
  dangerAction: { backgroundColor: colors.surface, borderColor: '#A93D34' },
  secondaryLabel: {
    color: colors.tealDeep,
    fontSize: 15,
    fontWeight: '800',
  },
  dangerLabel: { color: '#8A3029', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  review: { gap: spacing.md },
  reviewRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  reviewLabel: { color: colors.inkSoft, fontSize: 13, fontWeight: '800' },
  body: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    backgroundColor: 'rgba(27, 42, 34, 0.55)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalContent: { gap: spacing.lg, padding: spacing.xl },
  modalTitle: {
    color: colors.ink,
    fontSize: typography.body + 5,
    fontWeight: '800',
    lineHeight: typography.bodyLineHeight + 6,
  },
})
