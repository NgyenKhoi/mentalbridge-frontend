import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { PrimaryButton } from '@/components/PrimaryButton'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { SupportPlanApi } from './support-plan-api'
import type {
  SupportPlanPersonalization,
  SupportPlanPersonalizationRequest,
} from './support-plan-contract'

type FormValue = SupportPlanPersonalizationRequest
type ScalarKey =
  | 'preferredFocus'
  | 'desiredPace'
  | 'dailyTimeBudgetMinutes'
  | 'preferredDaypart'
type ArrayKey = 'preferredActivityModes' | 'commonBarriers'

const emptyForm: FormValue = {
  preferredFocus: null,
  desiredPace: null,
  dailyTimeBudgetMinutes: null,
  preferredDaypart: null,
  preferredActivityModes: [],
  commonBarriers: [],
}

const focusOptions = [
  ['ANXIETY', 'Bớt căng thẳng'],
  ['MOOD', 'Nâng đỡ tâm trạng'],
  ['SLEEP', 'Ngủ và nghỉ ngơi'],
  ['MOTIVATION', 'Tìm lại động lực'],
  ['UNDERSTANDING_EMOTIONS', 'Hiểu cảm xúc'],
] as const
const paceOptions = [
  ['GENTLE', 'Nhẹ nhàng'],
  ['BALANCED', 'Cân bằng'],
  ['ACTIVE', 'Chủ động hơn'],
] as const
const daypartOptions = [
  ['MORNING', 'Buổi sáng'],
  ['AFTERNOON', 'Buổi chiều'],
  ['EVENING', 'Buổi tối'],
  ['FLEXIBLE', 'Linh hoạt'],
] as const
const modeOptions = [
  ['READING', 'Đọc ngắn'],
  ['GUIDED_PRACTICE', 'Bài tập có hướng dẫn'],
  ['JOURNALING', 'Viết nhật ký'],
  ['EMOTION_CHECK_IN', 'Ghi nhận cảm xúc'],
  ['ROUTINE', 'Thói quen nhỏ'],
] as const
const barrierOptions = [
  ['LOW_ENERGY', 'Ít năng lượng'],
  ['LIMITED_TIME', 'Không có nhiều thời gian'],
  ['DIFFICULT_TO_START', 'Khó bắt đầu'],
] as const

function formFrom(value: SupportPlanPersonalization): FormValue {
  return {
    preferredFocus: value.preferredFocus,
    desiredPace: value.desiredPace,
    dailyTimeBudgetMinutes: value.dailyTimeBudgetMinutes,
    preferredDaypart: value.preferredDaypart,
    preferredActivityModes: [...value.preferredActivityModes],
    commonBarriers: [...value.commonBarriers],
  }
}

function messageFor(error: unknown) {
  if (
    error instanceof ApiError &&
    (error.status === 412 ||
      error.code === 'SUPPORT_PLAN_PERSONALIZATION_VERSION_MISMATCH')
  )
    return 'Lựa chọn đã được cập nhật ở nơi khác. Tải bản mới nhất trước khi lưu lại.'
  return 'Chưa thể lưu lúc này. Những lựa chọn trên màn hình vẫn được giữ lại.'
}

function ScalarChoices<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: Readonly<{
  label: string
  value: T | null
  options: readonly (readonly [T, string])[]
  onChange: (value: T | null) => void
}>) {
  return (
    <View style={styles.fieldGroup} accessibilityRole="radiogroup">
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map(([option, optionLabel]) => {
          const checked = value === option
          return (
            <Pressable
              key={String(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.choice,
                checked && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  checked && styles.choiceTextSelected,
                ]}
              >
                {optionLabel}
              </Text>
            </Pressable>
          )
        })}
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: value === null }}
          onPress={() => onChange(null)}
          style={({ pressed }) => [
            styles.choice,
            value === null && styles.choiceSelected,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.choiceText,
              value === null && styles.choiceTextSelected,
            ]}
          >
            Chưa cần chọn
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

function MultiChoices({
  label,
  hint,
  values,
  options,
  onToggle,
}: Readonly<{
  label: string
  hint?: string
  values: readonly string[]
  options: readonly (readonly [string, string])[]
  onToggle: (value: string) => void
}>) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <View style={styles.choiceRow}>
        {options.map(([option, optionLabel]) => {
          const checked = values.includes(option)
          return (
            <Pressable
              key={option}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() => onToggle(option)}
              style={({ pressed }) => [
                styles.choice,
                checked && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  checked && styles.choiceTextSelected,
                ]}
              >
                {optionLabel}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function SupportPlanPersonalizationCard({
  api,
  subject,
  onReviewPlan,
}: Readonly<{
  api: SupportPlanApi
  subject: string
  onReviewPlan: () => void
}>) {
  const queryClient = useQueryClient()
  const queryKey = ['support-plan', subject, 'personalization'] as const
  const [formState, setFormState] = useState<{
    etag: string | null
    value: FormValue
  }>({ etag: null, value: emptyForm })
  const [feedback, setFeedback] = useState<{
    message: string
    tone: 'success' | 'error'
    conflict?: boolean
  }>()
  const query = useQuery({
    queryKey,
    queryFn: () => api.getPersonalization(),
    retry: false,
  })

  const form =
    query.data && formState.etag === query.data.etag
      ? formState.value
      : query.data
        ? formFrom(query.data.value)
        : emptyForm

  const mutation = useMutation({
    mutationFn: (next: FormValue) =>
      api.replacePersonalization(next, query.data!.etag),
    onSuccess: (authority) => {
      queryClient.setQueryData(queryKey, authority)
      setFeedback({
        tone: 'success',
        message:
          authority.value.status === 'SKIPPED'
            ? 'Đã bỏ qua. MentalBridge sẽ dùng lựa chọn mặc định an toàn.'
            : 'Đã lưu cách bạn muốn kế hoạch đồng hành.',
      })
    },
    onError: (error) => {
      const conflict =
        error instanceof ApiError &&
        (error.status === 412 ||
          error.code === 'SUPPORT_PLAN_PERSONALIZATION_VERSION_MISMATCH')
      setFeedback({ tone: 'error', message: messageFor(error), conflict })
    },
  })

  const dirty = useMemo(
    () =>
      query.data !== undefined &&
      JSON.stringify(form) !== JSON.stringify(formFrom(query.data.value)),
    [form, query.data],
  )

  const setScalar = <K extends ScalarKey>(key: K, value: FormValue[K]) => {
    setFormState({
      etag: query.data?.etag ?? null,
      value: { ...form, [key]: value },
    })
    setFeedback(undefined)
  }
  const toggleArray = (key: ArrayKey, value: string) => {
    const values = form[key] as string[]
    setFormState({
      etag: query.data?.etag ?? null,
      value: {
        ...form,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      },
    })
    setFeedback(undefined)
  }

  if (query.isPending) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.panel}>
        <Text style={styles.sectionTitle}>Đang tải tùy chọn của bạn…</Text>
      </View>
    )
  }

  if (!query.data) {
    return (
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>
          Cách bạn muốn kế hoạch đồng hành
        </Text>
        <Text accessibilityRole="alert" style={styles.errorText}>
          Chưa thể tải tùy chọn lúc này.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void query.refetch()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Thử tải lại</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.eyebrow}>TÙY CHỌN CỦA BẠN</Text>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Điều gì giúp kế hoạch dễ thực hiện hơn?
      </Text>
      <Text style={styles.description}>
        Mọi câu đều không bắt buộc. Đây là sở thích thực tế, không phải chẩn
        đoán hay đánh giá bạn.
      </Text>

      {query.data.value.planReview.required && (
        <View accessibilityLiveRegion="polite" style={styles.reviewNotice}>
          <Text style={styles.reviewTitle}>
            {query.data.value.planReview.reasonCode ===
            'PREFERENCES_CHANGED_AFTER_DRAFT_CREATION'
              ? 'Bản đề xuất hiện tại cần được tạo lại'
              : 'Kế hoạch hiện tại vẫn được giữ nguyên'}
          </Text>
          <Text style={styles.hint}>
            {query.data.value.planReview.reasonCode ===
            'PREFERENCES_CHANGED_AFTER_DRAFT_CREATION'
              ? 'Bản đề xuất dùng lựa chọn trước đó. Hãy bỏ bản cũ rồi tạo lại trước khi bắt đầu; MentalBridge không tự đổi kế hoạch thay bạn.'
              : 'Lựa chọn mới chỉ áp dụng khi bạn chủ động xem lại hoặc đổi kế hoạch.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onReviewPlan}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {query.data.value.planReview.reasonCode ===
              'PREFERENCES_CHANGED_AFTER_DRAFT_CREATION'
                ? 'Xem bản đề xuất bên dưới'
                : 'Xem kế hoạch bên dưới'}
            </Text>
          </Pressable>
        </View>
      )}

      <ScalarChoices
        label="Bạn muốn ưu tiên điều gì lúc này?"
        value={form.preferredFocus}
        options={focusOptions}
        onChange={(value) => setScalar('preferredFocus', value)}
      />
      <ScalarChoices
        label="Nhịp độ nào phù hợp với bạn?"
        value={form.desiredPace}
        options={paceOptions}
        onChange={(value) => setScalar('desiredPace', value)}
      />
      <ScalarChoices
        label="Bạn thường có bao nhiêu phút mỗi ngày?"
        value={form.dailyTimeBudgetMinutes}
        options={([5, 10, 15, 20, 30] as const).map(
          (minutes) => [minutes, `${minutes} phút`] as const,
        )}
        onChange={(value) => setScalar('dailyTimeBudgetMinutes', value)}
      />
      <ScalarChoices
        label="Thời điểm nào thường thuận tiện?"
        value={form.preferredDaypart}
        options={daypartOptions}
        onChange={(value) => setScalar('preferredDaypart', value)}
      />
      <MultiChoices
        label="Bạn thích cách thực hành nào?"
        hint="Có thể chọn nhiều lựa chọn."
        values={form.preferredActivityModes}
        options={modeOptions}
        onToggle={(value) => toggleArray('preferredActivityModes', value)}
      />
      <MultiChoices
        label="Điều gì thường khiến bạn khó bắt đầu?"
        values={form.commonBarriers}
        options={barrierOptions}
        onToggle={(value) => toggleArray('commonBarriers', value)}
      />

      {feedback && (
        <View accessibilityLiveRegion="polite" style={styles.feedback}>
          <Text
            accessibilityRole={feedback.tone === 'error' ? 'alert' : undefined}
            style={
              feedback.tone === 'error' ? styles.errorText : styles.successText
            }
          >
            {feedback.message}
          </Text>
          {feedback.conflict && (
            <Pressable
              accessibilityRole="button"
              onPress={() => void query.refetch()}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                Tải lựa chọn mới nhất
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <PrimaryButton
          disabled={!dirty || mutation.isPending}
          label={mutation.isPending ? 'Đang lưu…' : 'Lưu lựa chọn'}
          onPress={() => mutation.mutate(form)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: mutation.isPending }}
          disabled={mutation.isPending}
          onPress={() => {
            setFormState({
              etag: query.data?.etag ?? null,
              value: emptyForm,
            })
            mutation.mutate(emptyForm)
          }}
          style={({ pressed }) => [
            styles.skipButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.skipButtonText}>Bỏ qua tất cả</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.shell,
    borderWidth: 1,
    gap: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.xl,
  },
  eyebrow: {
    color: colors.tealDeep,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 29,
  },
  description: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  fieldGroup: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  choiceSelected: {
    backgroundColor: colors.tealPale,
    borderColor: colors.tealDeep,
  },
  choiceText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  choiceTextSelected: { color: colors.tealDeep },
  reviewNotice: {
    backgroundColor: colors.tealPale,
    borderLeftColor: colors.tealDeep,
    borderLeftWidth: 3,
    borderRadius: radii.control,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  reviewTitle: { color: colors.tealDeep, fontSize: 15, fontWeight: '800' },
  feedback: { gap: spacing.sm },
  errorText: {
    color: '#8A352C',
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  successText: {
    color: colors.tealDeep,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  actions: { alignItems: 'flex-start', gap: spacing.sm },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderColor: colors.tealDeep,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.tealDeep,
    fontSize: 15,
    fontWeight: '700',
  },
  skipButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  skipButtonText: { color: colors.tealDeep, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.68 },
})
