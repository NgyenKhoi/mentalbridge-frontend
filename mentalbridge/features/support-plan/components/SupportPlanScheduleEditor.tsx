'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CalendarClock, Check, Clock3, RotateCcw, X } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import LightSelect from '@/components/LightSelect'
import { ApiError } from '@/lib/api/api-error'
import type {
  ActionScheduleInput,
  SupportPlanV3,
  UpdateActionScheduleRequest,
} from '../api/support-plan-contract'

type PlanAction = SupportPlanV3['focuses'][number]['actions'][number]
type ScheduleForm = Readonly<{
  enabled: boolean
  recurrenceType: ActionScheduleInput['recurrenceType']
  daysOfWeek: number[]
  preferredDaypart: NonNullable<ActionScheduleInput['preferredDaypart']> | ''
  localTime: string
  estimatedDurationMinutes: number
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
  plan: SupportPlanV3
  onDirtyChange?: (dirty: boolean) => void
  onSave: (
    actionId: string,
    request: UpdateActionScheduleRequest,
    idempotencyKey: string,
  ) => Promise<void>
  onReload: () => Promise<boolean | void>
  defaultOpenActionId?: string
}>

const weekdayOptions = [
  [1, 'Thứ Hai'],
  [2, 'Thứ Ba'],
  [3, 'Thứ Tư'],
  [4, 'Thứ Năm'],
  [5, 'Thứ Sáu'],
  [6, 'Thứ Bảy'],
  [7, 'Chủ nhật'],
] as const

const cadenceLabels = {
  ONCE: 'Một lần',
  DAILY: 'Mỗi ngày',
  WEEKLY: 'Theo tuần',
} as const

const daypartOptions = [
  { value: '', label: 'Giờ cụ thể' },
  { value: 'MORNING', label: 'Buổi sáng' },
  { value: 'AFTERNOON', label: 'Buổi chiều' },
  { value: 'EVENING', label: 'Buổi tối' },
  { value: 'FLEXIBLE', label: 'Linh hoạt' },
]

const fieldId = (actionId: string, field: string) =>
  `support-plan-${actionId}-${field}`

function currentSchedule(action: PlanAction) {
  return action.schedules.find((schedule) => schedule.status !== 'ENDED')
}

function localDate(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const value = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    )
    return `${value.year}-${value.month}-${value.day}`
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function addDays(value: string, count: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh'
}

function initialForm(action: PlanAction, planStatus: SupportPlanV3['status']) {
  const schedule = currentSchedule(action)
  const timezone = schedule?.timezone ?? browserTimezone()
  const today = localDate(timezone)
  const minimum = planStatus === 'ACTIVE' ? addDays(today, 1) : today
  const isoDay = new Date(`${today}T00:00:00Z`).getUTCDay() || 7
  return {
    enabled: Boolean(schedule),
    recurrenceType:
      action.actionType === 'REASSESSMENT_SCREENING'
        ? 'ONCE'
        : (schedule?.recurrenceType ?? 'WEEKLY'),
    daysOfWeek: schedule?.daysOfWeek.length
      ? [...schedule.daysOfWeek]
      : action.actionType === 'REASSESSMENT_SCREENING'
        ? []
        : [isoDay],
    preferredDaypart: schedule?.preferredDaypart ?? '',
    localTime: schedule?.localTime.slice(0, 5) ?? '18:00',
    estimatedDurationMinutes: schedule?.estimatedDurationMinutes ?? 10,
    timezone,
    effectiveFrom: schedule?.effectiveFrom ?? minimum,
    effectiveUntil: schedule?.effectiveUntil ?? '',
    reminderEnabled: schedule?.reminderEnabled ?? false,
  } satisfies ScheduleForm
}

function editableActions(plan: SupportPlanV3) {
  return plan.focuses
    .flatMap((focus) => focus.actions)
    .filter((action) => action.status !== 'ENDED')
}

function schedulable(action: PlanAction) {
  return !['PROFESSIONAL_SUPPORT', 'SELF_REPORT_REVIEW'].includes(
    action.actionType,
  )
}

function toRequest(
  form: ScheduleForm,
  planStatus: SupportPlanV3['status'],
): UpdateActionScheduleRequest {
  if (!form.enabled) return { schedule: null }
  const minimum = addDays(
    localDate(form.timezone),
    planStatus === 'ACTIVE' ? 1 : 0,
  )
  return {
    schedule: {
      recurrenceType: form.recurrenceType,
      daysOfWeek:
        form.recurrenceType === 'WEEKLY'
          ? [...form.daysOfWeek].sort((left, right) => left - right)
          : [],
      preferredDaypart: form.preferredDaypart || null,
      localTime: form.localTime,
      estimatedDurationMinutes: form.estimatedDurationMinutes,
      timezone: form.timezone.trim(),
      effectiveFrom:
        form.effectiveFrom < minimum ? minimum : form.effectiveFrom,
      effectiveUntil: form.effectiveUntil || null,
      reminderEnabled: form.reminderEnabled,
    },
  }
}

function formSignature(form: ScheduleForm) {
  return JSON.stringify({ ...form, daysOfWeek: [...form.daysOfWeek].sort() })
}

function reconcileForms(
  current: EditorFormsState,
  actions: PlanAction[],
  status: SupportPlanV3['status'],
  forcedActionId?: string,
): EditorFormsState {
  const nextForms: Record<string, ScheduleForm> = {}
  const nextInitial: Record<string, string> = {}
  for (const action of actions) {
    const authoritative = initialForm(action, status)
    const authoritativeSignature = formSignature(authoritative)
    const previous = current.forms[action.actionId]
    const previousInitial = current.initial[action.actionId]
    const dirty =
      previous && previousInitial && formSignature(previous) !== previousInitial
    const preserveDraft = dirty && forcedActionId !== action.actionId
    nextForms[action.actionId] = preserveDraft ? previous : authoritative
    nextInitial[action.actionId] = preserveDraft
      ? previousInitial
      : authoritativeSignature
  }
  return { forms: nextForms, initial: nextInitial }
}

export default function SupportPlanScheduleEditor(props: Props) {
  return <SupportPlanScheduleEditorState {...props} />
}

function SupportPlanScheduleEditorState({
  plan,
  onDirtyChange,
  onSave,
  onReload,
  defaultOpenActionId,
}: Props) {
  const actions = useMemo(() => editableActions(plan), [plan])
  const [activeActionId, setActiveActionId] = useState<string | null>(
    defaultOpenActionId ?? null,
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
          formSignature(form),
        ]),
      ),
    }
  })
  const [savingActionId, setSavingActionId] = useState<string>()
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [staleActionId, setStaleActionId] = useState<string>()
  const [validationFields, setValidationFields] = useState<
    Record<string, string>
  >({})
  const commandKeys = useRef<
    Record<string, { signature: string; key: string }>
  >({})
  const focusAfterUndo = useRef<string | undefined>(undefined)
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
      setStaleActionId((current) =>
        current === forcedActionId ? undefined : current,
      )
      setMessages((current) => ({ ...current, [forcedActionId]: '' }))
    }
  }

  const dirty = actions.some(
    (action) =>
      schedulable(action) &&
      forms[action.actionId] &&
      formSignature(forms[action.actionId]) !== initial[action.actionId],
  )

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])
  useEffect(() => {
    const actionId = focusAfterUndo.current
    if (!actionId) return
    focusAfterUndo.current = undefined
    const target =
      document.getElementById(fieldId(actionId, 'time')) ??
      document.getElementById(fieldId(actionId, 'enabled'))
    target?.focus()
  }, [editor])

  const update = (actionId: string, patch: Partial<ScheduleForm>) => {
    setEditor((current) => ({
      ...current,
      forms: {
        ...current.forms,
        [actionId]: { ...current.forms[actionId], ...patch },
      },
    }))
    setMessages((current) => ({ ...current, [actionId]: '' }))
    setValidationFields((current) => ({ ...current, [actionId]: '' }))
    setStaleActionId((current) => (current === actionId ? undefined : current))
  }

  const save = async (action: PlanAction) => {
    const form = forms[action.actionId]
    if (!form || savingActionId) return
    const invalid = (field: string, message: string) => {
      setMessages((current) => ({ ...current, [action.actionId]: message }))
      setValidationFields((current) => ({
        ...current,
        [action.actionId]: field,
      }))
      document.getElementById(fieldId(action.actionId, field))?.focus()
    }
    if (form.enabled && !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.localTime)) {
      invalid('time', 'Hãy chọn giờ hoạt động hợp lệ.')
      return
    }
    if (
      form.enabled &&
      (!Number.isInteger(form.estimatedDurationMinutes) ||
        form.estimatedDurationMinutes < 5 ||
        form.estimatedDurationMinutes > 180 ||
        form.estimatedDurationMinutes % 5 !== 0)
    ) {
      invalid('duration', 'Thời lượng cần từ 5 đến 180 phút, theo bước 5 phút.')
      return
    }
    if (form.enabled) {
      try {
        new Intl.DateTimeFormat('vi-VN', { timeZone: form.timezone.trim() })
      } catch {
        invalid(
          'timezone',
          'Hãy nhập múi giờ IANA hợp lệ, ví dụ Asia/Ho_Chi_Minh.',
        )
        return
      }
      if (!form.timezone.trim()) {
        invalid('timezone', 'Hãy nhập múi giờ cho lịch hoạt động.')
        return
      }
      if (!form.effectiveFrom) {
        invalid('starts', 'Hãy chọn ngày bắt đầu.')
        return
      }
    }
    if (
      form.enabled &&
      form.recurrenceType === 'WEEKLY' &&
      form.daysOfWeek.length === 0
    ) {
      invalid('day-1', 'Hãy chọn ít nhất một ngày trong tuần.')
      return
    }
    if (
      form.enabled &&
      form.effectiveUntil &&
      form.effectiveUntil < toRequest(form, plan.status).schedule!.effectiveFrom
    ) {
      invalid('ends', 'Ngày kết thúc cần bằng hoặc sau ngày bắt đầu.')
      return
    }

    const request = toRequest(form, plan.status)
    const signature = JSON.stringify(request)
    const existing = commandKeys.current[action.actionId]
    const key =
      existing?.signature === signature ? existing.key : crypto.randomUUID()
    commandKeys.current[action.actionId] = { signature, key }
    setSavingActionId(action.actionId)
    setMessages((current) => ({ ...current, [action.actionId]: '' }))
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
                [action.actionId]: formSignature(savedForm),
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
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 412)
      ) {
        setStaleActionId(action.actionId)
        setMessages((current) => ({
          ...current,
          [action.actionId]:
            'Kế hoạch vừa thay đổi ở nơi khác. Lựa chọn bạn đang nhập vẫn được giữ; hãy tải lịch mới trước khi lưu lại.',
        }))
      } else {
        setMessages((current) => ({
          ...current,
          [action.actionId]:
            'Chưa thể lưu lịch. Lựa chọn của bạn vẫn được giữ để thử lại.',
        }))
      }
    } finally {
      setSavingActionId(undefined)
    }
  }

  if (actions.length === 0) return null

  const planMutable = plan.status === 'DRAFT' || plan.status === 'ACTIVE'

  return (
    <section
      className="support-plan-cadence"
      aria-labelledby="support-plan-cadence-title"
    >
      <div className="support-plan-section-heading">
        <div>
          <span>
            {plan.status === 'DRAFT'
              ? 'Xem lại trước khi bắt đầu'
              : 'Điều chỉnh khi cần'}
          </span>
          <h3 id="support-plan-cadence-title">
            Nhịp hoạt động phù hợp với bạn
          </h3>
        </div>
      </div>
      <ul className="support-plan-cadence-intro">
        <li>Chọn số lần, thời điểm và thời lượng vừa sức.</li>
        <li>
          Giảm hoặc bỏ lịch không được xem là thất bại và không làm thay đổi nội
          dung đã được duyệt.
        </li>
      </ul>
      {!planMutable && (
        <p role="status">
          Hãy tiếp tục kế hoạch trước khi thay đổi lịch hoạt động tương lai.
        </p>
      )}
      <div className="support-plan-cadence-list">
        {actions.map((action) => {
          const form = forms[action.actionId]
          if (!form) return null
          if (!schedulable(action)) {
            return (
              <article
                className="support-plan-cadence-item is-read-only"
                key={action.actionId}
              >
                <div>
                  <h4>{action.presentation.title}</h4>
                  <p>
                    Mục này được thực hiện khi bạn chủ động cần đến, nên không
                    bị đưa vào lịch lặp lại.
                  </p>
                </div>
              </article>
            )
          }
          const itemDirty = formSignature(form) !== initial[action.actionId]
          const disabled = !planMutable || savingActionId === action.actionId
          const minimumDate = addDays(
            localDate(form.timezone),
            plan.status === 'ACTIVE' ? 1 : 0,
          )
          return (
            <article
              className={`support-plan-cadence-item${itemDirty ? ' is-dirty' : ''}`}
              key={action.actionId}
              aria-labelledby={fieldId(action.actionId, 'title')}
              aria-busy={savingActionId === action.actionId}
            >
              <div className="support-plan-cadence-item-heading">
                <span className="support-plan-cadence-icon" aria-hidden="true">
                  <CalendarClock />
                </span>
                <div className="support-plan-cadence-title">
                  <h4 id={fieldId(action.actionId, 'title')}>
                    {action.presentation.title}
                  </h4>
                  <div className="support-plan-cadence-summary-chips">
                    <span className="support-plan-cadence-badge">
                      <Clock3 aria-hidden="true" size={13} />
                      {form.enabled
                        ? `${cadenceLabels[form.recurrenceType]} · ${form.localTime} · ${form.estimatedDurationMinutes} phút`
                        : 'Không có lịch tương lai'}
                    </span>
                    {form.enabled &&
                      form.recurrenceType === 'WEEKLY' &&
                      form.daysOfWeek.length > 0 && (
                        <span className="support-plan-cadence-badge">
                          {form.daysOfWeek
                            .map(
                              (d) =>
                                weekdayOptions.find(([day]) => day === d)?.[1],
                            )
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      )}
                    {form.enabled && form.reminderEnabled && (
                      <span className="support-plan-cadence-badge is-reminder">
                        <Bell aria-hidden="true" size={12} />
                        Nhắc nhở
                      </span>
                    )}
                    {itemDirty && (
                      <span className="support-plan-cadence-badge is-dirty">
                        Có thay đổi chưa lưu
                      </span>
                    )}
                  </div>
                </div>
                <div className="support-plan-cadence-row-actions">
                  <button
                    type="button"
                    className="btn btn-outline support-plan-cadence-edit-btn"
                    disabled={!planMutable}
                    onClick={() => setActiveActionId(action.actionId)}
                  >
                    <CalendarClock size={16} aria-hidden="true" />
                    Chỉnh sửa lịch
                  </button>
                </div>
              </div>

              {messages[action.actionId] &&
                activeActionId !== action.actionId && (
                  <p
                    id={fieldId(action.actionId, 'message')}
                    role={
                      validationFields[action.actionId] ? 'alert' : 'status'
                    }
                    className="support-plan-cadence-message"
                  >
                    {messages[action.actionId]}
                  </p>
                )}

              <Dialog
                open={activeActionId === action.actionId}
                onOpenChange={(open) =>
                  setActiveActionId(open ? action.actionId : null)
                }
                labelledBy={fieldId(action.actionId, 'modal-title')}
                className="support-plan-dialog"
              >
                {activeActionId === action.actionId && (
                  <>
                    <div className="support-plan-dialog-header">
                  <div>
                    <p className="support-plan-dialog-kicker">
                      Cài đặt lịch hoạt động
                    </p>
                    <h3 id={fieldId(action.actionId, 'modal-title')}>
                      {action.presentation.title}
                    </h3>
                    <p className="support-plan-dialog-desc">
                      Thiết lập thời gian và nhịp độ thực hiện cho hoạt động này.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="support-plan-dialog-close"
                    aria-label="Đóng cửa sổ"
                    onClick={() => setActiveActionId(null)}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                <div className="support-plan-dialog-body">
                  <div className="support-plan-dialog-toggle-row">
                    <label className="support-plan-cadence-toggle">
                      <input
                        id={fieldId(action.actionId, 'enabled')}
                        className="support-plan-themed-checkbox"
                        type="checkbox"
                        checked={form.enabled}
                        disabled={disabled}
                        onChange={(event) =>
                          update(action.actionId, {
                            enabled: event.target.checked,
                          })
                        }
                      />
                      <span
                        className="support-plan-checkbox-mark"
                        aria-hidden="true"
                      >
                        <Check />
                      </span>
                      <span>Lên lịch</span>
                    </label>
                  </div>

                  {form.enabled && (
                    <div className="support-plan-cadence-fields">
                      <div className="support-plan-cadence-field">
                        <label
                          id={fieldId(action.actionId, 'cadence-label')}
                          htmlFor={fieldId(action.actionId, 'cadence')}
                        >
                          Nhịp hoạt động
                        </label>
                        <LightSelect
                          id={fieldId(action.actionId, 'cadence')}
                          labelledBy={fieldId(action.actionId, 'cadence-label')}
                          value={form.recurrenceType}
                          disabled={
                            disabled ||
                            action.actionType === 'REASSESSMENT_SCREENING'
                          }
                          onChange={(value) =>
                            update(action.actionId, {
                              recurrenceType:
                                value as ScheduleForm['recurrenceType'],
                              daysOfWeek:
                                value === 'WEEKLY'
                                  ? form.daysOfWeek.length
                                    ? form.daysOfWeek
                                    : [1]
                                  : [],
                            })
                          }
                          options={
                            action.actionType === 'REASSESSMENT_SCREENING'
                              ? [{ value: 'ONCE', label: 'Một lần' }]
                              : ['WEEKLY', 'DAILY', 'ONCE'].map((value) => ({
                                  value,
                                  label:
                                    cadenceLabels[
                                      value as keyof typeof cadenceLabels
                                    ],
                                }))
                          }
                        />
                      </div>
                      <div className="support-plan-cadence-field">
                        <label
                          id={fieldId(action.actionId, 'daypart-label')}
                          htmlFor={fieldId(action.actionId, 'daypart')}
                        >
                          Thời điểm trong ngày
                        </label>
                        <LightSelect
                          id={fieldId(action.actionId, 'daypart')}
                          labelledBy={fieldId(action.actionId, 'daypart-label')}
                          value={form.preferredDaypart}
                          disabled={disabled}
                          onChange={(value) =>
                            update(action.actionId, {
                              preferredDaypart:
                                value as ScheduleForm['preferredDaypart'],
                            })
                          }
                          options={daypartOptions}
                        />
                      </div>
                      <label>
                        Giờ địa phương
                        <input
                          id={fieldId(action.actionId, 'time')}
                          aria-invalid={
                            validationFields[action.actionId] === 'time' ||
                            undefined
                          }
                          aria-describedby={
                            validationFields[action.actionId] === 'time'
                              ? fieldId(action.actionId, 'message')
                              : undefined
                          }
                          type="time"
                          value={form.localTime}
                          disabled={disabled}
                          required
                          onChange={(event) =>
                            update(action.actionId, {
                              localTime: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Thời lượng dự kiến (phút)
                        <input
                          id={fieldId(action.actionId, 'duration')}
                          aria-invalid={
                            validationFields[action.actionId] === 'duration' ||
                            undefined
                          }
                          aria-describedby={
                            validationFields[action.actionId] === 'duration'
                              ? fieldId(action.actionId, 'message')
                              : undefined
                          }
                          type="number"
                          min="5"
                          max="180"
                          step="5"
                          value={form.estimatedDurationMinutes}
                          disabled={disabled}
                          onChange={(event) =>
                            update(action.actionId, {
                              estimatedDurationMinutes: Number(
                                event.target.value,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Múi giờ
                        <input
                          id={fieldId(action.actionId, 'timezone')}
                          aria-invalid={
                            validationFields[action.actionId] === 'timezone' ||
                            undefined
                          }
                          aria-describedby={
                            validationFields[action.actionId] === 'timezone'
                              ? fieldId(action.actionId, 'message')
                              : undefined
                          }
                          type="text"
                          list="support-plan-timezones"
                          value={form.timezone}
                          disabled={disabled}
                          onChange={(event) =>
                            update(action.actionId, {
                              timezone: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Bắt đầu từ
                        <input
                          id={fieldId(action.actionId, 'starts')}
                          aria-invalid={
                            validationFields[action.actionId] === 'starts' ||
                            undefined
                          }
                          aria-describedby={
                            validationFields[action.actionId] === 'starts'
                              ? fieldId(action.actionId, 'message')
                              : undefined
                          }
                          type="date"
                          min={minimumDate}
                          value={
                            form.effectiveFrom < minimumDate
                              ? minimumDate
                              : form.effectiveFrom
                          }
                          disabled={disabled}
                          onChange={(event) =>
                            update(action.actionId, {
                              effectiveFrom: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Kết thúc vào (không bắt buộc)
                        <input
                          id={fieldId(action.actionId, 'ends')}
                          aria-invalid={
                            validationFields[action.actionId] === 'ends' ||
                            undefined
                          }
                          aria-describedby={
                            validationFields[action.actionId] === 'ends'
                              ? fieldId(action.actionId, 'message')
                              : undefined
                          }
                          type="date"
                          min={
                            form.effectiveFrom < minimumDate
                              ? minimumDate
                              : form.effectiveFrom
                          }
                          value={form.effectiveUntil}
                          disabled={disabled}
                          onChange={(event) =>
                            update(action.actionId, {
                              effectiveUntil: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="support-plan-cadence-reminder">
                        <input
                          className="support-plan-themed-checkbox"
                          type="checkbox"
                          checked={form.reminderEnabled}
                          disabled={disabled}
                          onChange={(event) =>
                            update(action.actionId, {
                              reminderEnabled: event.target.checked,
                            })
                          }
                        />
                        <span
                          className="support-plan-checkbox-mark"
                          aria-hidden="true"
                        >
                          <Check />
                        </span>
                        <Bell aria-hidden="true" />
                        <span>Lưu tùy chọn nhắc nhở</span>
                      </label>
                      <small>
                        Thông báo tự động cho hoạt động chưa được kích hoạt. Bạn
                        vẫn có thể xem lịch trong kế hoạch.
                      </small>
                      {form.recurrenceType === 'WEEKLY' && (
                        <fieldset
                          className="support-plan-weekdays"
                          disabled={disabled}
                        >
                          <legend>Ngày trong tuần</legend>
                          {weekdayOptions.map(([day, label]) => (
                            <label key={day}>
                              <input
                                id={fieldId(action.actionId, `day-${day}`)}
                                className="support-plan-weekday-input"
                                type="checkbox"
                                checked={form.daysOfWeek.includes(day)}
                                onChange={(event) =>
                                  update(action.actionId, {
                                    daysOfWeek: event.target.checked
                                      ? [...form.daysOfWeek, day]
                                      : form.daysOfWeek.filter(
                                          (value) => value !== day,
                                        ),
                                  })
                                }
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </fieldset>
                      )}
                    </div>
                  )}

                  {messages[action.actionId] && (
                    <p
                      role={
                        validationFields[action.actionId] ? 'alert' : 'status'
                      }
                      className="support-plan-cadence-message"
                    >
                      {messages[action.actionId]}
                    </p>
                  )}
                </div>

                <div className="support-plan-dialog-footer support-plan-cadence-actions">
                  <span className="support-plan-cadence-dirty-status">
                    {itemDirty ? 'Có thay đổi chưa lưu' : 'Lịch đã lưu'}
                  </span>
                  {itemDirty && (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={disabled || !itemDirty}
                      onClick={() => {
                        const snapshot = JSON.parse(
                          initial[action.actionId],
                        ) as ScheduleForm
                        focusAfterUndo.current = action.actionId
                        update(action.actionId, snapshot)
                      }}
                    >
                      <RotateCcw aria-hidden="true" />
                      Hoàn tác
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={disabled || Boolean(savingActionId) || !itemDirty}
                    onClick={() => void save(action)}
                  >
                    <Check aria-hidden="true" />
                    {savingActionId === action.actionId
                      ? 'Đang lưu…'
                      : 'Lưu lịch'}
                  </button>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => setActiveActionId(null)}
                  >
                    Đóng
                  </button>
                  {staleActionId === action.actionId && (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => {
                        setReloadRequest({
                          actionId: action.actionId,
                          planVersion: plan.version,
                        })
                        void onReload().then((reloaded) => {
                          if (reloaded === false) setReloadRequest(undefined)
                        })
                      }}
                    >
                      Tải lịch mới
                    </button>
                  )}
                </div>
              </>
            )}
          </Dialog>
            </article>
          )
        })}
      </div>
      <datalist id="support-plan-timezones">
        <option value="Asia/Ho_Chi_Minh" />
        <option value="Asia/Bangkok" />
        <option value="Asia/Singapore" />
        <option value="UTC" />
      </datalist>
    </section>
  )
}
