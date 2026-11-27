import { randomUUID } from 'expo-crypto'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { AppIcon, type AppIconName } from '@/components/AppIcon'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type {
  ActionScheduleInput,
  PlanActionProjection,
  SupportPlanActions,
  UpdateActionScheduleRequest,
} from './support-plan-contract'

type ScheduleForm = Readonly<{
  enabled: boolean
  recurrenceType: ActionScheduleInput['recurrenceType']
  daysOfWeek: number[]
  preferredDaypart: NonNullable<ActionScheduleInput['preferredDaypart']> | null
  localTime: string
  duration: string
  timezone: string
  effectiveFrom: string
  effectiveUntil: string
  reminderEnabled: boolean
}>

type EditorFormsState = Readonly<{
  forms: Record<string, ScheduleForm>
  initial: Record<string, string>
}>

type Props = Readonly<{
  plan: SupportPlanActions
  disabled: boolean
  onDirtyChange?: (dirty: boolean) => void
  onSave: (
    actionId: string,
    request: UpdateActionScheduleRequest,
    idempotencyKey: string,
  ) => Promise<void>
  onReload: () =>
    SupportPlanActions | undefined | Promise<SupportPlanActions | undefined>
}>

const recurrenceOptions = [
  ['WEEKLY', 'Theo tuần'],
  ['DAILY', 'Mỗi ngày'],
  ['ONCE', 'Một lần'],
] as const

const daypartOptions = [
  [null, 'Giờ cụ thể'],
  ['MORNING', 'Buổi sáng'],
  ['AFTERNOON', 'Buổi chiều'],
  ['EVENING', 'Buổi tối'],
  ['FLEXIBLE', 'Linh hoạt'],
] as const

const weekdayOptions = [
  [1, 'T2'],
  [2, 'T3'],
  [3, 'T4'],
  [4, 'T5'],
  [5, 'T6'],
  [6, 'T7'],
  [7, 'CN'],
] as const

function ActivityIcon({
  type,
}: Readonly<{ type: PlanActionProjection['actionType'] }>) {
  if (type === 'EMOTION_CHECK_IN')
    return (
      <Image
        accessible={false}
        source={require('../../assets/home-shortcuts/emotion.png')}
        style={styles.activityImage}
      />
    )
  const icons: Record<PlanActionProjection['actionType'], AppIconName> = {
    RESOURCE: 'book',
    JOURNAL: 'book',
    EMOTION_CHECK_IN: 'chat',
    ROUTINE_SELF_MANAGEMENT: 'clipboard',
    PROFESSIONAL_SUPPORT: 'user',
    REASSESSMENT_SCREENING: 'clipboard',
    SELF_REPORT_REVIEW: 'calendar',
  }
  return <AppIcon name={icons[type]} size={22} />
}

function scheduleSummary(form: ScheduleForm) {
  if (!form.enabled) return 'Chưa lên lịch'
  const recurrence =
    form.recurrenceType === 'WEEKLY'
      ? weekdayOptions
          .filter(([day]) => form.daysOfWeek.includes(day))
          .map(([, label]) => label)
          .join(', ')
      : form.recurrenceType === 'DAILY'
        ? 'Mỗi ngày'
        : 'Một lần'
  const time = form.preferredDaypart
    ? daypartOptions.find(([value]) => value === form.preferredDaypart)?.[1]
    : form.localTime
  return `${recurrence} · ${time} · ${form.duration} phút`
}

function localDate(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    )
    return `${values.year}-${values.month}-${values.day}`
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function addDays(value: string, count: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

function currentSchedule(action: PlanActionProjection) {
  return action.schedules.find((schedule) => schedule.status !== 'ENDED')
}

function canSchedule(action: PlanActionProjection) {
  return !['PROFESSIONAL_SUPPORT', 'SELF_REPORT_REVIEW'].includes(
    action.actionType,
  )
}

function initialForm(
  action: PlanActionProjection,
  planStatus: SupportPlanActions['status'],
): ScheduleForm {
  const schedule = currentSchedule(action)
  const timezone = schedule?.timezone ?? 'Asia/Ho_Chi_Minh'
  const today = localDate(timezone)
  const isoDay = new Date(`${today}T00:00:00Z`).getUTCDay() || 7
  return {
    enabled: Boolean(schedule),
    recurrenceType:
      action.actionType === 'REASSESSMENT_SCREENING'
        ? 'ONCE'
        : (schedule?.recurrenceType ?? 'WEEKLY'),
    daysOfWeek: schedule?.daysOfWeek.length
      ? schedule.daysOfWeek
      : action.actionType === 'REASSESSMENT_SCREENING'
        ? []
        : [isoDay],
    preferredDaypart: schedule?.preferredDaypart ?? null,
    localTime: schedule?.localTime.slice(0, 5) ?? '18:00',
    duration: String(schedule?.estimatedDurationMinutes ?? 10),
    timezone,
    effectiveFrom:
      schedule?.effectiveFrom ??
      addDays(today, planStatus === 'ACTIVE' ? 1 : 0),
    effectiveUntil: schedule?.effectiveUntil ?? '',
    reminderEnabled: schedule?.reminderEnabled ?? true,
  }
}

function signature(form: ScheduleForm) {
  return JSON.stringify({ ...form, daysOfWeek: [...form.daysOfWeek].sort() })
}

function scheduleRequest(
  form: ScheduleForm,
  status: SupportPlanActions['status'],
): UpdateActionScheduleRequest {
  if (!form.enabled) return { schedule: null }
  const minimum = addDays(localDate(form.timezone), status === 'ACTIVE' ? 1 : 0)
  return {
    schedule: {
      recurrenceType: form.recurrenceType,
      daysOfWeek:
        form.recurrenceType === 'WEEKLY'
          ? [...form.daysOfWeek].sort((left, right) => left - right)
          : [],
      preferredDaypart: form.preferredDaypart,
      localTime:
        form.localTime.length === 5 ? `${form.localTime}:00` : form.localTime,
      estimatedDurationMinutes: Number(form.duration),
      timezone: form.timezone.trim(),
      effectiveFrom:
        form.effectiveFrom < minimum ? minimum : form.effectiveFrom,
      effectiveUntil: form.effectiveUntil || null,
      reminderEnabled: form.reminderEnabled,
    },
  }
}

function reconcileForms(
  current: EditorFormsState,
  actions: PlanActionProjection[],
  status: SupportPlanActions['status'],
  forcedActionId?: string,
): EditorFormsState {
  const nextForms: Record<string, ScheduleForm> = {}
  const nextInitial: Record<string, string> = {}
  for (const action of actions) {
    const authoritative = initialForm(action, status)
    const authoritativeSignature = signature(authoritative)
    const previous = current.forms[action.actionId]
    const previousInitial = current.initial[action.actionId]
    const dirty =
      previous && previousInitial && signature(previous) !== previousInitial
    const preserveDraft = dirty && forcedActionId !== action.actionId
    nextForms[action.actionId] = preserveDraft ? previous : authoritative
    nextInitial[action.actionId] = preserveDraft
      ? previousInitial
      : authoritativeSignature
  }
  return { forms: nextForms, initial: nextInitial }
}

function Choice({
  disabled,
  label,
  selected,
  onPress,
}: Readonly<{
  disabled: boolean
  label: string
  selected: boolean
  onPress: () => void
}>) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  )
}

export function SupportPlanScheduleEditor(props: Props) {
  return <SupportPlanScheduleEditorState {...props} />
}

function SupportPlanScheduleEditorState({
  plan,
  disabled,
  onDirtyChange,
  onSave,
  onReload,
}: Props) {
  const actions = useMemo(
    () =>
      plan.focuses
        .flatMap((focus) => focus.actions)
        .filter((action) => action.status !== 'ENDED'),
    [plan.focuses],
  )
  const [editor, setEditor] = useState<EditorFormsState>(() => {
    const forms = Object.fromEntries(
      actions.map((action) => [
        action.actionId,
        initialForm(action, plan.status),
      ]),
    )
    return {
      forms,
      initial: Object.fromEntries(
        Object.entries(forms).map(([actionId, form]) => [
          actionId,
          signature(form),
        ]),
      ),
    }
  })
  const [saving, setSaving] = useState<string>()
  const [expandedAction, setExpandedAction] = useState<string>()
  const [advancedAction, setAdvancedAction] = useState<string>()
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [stale, setStale] = useState<string>()
  const commandKeys = useRef<
    Record<string, { signature: string; key: string }>
  >({})
  const [reloadRequest, setReloadRequest] = useState<{
    actionId: string
    planVersion: number
  }>()
  const [previousPlan, setPreviousPlan] = useState(plan)

  const { forms, initial } = editor

  if (previousPlan !== plan) {
    const forcedActionId =
      reloadRequest && reloadRequest.planVersion !== plan.version
        ? reloadRequest.actionId
        : undefined
    setPreviousPlan(plan)
    setEditor((current) =>
      reconcileForms(current, actions, plan.status, forcedActionId),
    )
    if (forcedActionId) {
      setReloadRequest(undefined)
      setStale((current) => (current === forcedActionId ? undefined : current))
      setMessages((current) => ({ ...current, [forcedActionId]: '' }))
    }
  }

  const dirty = actions.some((action) => {
    const form = forms[action.actionId]
    return (
      canSchedule(action) &&
      form !== undefined &&
      signature(form) !== initial[action.actionId]
    )
  })
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

  const update = (actionId: string, patch: Partial<ScheduleForm>) => {
    setEditor((current) => {
      const form = current.forms[actionId]
      return form
        ? {
            ...current,
            forms: {
              ...current.forms,
              [actionId]: { ...form, ...patch },
            },
          }
        : current
    })
    setMessages((current) => ({ ...current, [actionId]: '' }))
    setStale(undefined)
  }

  const save = async (action: PlanActionProjection) => {
    const form = forms[action.actionId]
    if (!form) return
    const duration = Number(form.duration)
    if (
      form.enabled &&
      (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.localTime) ||
        !Number.isInteger(duration) ||
        duration < 5 ||
        duration > 180 ||
        duration % 5 !== 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(form.effectiveFrom) ||
        (form.recurrenceType === 'WEEKLY' && form.daysOfWeek.length === 0))
    ) {
      setMessages((current) => ({
        ...current,
        [action.actionId]:
          'Kiểm tra lại giờ, thời lượng, ngày bắt đầu và các ngày trong tuần.',
      }))
      return
    }
    const request = scheduleRequest(form, plan.status)
    const requestSignature = JSON.stringify(request)
    const currentKey = commandKeys.current[action.actionId]
    const key =
      currentKey?.signature === requestSignature ? currentKey.key : randomUUID()
    commandKeys.current[action.actionId] = {
      signature: requestSignature,
      key,
    }
    setSaving(action.actionId)
    try {
      await onSave(action.actionId, request, key)
      delete commandKeys.current[action.actionId]
      setEditor((current) => {
        const savedForm = current.forms[action.actionId]
        return savedForm
          ? {
              ...current,
              initial: {
                ...current.initial,
                [action.actionId]: signature(savedForm),
              },
            }
          : current
      })
      setMessages((current) => ({
        ...current,
        [action.actionId]: form.enabled
          ? 'Đã lưu lịch cho các hoạt động tương lai.'
          : 'Đã bỏ lịch tương lai. Điều này không ảnh hưởng đến kết quả kế hoạch.',
      }))
      setExpandedAction((current) =>
        current === action.actionId ? undefined : current,
      )
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 412)
      ) {
        setStale(action.actionId)
        setMessages((current) => ({
          ...current,
          [action.actionId]:
            'Kế hoạch vừa thay đổi ở nơi khác. Lựa chọn bạn đang nhập vẫn được giữ.',
        }))
      } else {
        setMessages((current) => ({
          ...current,
          [action.actionId]:
            'Chưa thể lưu lịch. Lựa chọn của bạn vẫn được giữ.',
        }))
      }
    } finally {
      setSaving(undefined)
    }
  }

  if (actions.length === 0) return null

  return (
    <View style={styles.panel}>
      <View style={styles.headingRow}>
        <Text accessibilityRole="header" style={styles.title}>
          Hoạt động &amp; lịch
        </Text>
        <Text style={styles.count}>{actions.length} hoạt động</Text>
      </View>
      <Text style={styles.supporting}>
        Chạm hoạt động để xem và chỉnh. Bạn có thể giảm hoặc bỏ lịch bất cứ lúc
        nào.
      </Text>
      {actions.map((action) => {
        const form = forms[action.actionId]
        if (!form) return null
        const itemDisabled = disabled || saving === action.actionId
        const itemDirty =
          canSchedule(action) && signature(form) !== initial[action.actionId]
        const expanded = expandedAction === action.actionId
        const focus = plan.focuses.find((entry) =>
          entry.actions.some((item) => item.actionId === action.actionId),
        )
        const firstInFocus =
          focus?.actions.find((item) => item.status !== 'ENDED')?.actionId ===
          action.actionId
        return (
          <View key={action.actionId}>
            {firstInFocus && (
              <Text style={styles.focusTitle}>{focus?.title}</Text>
            )}
            <View style={[styles.item, expanded && styles.itemExpanded]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Chỉnh hoạt động: ${action.presentation.title}`}
                accessibilityState={{
                  expanded,
                  disabled: saving === action.actionId,
                }}
                disabled={saving === action.actionId}
                onPress={() =>
                  setExpandedAction(expanded ? undefined : action.actionId)
                }
                style={({ pressed }) => [
                  styles.activityRow,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.activityIcon,
                    action.actionType === 'JOURNAL' && styles.journalIcon,
                  ]}
                >
                  <ActivityIcon type={action.actionType} />
                </View>
                <View style={styles.activityCopy}>
                  <Text style={styles.itemTitle}>
                    {action.presentation.title}
                  </Text>
                  <Text style={styles.supporting}>
                    {canSchedule(action)
                      ? scheduleSummary(form)
                      : 'Thực hiện khi cần'}
                  </Text>
                  {itemDirty && (
                    <Text style={styles.unsaved}>Chưa lưu thay đổi</Text>
                  )}
                </View>
                <View
                  style={{
                    transform: [{ rotate: expanded ? '-90deg' : '90deg' }],
                  }}
                >
                  <AppIcon name="chevron" size={17} />
                </View>
              </Pressable>
              {expanded && (
                <View style={styles.editorContent}>
                  {action.presentation.summary && (
                    <Text style={styles.supporting}>
                      {action.presentation.summary}
                    </Text>
                  )}
                  {action.actionType === 'EMOTION_CHECK_IN' && (
                    <Text style={styles.supporting}>
                      Ghi nhận theo nhịp bạn đã chọn; việc lưu cảm xúc không tự
                      thay đổi kế hoạch.
                    </Text>
                  )}
                  {canSchedule(action) ? (
                    <>
                      <Choice
                        disabled={itemDisabled}
                        label={
                          form.enabled ? '✓ Đang lên lịch' : 'Không lên lịch'
                        }
                        selected={form.enabled}
                        onPress={() =>
                          update(action.actionId, { enabled: !form.enabled })
                        }
                      />
                      {form.enabled && (
                        <>
                          <Text style={styles.label}>Nhịp hoạt động</Text>
                          <View style={styles.wrap}>
                            {(action.actionType === 'REASSESSMENT_SCREENING'
                              ? recurrenceOptions.filter(
                                  ([value]) => value === 'ONCE',
                                )
                              : recurrenceOptions
                            ).map(([value, label]) => (
                              <Choice
                                key={value}
                                disabled={itemDisabled}
                                label={label}
                                selected={form.recurrenceType === value}
                                onPress={() =>
                                  update(action.actionId, {
                                    recurrenceType: value,
                                    daysOfWeek:
                                      value === 'WEEKLY'
                                        ? form.daysOfWeek.length
                                          ? form.daysOfWeek
                                          : [1]
                                        : [],
                                  })
                                }
                              />
                            ))}
                          </View>
                          {form.recurrenceType === 'WEEKLY' && (
                            <>
                              <Text style={styles.label}>Ngày trong tuần</Text>
                              <View style={styles.wrap}>
                                {weekdayOptions.map(([day, label]) => (
                                  <Choice
                                    key={day}
                                    disabled={itemDisabled}
                                    label={label}
                                    selected={form.daysOfWeek.includes(day)}
                                    onPress={() =>
                                      update(action.actionId, {
                                        daysOfWeek: form.daysOfWeek.includes(
                                          day,
                                        )
                                          ? form.daysOfWeek.filter(
                                              (value) => value !== day,
                                            )
                                          : [...form.daysOfWeek, day],
                                      })
                                    }
                                  />
                                ))}
                              </View>
                            </>
                          )}
                          <Text style={styles.label}>Thời điểm trong ngày</Text>
                          <View style={styles.wrap}>
                            {daypartOptions.map(([value, label]) => (
                              <Choice
                                key={value ?? 'EXACT'}
                                disabled={itemDisabled}
                                label={label}
                                selected={form.preferredDaypart === value}
                                onPress={() =>
                                  update(action.actionId, {
                                    preferredDaypart: value,
                                  })
                                }
                              />
                            ))}
                          </View>
                          <View style={styles.inputRow}>
                            <View style={styles.inputField}>
                              <Text style={styles.label}>Giờ</Text>
                              <TextInput
                                accessibilityLabel="Giờ địa phương"
                                editable={!itemDisabled}
                                inputMode="text"
                                onChangeText={(value) =>
                                  update(action.actionId, { localTime: value })
                                }
                                placeholder="HH:mm"
                                style={styles.input}
                                value={form.localTime}
                              />
                            </View>
                            <View style={styles.inputField}>
                              <Text style={styles.label}>
                                Thời lượng (phút)
                              </Text>
                              <TextInput
                                accessibilityLabel="Thời lượng dự kiến (phút)"
                                editable={!itemDisabled}
                                inputMode="numeric"
                                onChangeText={(value) =>
                                  update(action.actionId, { duration: value })
                                }
                                placeholder="5–180 phút"
                                style={styles.input}
                                value={form.duration}
                              />
                            </View>
                          </View>
                          <View style={styles.inputRow}>
                            <View style={styles.inputField}>
                              <Text style={styles.label}>Từ ngày</Text>
                              <TextInput
                                accessibilityLabel="Ngày bắt đầu"
                                editable={!itemDisabled}
                                onChangeText={(value) =>
                                  update(action.actionId, {
                                    effectiveFrom: value,
                                  })
                                }
                                placeholder="YYYY-MM-DD"
                                style={styles.input}
                                value={form.effectiveFrom}
                              />
                            </View>
                            <View style={styles.inputField}>
                              <Text style={styles.label}>
                                Đến ngày (tùy chọn)
                              </Text>
                              <TextInput
                                accessibilityLabel="Ngày kết thúc (không bắt buộc)"
                                editable={!itemDisabled}
                                onChangeText={(value) =>
                                  update(action.actionId, {
                                    effectiveUntil: value,
                                  })
                                }
                                placeholder="YYYY-MM-DD"
                                style={styles.input}
                                value={form.effectiveUntil}
                              />
                            </View>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Chỉnh múi giờ"
                            accessibilityState={{
                              expanded: advancedAction === action.actionId,
                            }}
                            onPress={() =>
                              setAdvancedAction(
                                advancedAction === action.actionId
                                  ? undefined
                                  : action.actionId,
                              )
                            }
                            style={styles.timezoneTrigger}
                          >
                            <Text style={styles.supporting}>
                              Múi giờ:{' '}
                              {form.timezone === 'Asia/Ho_Chi_Minh'
                                ? 'Việt Nam (GMT+7)'
                                : form.timezone}
                            </Text>
                            <AppIcon name="chevron" size={15} />
                          </Pressable>
                          {advancedAction === action.actionId && (
                            <TextInput
                              accessibilityLabel="Múi giờ"
                              editable={!itemDisabled}
                              onChangeText={(value) =>
                                update(action.actionId, { timezone: value })
                              }
                              placeholder="Asia/Ho_Chi_Minh"
                              style={styles.input}
                              value={form.timezone}
                            />
                          )}
                          <Choice
                            disabled={itemDisabled}
                            label={
                              form.reminderEnabled
                                ? '✓ Có nhắc tôi'
                                : 'Không nhắc tôi'
                            }
                            selected={form.reminderEnabled}
                            onPress={() =>
                              update(action.actionId, {
                                reminderEnabled: !form.reminderEnabled,
                              })
                            }
                          />
                        </>
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: itemDisabled || !itemDirty,
                        }}
                        disabled={itemDisabled || !itemDirty}
                        onPress={() => void save(action)}
                        style={({ pressed }) => [
                          styles.save,
                          (itemDisabled || !itemDirty) && styles.disabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.saveText}>
                          {saving === action.actionId
                            ? 'Đang lưu…'
                            : 'Lưu lịch'}
                        </Text>
                      </Pressable>
                      {stale === action.actionId && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={async () => {
                            const actionId = action.actionId
                            setReloadRequest({
                              actionId,
                              planVersion: plan.version,
                            })
                            const authoritative = await onReload()
                            if (!authoritative) {
                              setReloadRequest(undefined)
                              return
                            }
                            const authoritativeActions = authoritative.focuses
                              .flatMap((focus) => focus.actions)
                              .filter(
                                (candidate) => candidate.status !== 'ENDED',
                              )
                            setEditor((current) =>
                              reconcileForms(
                                current,
                                authoritativeActions,
                                authoritative.status,
                                actionId,
                              ),
                            )
                            setReloadRequest(undefined)
                            setStale((current) =>
                              current === actionId ? undefined : current,
                            )
                            setMessages((current) => ({
                              ...current,
                              [actionId]: '',
                            }))
                          }}
                          style={styles.reload}
                        >
                          <Text style={styles.reloadText}>Tải lịch mới</Text>
                        </Pressable>
                      )}
                    </>
                  ) : (
                    <Text style={styles.supporting}>
                      Bạn chủ động thực hiện mục này khi cần, không có lịch lặp
                      lại.
                    </Text>
                  )}
                </View>
              )}
              {messages[action.actionId] && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.supporting, styles.message]}
                >
                  {messages[action.actionId]}
                </Text>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.tealDeep,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  body: { color: colors.ink, fontSize: typography.body, lineHeight: 24 },
  supporting: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  item: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    borderColor: colors.line,
    borderRadius: radii.control,
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
  input: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  save: {
    alignItems: 'center',
    backgroundColor: colors.tealDeep,
    borderRadius: radii.control,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  saveText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  reload: { minHeight: 44, justifyContent: 'center' },
  reloadText: { color: colors.tealDeep, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.68 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  count: {
    color: colors.tealDeep,
    backgroundColor: colors.surfaceSoft,
    overflow: 'hidden',
    borderRadius: radii.pill,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  focusTitle: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    gap: spacing.md,
    padding: spacing.md,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalIcon: { backgroundColor: '#F5EFFA' },
  activityImage: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    tintColor: colors.tealDeep,
  },
  activityCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  itemExpanded: { borderColor: colors.teal },
  editorContent: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: spacing.md,
    gap: spacing.md,
  },
  inputRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  inputField: { flex: 1, minWidth: 125, gap: spacing.sm },
  timezoneTrigger: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  unsaved: { color: '#805A24', fontSize: 12, fontWeight: '700' },
  message: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
})
