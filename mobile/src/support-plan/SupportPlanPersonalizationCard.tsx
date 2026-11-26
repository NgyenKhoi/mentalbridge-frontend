import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { AppIcon } from '@/components/AppIcon'
import { PrimaryButton } from '@/components/PrimaryButton'
import { colors, radii, spacing, typography } from '@/theme/tokens'
import { PlanPreferenceRow } from './PlanPreferenceRow'

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

function optionLabel<T extends string | number>(
  options: readonly (readonly [T, string])[],
  value: T | null,
) {
  return options.find(([key]) => key === value)?.[1] ?? 'Chưa chọn'
}

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
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState<ScalarKey | ArrayKey | null>(null)
  const toggleSection = (section: ScalarKey | ArrayKey) =>
    setExpanded((current) => (current === section ? null : section))
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
      setEditing(false)
      setExpanded(null)
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Chỉnh tùy chọn của bạn"
        accessibilityState={{ expanded: editing }}
        onPress={() => setEditing(!editing)}
        style={styles.header}
      >
        <View style={styles.headerIcon}>
          <AppIcon name="clipboard" size={22} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.sectionTitle}>Tùy chọn của bạn</Text>
          <Text style={styles.description}>
            {dirty
              ? 'Có thay đổi chưa lưu'
              : [
                  form.desiredPace
                    ? optionLabel(paceOptions, form.desiredPace)
                    : null,
                  form.dailyTimeBudgetMinutes
                    ? `${form.dailyTimeBudgetMinutes} phút/ngày`
                    : null,
                  form.preferredDaypart
                    ? optionLabel(daypartOptions, form.preferredDaypart)
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Thời gian, nhịp độ và cách thực hành'}
          </Text>
        </View>
        <View style={{ transform: [{ rotate: editing ? '-90deg' : '90deg' }] }}>
          <AppIcon name="chevron" size={18} />
        </View>
      </Pressable>
      {editing && (
        <Text style={styles.description}>
          Chọn nhịp phù hợp với bạn. Mọi mục đều không bắt buộc.
        </Text>
      )}

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

      {editing && (
        <View>
          <PlanPreferenceRow
            title="Điều bạn ưu tiên"
            icon="headphones"
            summary={optionLabel(focusOptions, form.preferredFocus)}
            expanded={expanded === 'preferredFocus'}
            onPress={() => toggleSection('preferredFocus')}
          >
            <ScalarChoices
              label="Bạn muốn ưu tiên điều gì lúc này?"
              value={form.preferredFocus}
              options={focusOptions}
              onChange={(value) => setScalar('preferredFocus', value)}
            />
          </PlanPreferenceRow>
          <PlanPreferenceRow
            title="Nhịp độ"
            icon="swap"
            summary={optionLabel(paceOptions, form.desiredPace)}
            expanded={expanded === 'desiredPace'}
            onPress={() => toggleSection('desiredPace')}
          >
            <ScalarChoices
              label="Nhịp độ nào phù hợp với bạn?"
              value={form.desiredPace}
              options={paceOptions}
              onChange={(value) => setScalar('desiredPace', value)}
            />
          </PlanPreferenceRow>
          <PlanPreferenceRow
            title="Thời gian mỗi ngày"
            icon="calendar"
            summary={
              form.dailyTimeBudgetMinutes
                ? `${form.dailyTimeBudgetMinutes} phút`
                : 'Chưa chọn'
            }
            expanded={expanded === 'dailyTimeBudgetMinutes'}
            onPress={() => toggleSection('dailyTimeBudgetMinutes')}
          >
            <ScalarChoices
              label="Bạn thường có bao nhiêu phút mỗi ngày?"
              value={form.dailyTimeBudgetMinutes}
              options={([5, 10, 15, 20, 30] as const).map(
                (minutes) => [minutes, `${minutes} phút`] as const,
              )}
              onChange={(value) => setScalar('dailyTimeBudgetMinutes', value)}
            />
          </PlanPreferenceRow>
          <PlanPreferenceRow
            title="Thời điểm thuận tiện"
            icon="calendar"
            summary={optionLabel(daypartOptions, form.preferredDaypart)}
            expanded={expanded === 'preferredDaypart'}
            onPress={() => toggleSection('preferredDaypart')}
          >
            <ScalarChoices
              label="Thời điểm nào thường thuận tiện?"
              value={form.preferredDaypart}
              options={daypartOptions}
              onChange={(value) => setScalar('preferredDaypart', value)}
            />
          </PlanPreferenceRow>
          <PlanPreferenceRow
            title="Cách thực hành"
            icon="book"
            summary={
              form.preferredActivityModes.length
                ? form.preferredActivityModes
                    .map((value) => optionLabel(modeOptions, value))
                    .join(' · ')
                : 'Chưa chọn'
            }
            expanded={expanded === 'preferredActivityModes'}
            onPress={() => toggleSection('preferredActivityModes')}
          >
            <MultiChoices
              label="Bạn thích cách thực hành nào?"
              hint="Có thể chọn nhiều lựa chọn."
              values={form.preferredActivityModes}
              options={modeOptions}
              onToggle={(value) => toggleArray('preferredActivityModes', value)}
            />
          </PlanPreferenceRow>
          <PlanPreferenceRow
            title="Điều cần hỗ trợ thêm"
            icon="chat"
            summary={
              form.commonBarriers.length
                ? form.commonBarriers
                    .map((value) => optionLabel(barrierOptions, value))
                    .join(' · ')
                : 'Chưa chọn'
            }
            expanded={expanded === 'commonBarriers'}
            onPress={() => toggleSection('commonBarriers')}
          >
            <MultiChoices
              label="Điều gì thường khiến bạn khó bắt đầu?"
              values={form.commonBarriers}
              options={barrierOptions}
              onToggle={(value) => toggleArray('commonBarriers', value)}
            />
          </PlanPreferenceRow>
        </View>
      )}

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

      {(editing || dirty) && (
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
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.shell,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.tealDeep,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 25,
  },
  description: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: spacing.sm,
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
    paddingHorizontal: spacing.md,
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
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
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
