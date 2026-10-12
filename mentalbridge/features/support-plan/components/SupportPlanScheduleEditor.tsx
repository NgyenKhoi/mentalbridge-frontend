'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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

type Props = Readonly<{
  plan: SupportPlanV3
  onDirtyChange?: (dirty: boolean) => void
  onSave: (
    actionId: string,
    request: UpdateActionScheduleRequest,
    idempotencyKey: string,
  ) => Promise<void>
  onReload: () => Promise<void>
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
    reminderEnabled: schedule?.reminderEnabled ?? true,
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

export default function SupportPlanScheduleEditor(props: Props) {
  return (
    <SupportPlanScheduleEditorState
      key={`${props.plan.supportPlanId}:${props.plan.version}`}
      {...props}
    />
  )
}

function SupportPlanScheduleEditorState({
  plan,
  onDirtyChange,
  onSave,
  onReload,
}: Props) {
  const actions = useMemo(() => editableActions(plan), [plan])
  const [forms, setForms] = useState<Record<string, ScheduleForm>>(() =>
    Object.fromEntries(
      actions.map((action) => [
        action.actionId,
        initialForm(action, plan.status),
      ]),
    ),
  )
  const [initial] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      actions.map((action) => {
        const form = initialForm(action, plan.status)
        return [action.actionId, formSignature(form)]
      }),
    ),
  )
  const [savingActionId, setSavingActionId] = useState<string>()
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [staleActionId, setStaleActionId] = useState<string>()
  const commandKeys = useRef<
    Record<string, { signature: string; key: string }>
  >({})

  const dirty = actions.some(
    (action) =>
      schedulable(action) &&
      forms[action.actionId] &&
      formSignature(forms[action.actionId]) !== initial[action.actionId],
  )

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

  const update = (actionId: string, patch: Partial<ScheduleForm>) => {
    setForms((current) => ({
      ...current,
      [actionId]: { ...current[actionId], ...patch },
    }))
    setMessages((current) => ({ ...current, [actionId]: '' }))
    setStaleActionId(undefined)
  }

  const save = async (action: PlanAction) => {
    const form = forms[action.actionId]
    if (!form) return
    if (
      form.enabled &&
      form.recurrenceType === 'WEEKLY' &&
      form.daysOfWeek.length === 0
    ) {
      setMessages((current) => ({
        ...current,
        [action.actionId]: 'Hãy chọn ít nhất một ngày trong tuần.',
      }))
      return
    }
    if (
      form.enabled &&
      form.effectiveUntil &&
      form.effectiveUntil < form.effectiveFrom
    ) {
      setMessages((current) => ({
        ...current,
        [action.actionId]: 'Ngày kết thúc cần bằng hoặc sau ngày bắt đầu.',
      }))
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
      <p className="support-plan-cadence-intro">
        Chọn số lần, thời điểm và thời lượng vừa sức. Giảm hoặc bỏ lịch không
        được xem là thất bại và không làm thay đổi nội dung đã được duyệt.
      </p>
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
              className="support-plan-cadence-item"
              key={action.actionId}
            >
              <div className="support-plan-cadence-item-heading">
                <div>
                  <h4>{action.presentation.title}</h4>
                  <p>
                    {form.enabled
                      ? `${cadenceLabels[form.recurrenceType]} · ${form.localTime} · ${form.estimatedDurationMinutes} phút`
                      : 'Không có lịch tương lai'}
                  </p>
                </div>
                <label className="support-plan-cadence-toggle">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    disabled={disabled}
                    onChange={(event) =>
                      update(action.actionId, { enabled: event.target.checked })
                    }
                  />
                  <span>Lên lịch</span>
                </label>
              </div>

              {form.enabled && (
                <div className="support-plan-cadence-fields">
                  <label>
                    Nhịp hoạt động
                    <select
                      value={form.recurrenceType}
                      disabled={
                        disabled ||
                        action.actionType === 'REASSESSMENT_SCREENING'
                      }
                      onChange={(event) =>
                        update(action.actionId, {
                          recurrenceType: event.target
                            .value as ScheduleForm['recurrenceType'],
                          daysOfWeek:
                            event.target.value === 'WEEKLY'
                              ? form.daysOfWeek.length
                                ? form.daysOfWeek
                                : [1]
                              : [],
                        })
                      }
                    >
                      {action.actionType === 'REASSESSMENT_SCREENING' ? (
                        <option value="ONCE">Một lần</option>
                      ) : (
                        <>
                          <option value="WEEKLY">Theo tuần</option>
                          <option value="DAILY">Mỗi ngày</option>
                          <option value="ONCE">Một lần</option>
                        </>
                      )}
                    </select>
                  </label>
                  <label>
                    Thời điểm trong ngày
                    <select
                      value={form.preferredDaypart}
                      disabled={disabled}
                      onChange={(event) =>
                        update(action.actionId, {
                          preferredDaypart: event.target
                            .value as ScheduleForm['preferredDaypart'],
                        })
                      }
                    >
                      <option value="">Giờ cụ thể</option>
                      <option value="MORNING">Buổi sáng</option>
                      <option value="AFTERNOON">Buổi chiều</option>
                      <option value="EVENING">Buổi tối</option>
                      <option value="FLEXIBLE">Linh hoạt</option>
                    </select>
                  </label>
                  <label>
                    Giờ địa phương
                    <input
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
                      type="number"
                      min="5"
                      max="180"
                      step="5"
                      value={form.estimatedDurationMinutes}
                      disabled={disabled}
                      onChange={(event) =>
                        update(action.actionId, {
                          estimatedDurationMinutes: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Múi giờ
                    <input
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
                      type="checkbox"
                      checked={form.reminderEnabled}
                      disabled={disabled}
                      onChange={(event) =>
                        update(action.actionId, {
                          reminderEnabled: event.target.checked,
                        })
                      }
                    />
                    Nhắc tôi về hoạt động này
                  </label>
                  {form.recurrenceType === 'WEEKLY' && (
                    <fieldset
                      className="support-plan-weekdays"
                      disabled={disabled}
                    >
                      <legend>Ngày trong tuần</legend>
                      {weekdayOptions.map(([day, label]) => (
                        <label key={day}>
                          <input
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
                          {label}
                        </label>
                      ))}
                    </fieldset>
                  )}
                </div>
              )}

              <div className="support-plan-cadence-actions">
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={disabled || !itemDirty}
                  onClick={() => void save(action)}
                >
                  {savingActionId === action.actionId
                    ? 'Đang lưu…'
                    : 'Lưu lịch'}
                </button>
                {staleActionId === action.actionId && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => void onReload()}
                  >
                    Tải lịch mới
                  </button>
                )}
              </div>
              {messages[action.actionId] && (
                <p role="status" className="support-plan-cadence-message">
                  {messages[action.actionId]}
                </p>
              )}
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
