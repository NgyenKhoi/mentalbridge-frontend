import { randomUUID } from 'expo-crypto'
import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { PrimaryButton } from '@/components/PrimaryButton'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { SupportPlanActionApi } from './support-plan-action-api'
import type { CanonicalSupportPlan } from './support-plan-action-contract'
import type {
  AdaptiveReview,
  AdaptiveReviewOption,
} from './adaptive-review-contract'

const optionNames: Record<AdaptiveReviewOption['kind'], string> = {
  KEEP_CURRENT: 'Giữ kế hoạch như hiện tại',
  LOWER_WORKLOAD: 'Làm nhẹ bớt',
  DIFFERENT_TIME: 'Đổi thời điểm',
  ALTERNATIVE_ACTION: 'Thay bằng hoạt động khác',
  DIFFERENT_FOCUS: 'Đổi thứ tự ưu tiên',
  PROFESSIONAL_SUPPORT_NEXT_STEP: 'Trao đổi với chuyên gia',
}

const stateNotes: Record<AdaptiveReview['reassessment']['state'], string> = {
  AVAILABLE: 'Bản đánh giá lại hiện tại đã sẵn sàng.',
  NOT_STARTED: 'Bạn chưa bắt đầu lượt đánh giá lại cho giai đoạn này.',
  INCOMPLETE: 'Lượt đánh giá lại còn thiếu một bài sàng lọc.',
  STALE: 'Bản đánh giá lại đã cũ so với giai đoạn hiện tại.',
  UNAVAILABLE: 'Chưa thể kiểm tra bản đánh giá lại lúc này.',
}

type PreparedCandidate = Readonly<{
  optionId: string
  reviewFingerprint: string
  currentPlanId: string
  currentVersion: number
  draft: CanonicalSupportPlan
}>

function changeText(change: AdaptiveReviewOption['changes'][number]) {
  const before = change.before ?? '—'
  const after = change.after ?? '—'
  switch (change.field) {
    case 'ESTIMATED_DURATION_MINUTES':
      return `Thời lượng: ${before} → ${after} phút`
    case 'DAYS_PER_WEEK':
      return `Số ngày mỗi tuần: ${before} → ${after}`
    case 'PREFERRED_DAYPART':
      return `Khung giờ: ${before} → ${after}`
    case 'LOCAL_TIME':
      return `Giờ thực hiện: ${before} → ${after}`
    case 'ACTION':
      return `Hoạt động: ${before} → ${after}`
    case 'FOCUS_ORDER':
      return `Ưu tiên: ${after}`
  }
}

function reviewError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'ADAPTIVE_REVIEW_STALE' || error.status === 412)
      return 'Dữ liệu xem lại vừa thay đổi. Hãy tải lại trước khi chọn.'
    if (error.status === 409)
      return 'Chưa thể áp dụng lựa chọn với trạng thái hiện tại. Kế hoạch vẫn giữ nguyên.'
  }
  return 'Chưa tải được phần xem lại. Kế hoạch vẫn giữ nguyên.'
}

function candidateMatches(
  prepared: PreparedCandidate,
  option: AdaptiveReviewOption,
  review: AdaptiveReview,
  current: CanonicalSupportPlan,
) {
  return (
    option.executionKind === 'PREPARE_REPLACEMENT' &&
    prepared.optionId === option.optionId &&
    prepared.reviewFingerprint === review.reviewFingerprint &&
    prepared.currentPlanId === current.supportPlanId &&
    prepared.currentVersion === current.version
  )
}

function sameDraft(left: CanonicalSupportPlan, right: CanonicalSupportPlan) {
  return (
    left.supportPlanId === right.supportPlanId && left.version === right.version
  )
}

function PlanColumn({
  label,
  plan,
}: Readonly<{ label: string; plan: CanonicalSupportPlan }>) {
  return (
    <View style={styles.planColumn}>
      <Text style={styles.planHeading}>{label}</Text>
      {plan.focuses.map((focus) => (
        <View key={focus.focusId} style={styles.planFocus}>
          <Text style={styles.optionTitle}>{focus.title}</Text>
          {focus.actions.map((action) => {
            const schedule = action.schedules[0]
            return (
              <View key={action.actionId} style={styles.planAction}>
                <Text style={styles.body}>{action.presentation.title}</Text>
                {schedule ? (
                  <Text style={styles.quiet}>
                    {schedule.estimatedDurationMinutes} phút ·{' '}
                    {schedule.preferredDaypart ??
                      schedule.localTime ??
                      'Linh hoạt'}
                  </Text>
                ) : (
                  <Text style={styles.quiet}>Không có lịch cố định</Text>
                )}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

function DraftComparison({
  current,
  candidate,
  option,
}: Readonly<{
  current: CanonicalSupportPlan
  candidate: CanonicalSupportPlan
  option: AdaptiveReviewOption
}>) {
  return (
    <View
      accessibilityLabel="So sánh kế hoạch hiện tại và phương án mới"
      style={styles.comparison}
    >
      <Text accessibilityRole="header" style={styles.title}>
        So sánh trước khi thay thế
      </Text>
      <View style={styles.planColumns}>
        <PlanColumn label="Hiện tại" plan={current} />
        <PlanColumn label="Phương án mới" plan={candidate} />
      </View>
      <View style={styles.materialChanges}>
        <Text style={styles.planHeading}>Thay đổi vật chất do Care nêu</Text>
        {option.changes.length > 0 ? (
          option.changes.map((change) => (
            <Text key={change.field} style={styles.body}>
              {changeText(change)}
            </Text>
          ))
        ) : (
          <Text style={styles.quiet}>
            Care không trả về thay đổi vật chất; không thể xác nhận thay thế.
          </Text>
        )}
      </View>
    </View>
  )
}

export function AdaptiveReviewPanel({
  api,
  current,
  draft,
  disabled,
  onChanged,
  onReassessment,
  onProfessionalSupport,
}: Readonly<{
  api: SupportPlanActionApi
  current: CanonicalSupportPlan
  draft: CanonicalSupportPlan | null
  disabled: boolean
  onChanged: () => Promise<void>
  onReassessment: () => void
  onProfessionalSupport: () => void
}>) {
  const [review, setReview] = useState<AdaptiveReview | null>(null)
  const [choice, setChoice] = useState<string | null>(null)
  const [prepared, setPrepared] = useState<PreparedCandidate | null>(null)
  const [comparing, setComparing] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const key = useRef<{ signature: string; value: string } | null>(null)

  const load = async () => {
    if (loading) return
    setLoading(true)
    setMessage('')
    setChoice(null)
    setComparing(false)
    setAcknowledged(false)
    try {
      const next = await api.getAdaptiveReview(
        current.supportPlanId,
        current.version,
      )
      setReview(next)
      setPrepared((value) =>
        value &&
        value.reviewFingerprint === next.reviewFingerprint &&
        value.currentPlanId === current.supportPlanId &&
        value.currentVersion === current.version
          ? value
          : null,
      )
    } catch (error) {
      setReview(null)
      setPrepared(null)
      setMessage(reviewError(error))
    } finally {
      setLoading(false)
    }
  }

  const selected = review?.options.find((option) => option.optionId === choice)
  const preparedForChoice =
    prepared &&
    selected &&
    review &&
    candidateMatches(prepared, selected, review, current)
      ? prepared
      : null
  const draftMismatch = Boolean(
    preparedForChoice && draft && !sameDraft(preparedForChoice.draft, draft),
  )
  const candidate = draftMismatch
    ? null
    : preparedForChoice
      ? (draft ?? preparedForChoice.draft)
      : null
  const foreignDraft = Boolean(
    selected?.executionKind === 'PREPARE_REPLACEMENT' && draft && !candidate,
  )
  const showComparison = Boolean(comparing && candidate && selected)

  async function confirm(option: AdaptiveReviewOption) {
    if (!review || loading || disabled) return
    if (option.executionKind === 'NAVIGATE_PROFESSIONAL_SUPPORT') {
      onProfessionalSupport()
      return
    }

    const replacing =
      option.executionKind === 'PREPARE_REPLACEMENT' &&
      preparedForChoice &&
      candidate &&
      comparing &&
      acknowledged &&
      option.changes.length > 0
    if (
      option.executionKind === 'PREPARE_REPLACEMENT' &&
      (foreignDraft || draftMismatch || (preparedForChoice && !replacing))
    )
      return

    const proposed = replacing ? candidate : undefined
    const signature = `${review.reviewFingerprint}:${option.optionId}:${proposed?.supportPlanId ?? ''}:${proposed?.version ?? ''}`
    if (key.current?.signature !== signature)
      key.current = { signature, value: randomUUID() }
    setLoading(true)
    setMessage('')
    try {
      const result = await api.confirmAdaptiveReview(
        current.supportPlanId,
        current.version,
        review.reviewFingerprint,
        option,
        key.current.value,
        proposed,
      )
      key.current = null
      if (result.result === 'DRAFT_PREPARED' && result.draft) {
        const binding: PreparedCandidate = {
          optionId: option.optionId,
          reviewFingerprint: review.reviewFingerprint,
          currentPlanId: current.supportPlanId,
          currentVersion: current.version,
          draft: result.draft,
        }
        setPrepared(binding)
        setComparing(true)
        setAcknowledged(false)
        setMessage(
          'Đã chuẩn bị phương án mới. Kế hoạch hiện tại chưa thay đổi; hãy so sánh và xác nhận lần hai.',
        )
        try {
          await onChanged()
        } catch {
          setMessage(
            'Phương án đã được chuẩn bị nhưng chưa đồng bộ lại được. Chỉ bản DRAFT vừa nhận mới được dùng để so sánh.',
          )
        }
        return
      }

      await onChanged()
      setPrepared(null)
      setComparing(false)
      setAcknowledged(false)
      setChoice(null)
      setReview(null)
      setMessage(
        result.result === 'KEPT' || result.result === 'CYCLE_CONTINUED'
          ? 'Bạn đã chọn giữ kế hoạch. Không có thay đổi nào ngoài chu kỳ bạn đã xác nhận.'
          : 'Lựa chọn đã được Care áp dụng và lịch sử trước đó vẫn được giữ.',
      )
    } catch (error) {
      setMessage(reviewError(error))
      if (
        error instanceof ApiError &&
        (error.code === 'ADAPTIVE_REVIEW_STALE' || error.status === 412)
      ) {
        setReview(null)
        setPrepared(null)
        setComparing(false)
        setAcknowledged(false)
      }
    } finally {
      setLoading(false)
    }
  }

  function choose(option: AdaptiveReviewOption) {
    setChoice(option.optionId)
    setAcknowledged(false)
    setMessage('')
    setComparing(
      Boolean(
        review &&
        prepared &&
        candidateMatches(prepared, option, review, current),
      ),
    )
  }

  function cancelComparison() {
    setChoice(null)
    setComparing(false)
    setAcknowledged(false)
    setMessage(
      'Phương án DRAFT chưa được áp dụng. Kế hoạch hiện tại vẫn giữ nguyên.',
    )
  }

  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.title}>
        Tiến độ và điều chỉnh
      </Text>
      <Text style={styles.body}>
        Xem lại giai đoạn hiện tại và chủ động giữ hoặc đổi kế hoạch. Đây là lời
        mời theo nhịp 14 ngày của Care, không phải cam kết rằng mọi người đều
        hoàn tất đúng ngày đó.
      </Text>
      {!review && (
        <PrimaryButton
          disabled={loading || disabled}
          label={
            loading ? 'Đang tải phần xem lại…' : 'Xem tiến độ và các lựa chọn'
          }
          onPress={() => void load()}
          testID="adaptive-review-open"
        />
      )}
      {loading && review && <ActivityIndicator color={colors.tealDeep} />}
      {review && (
        <View style={styles.review}>
          <Text style={styles.lead}>
            {review.reviewState === 'REVIEW_DUE'
              ? 'Đã đến lúc xem lại chu kỳ hiện tại.'
              : review.reviewState === 'PAUSED'
                ? 'Kế hoạch đang tạm dừng; chưa có gì thay đổi cho đến khi bạn chọn.'
                : `Bạn đang ở ngày ${review.programPeriod.elapsedDays} của giai đoạn này.`}
          </Text>
          <View style={styles.facts}>
            <Text style={styles.body}>
              Đã ghi nhận: {review.programPeriod.completedCount} hoàn thành ·{' '}
              {review.programPeriod.skippedCount} bỏ qua ·{' '}
              {review.programPeriod.openCount} chưa có kết quả.
            </Text>
            <Text style={styles.quiet}>
              {stateNotes[review.reassessment.state]}
            </Text>
          </View>
          {review.contradictions.map((item) => (
            <Text key={item.contradictionId} style={styles.note}>
              Các nguồn hiện chưa cùng một hướng. MentalBridge giữ riêng từng
              nguồn để bạn tự cân nhắc.
            </Text>
          ))}
          {review.reassessment.state !== 'AVAILABLE' && (
            <PrimaryButton
              label="Làm hoặc cập nhật đánh giá lại"
              onPress={onReassessment}
            />
          )}
          {review.options.map((option) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{
                checked: choice === option.optionId,
                disabled: loading,
              }}
              disabled={loading}
              key={option.optionId}
              onPress={() => choose(option)}
              style={[
                styles.option,
                choice === option.optionId && styles.selected,
              ]}
            >
              <Text style={styles.optionTitle}>
                {option.kind === 'KEEP_CURRENT' &&
                option.executionKind === 'CONTINUE_CYCLE'
                  ? 'Giữ nhịp này thêm 14 ngày'
                  : optionNames[option.kind]}
              </Text>
              {option.changes.map((change) => (
                <Text key={change.field} style={styles.quiet}>
                  {changeText(change)}
                </Text>
              ))}
            </Pressable>
          ))}
          {selected && (
            <View style={styles.confirm}>
              <Text style={styles.body}>
                Bạn chọn: {optionNames[selected.kind]}.
              </Text>
              {foreignDraft || draftMismatch ? (
                <Text accessibilityLiveRegion="polite" style={styles.warning}>
                  DRAFT hiện có không khớp lựa chọn và fingerprint vừa chọn. Ứng
                  dụng sẽ không gửi DRAFT này để thay thế.
                </Text>
              ) : showComparison && candidate ? (
                <>
                  <DraftComparison
                    candidate={candidate}
                    current={current}
                    option={selected}
                  />
                  <PrimaryButton
                    disabled={loading}
                    label={
                      acknowledged
                        ? 'Đã xác nhận đã so sánh'
                        : 'Tôi đã so sánh hai phương án'
                    }
                    onPress={() => setAcknowledged(true)}
                    testID="adaptive-review-acknowledge"
                  />
                  <PrimaryButton
                    disabled={
                      loading ||
                      disabled ||
                      !acknowledged ||
                      selected.changes.length === 0
                    }
                    label="Xác nhận thay thế kế hoạch"
                    onPress={() => void confirm(selected)}
                    testID="adaptive-review-replace-confirm"
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={cancelComparison}
                    style={styles.reload}
                    testID="adaptive-review-cancel-comparison"
                  >
                    <Text style={styles.reloadText}>
                      Hủy, giữ kế hoạch hiện tại
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.quiet}>
                    Chỉ thay đổi được mô tả ở trên được áp dụng sau khi bạn xác
                    nhận.
                  </Text>
                  <PrimaryButton
                    disabled={loading || disabled || foreignDraft}
                    label={
                      selected.executionKind === 'NAVIGATE_PROFESSIONAL_SUPPORT'
                        ? 'Tìm chuyên gia'
                        : selected.executionKind === 'PREPARE_REPLACEMENT'
                          ? 'Chuẩn bị phương án để so sánh'
                          : 'Xác nhận lựa chọn'
                    }
                    onPress={() => void confirm(selected)}
                    testID="adaptive-review-confirm"
                  />
                </>
              )}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => void load()}
            style={styles.reload}
            testID="adaptive-review-reload"
          >
            <Text style={styles.reloadText}>Tải lại phần xem lại</Text>
          </Pressable>
        </View>
      )}
      {message && (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.panel,
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  body: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  quiet: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  review: { gap: spacing.md },
  lead: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: typography.bodyLineHeight,
  },
  facts: {
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    gap: spacing.sm,
    padding: spacing.md,
  },
  note: {
    backgroundColor: '#F8E8DF',
    borderRadius: radii.control,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    padding: spacing.md,
  },
  warning: {
    backgroundColor: '#F8E8DF',
    borderRadius: radii.control,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    padding: spacing.md,
  },
  option: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 52,
    padding: spacing.md,
  },
  selected: { borderColor: colors.tealDeep, borderWidth: 2 },
  optionTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  confirm: {
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    gap: spacing.md,
    padding: spacing.md,
  },
  comparison: { gap: spacing.md },
  planColumns: { flexDirection: 'row', gap: spacing.sm },
  planColumn: {
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  planHeading: { color: colors.tealDeep, fontSize: 14, fontWeight: '800' },
  planFocus: { gap: spacing.xs },
  planAction: { gap: spacing.xs },
  materialChanges: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.control,
    gap: spacing.xs,
    padding: spacing.md,
  },
  reload: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  reloadText: { color: colors.tealDeep, fontSize: 15, fontWeight: '700' },
  message: {
    color: colors.tealDeep,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
})
