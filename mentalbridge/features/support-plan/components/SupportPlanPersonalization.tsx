'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api/api-error'
import {
  getSupportPlanPersonalization,
  replaceSupportPlanPersonalization,
  type SupportPlanPersonalizationAuthority,
} from '../api/browser-support-plan'
import type {
  ReplaceSupportPlanPersonalizationRequest,
  SupportPlanPersonalization,
} from '../api/support-plan-contract'
import SupportPlanIcon from './SupportPlanIcon'

type FormValue = ReplaceSupportPlanPersonalizationRequest
export type SupportPlanReviewReasonCode =
  SupportPlanPersonalization['planReview']['reasonCode']
type ScalarKey =
  | 'preferredFocus'
  | 'desiredPace'
  | 'dailyTimeBudgetMinutes'
  | 'preferredDaypart'
type ArrayKey = 'preferredActivityModes' | 'commonBarriers'

const EMPTY_FORM: FormValue = {
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
    preferredFocus: value.preferredFocus ?? null,
    desiredPace: value.desiredPace ?? null,
    dailyTimeBudgetMinutes: value.dailyTimeBudgetMinutes ?? null,
    preferredDaypart: value.preferredDaypart ?? null,
    preferredActivityModes: [...value.preferredActivityModes],
    commonBarriers: [...value.commonBarriers],
  }
}

function errorMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    (error.status === 412 ||
      error.code === 'SUPPORT_PLAN_PERSONALIZATION_VERSION_MISMATCH')
  )
    return 'Lựa chọn này đã được cập nhật ở nơi khác. Tải bản mới nhất trước khi lưu lại.'
  if (error instanceof ApiError && error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  return 'Chưa thể lưu lựa chọn lúc này. Những gì bạn vừa chọn vẫn được giữ trên màn hình.'
}

function ChoiceGroup<T extends string | number>({
  legend,
  hint,
  name,
  value,
  options,
  onChange,
}: Readonly<{
  legend: string
  hint?: string
  name: string
  value: T | null | undefined
  options: ReadonlyArray<readonly [T, string]>
  onChange: (value: T | null) => void
}>) {
  return (
    <fieldset className="mb-personalization-fieldset">
      <legend>{legend}</legend>
      {hint && <p className="mb-personalization-hint">{hint}</p>}
      <div className="mb-personalization-choices">
        {options.map(([option, label]) => (
          <label
            key={String(option)}
            className={value === option ? 'is-selected' : undefined}
          >
            <input
              type="radio"
              name={name}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span>{label}</span>
          </label>
        ))}
        <button
          type="button"
          className={value == null ? 'is-selected' : undefined}
          aria-pressed={value == null}
          onClick={() => onChange(null)}
        >
          Chưa cần chọn
        </button>
      </div>
    </fieldset>
  )
}

function MultiChoiceGroup({
  legend,
  hint,
  field,
  values,
  options,
  onToggle,
}: Readonly<{
  legend: string
  hint?: string
  field: string
  values: readonly string[]
  options: ReadonlyArray<readonly [string, string]>
  onToggle: (value: string) => void
}>) {
  return (
    <fieldset className="mb-personalization-fieldset">
      <legend>{legend}</legend>
      {hint && <p className="mb-personalization-hint">{hint}</p>}
      <div className="mb-personalization-choices">
        {options.map(([option, label]) => (
          <label
            key={option}
            className={values.includes(option) ? 'is-selected' : undefined}
          >
            <input
              type="checkbox"
              name={field}
              checked={values.includes(option)}
              onChange={() => onToggle(option)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function SupportPlanPersonalization({
  onReviewPlan,
  onDirtyChange,
  onSaved,
}: Readonly<{
  onReviewPlan: (reasonCode: SupportPlanReviewReasonCode) => void
  onDirtyChange?: (dirty: boolean) => void
  onSaved?: (saved: SupportPlanPersonalizationAuthority) => void
}>) {
  const [authority, setAuthority] =
    useState<SupportPlanPersonalizationAuthority>()
  const [form, setForm] = useState<FormValue>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()
  const [conflict, setConflict] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    setConflict(false)
    try {
      const current = await getSupportPlanPersonalization()
      setAuthority(current)
      setForm(formFrom(current.value))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void getSupportPlanPersonalization()
      .then((current) => {
        if (!active) return
        setAuthority(current)
        setForm(formFrom(current.value))
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const dirty = useMemo(
    () =>
      authority !== undefined &&
      JSON.stringify(form) !== JSON.stringify(formFrom(authority.value)),
    [authority, form],
  )
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const setScalar = <K extends ScalarKey>(key: K, value: FormValue[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setMessage(undefined)
    setError(undefined)
  }

  const toggleArray = (key: ArrayKey, value: string) => {
    setForm((current) => {
      const values = current[key] as string[]
      return {
        ...current,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      }
    })
    setMessage(undefined)
    setError(undefined)
  }

  const save = async (nextForm = form) => {
    if (!authority) return
    setSaving(true)
    setMessage(undefined)
    setError(undefined)
    setConflict(false)
    try {
      const updated = await replaceSupportPlanPersonalization(
        nextForm,
        authority.etag,
      )
      setAuthority(updated)
      setForm(formFrom(updated.value))
      setMessage(
        updated.value.status === 'SKIPPED'
          ? 'Đã bỏ qua. MentalBridge sẽ dùng lựa chọn mặc định an toàn.'
          : 'Đã lưu cách bạn muốn kế hoạch đồng hành.',
      )
      onSaved?.(updated)
    } catch (saveError) {
      const isConflict =
        saveError instanceof ApiError &&
        (saveError.status === 412 ||
          saveError.code === 'SUPPORT_PLAN_PERSONALIZATION_VERSION_MISMATCH')
      setConflict(isConflict)
      setError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="mb-personalization" aria-busy="true">
        <span className="sr-only">Đang tải lựa chọn cá nhân hóa…</span>
        <Skeleton width="34%" height={18} />
        <Skeleton width="68%" height={34} />
        <Skeleton width="100%" height={120} />
      </section>
    )
  }

  if (!authority) {
    return (
      <section className="mb-personalization mb-personalization-error">
        <h2>Điều gì giúp kế hoạch dễ thực hiện hơn?</h2>
        <p role="alert">{error}</p>
        <button className="btn btn-outline" type="button" onClick={load}>
          Thử tải lại
        </button>
      </section>
    )
  }

  return (
    <section className="mb-personalization">
      <div className="mb-personalization-heading">
        <div>
          <h2>Điều gì giúp kế hoạch dễ thực hiện hơn?</h2>
          <p>
            Mọi câu đều không bắt buộc. Đây là sở thích thực tế để sắp xếp hỗ
            trợ phù hợp hơn, không phải chẩn đoán hay đánh giá bạn.
          </p>
        </div>
        <SupportPlanIcon name="settings_suggest" size={24} />
      </div>

      {authority.value.planReview.required && (
        <div className="mb-personalization-review" role="status">
          <SupportPlanIcon name="info" size={20} />
          <div>
            {authority.value.planReview.reasonCode ===
            'PREFERENCES_CHANGED_AFTER_DRAFT_CREATION' ? (
              <>
                <strong>Bản đề xuất hiện tại cần được tạo lại</strong>
                <p>
                  Bản đề xuất được tạo từ lựa chọn trước đó. Hãy tạo lại theo
                  lựa chọn mới trước khi bắt đầu.
                </p>
              </>
            ) : (
              <>
                <strong>Kế hoạch hiện tại vẫn được giữ nguyên</strong>
                <p>
                  Lựa chọn mới chỉ áp dụng khi bạn chủ động xem lại hoặc đổi kế
                  hoạch.
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onReviewPlan(authority.value.planReview.reasonCode)}
          >
            {authority.value.planReview.reasonCode ===
            'PREFERENCES_CHANGED_AFTER_DRAFT_CREATION'
              ? 'Xem bản đề xuất'
              : 'Xem kế hoạch hiện tại'}
          </button>
        </div>
      )}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <ChoiceGroup
          legend="Bạn muốn ưu tiên điều gì lúc này?"
          name="preferredFocus"
          value={form.preferredFocus}
          options={focusOptions}
          onChange={(value) => setScalar('preferredFocus', value)}
        />
        <ChoiceGroup
          legend="Nhịp độ nào phù hợp với bạn?"
          name="desiredPace"
          value={form.desiredPace}
          options={paceOptions}
          onChange={(value) => setScalar('desiredPace', value)}
        />
        <ChoiceGroup
          legend="Bạn thường có bao nhiêu phút mỗi ngày?"
          name="dailyTimeBudgetMinutes"
          value={form.dailyTimeBudgetMinutes}
          options={([5, 10, 15, 20, 30] as const).map(
            (minutes) => [minutes, `${minutes} phút`] as const,
          )}
          onChange={(value) => setScalar('dailyTimeBudgetMinutes', value)}
        />
        <ChoiceGroup
          legend="Thời điểm nào thường thuận tiện?"
          name="preferredDaypart"
          value={form.preferredDaypart}
          options={daypartOptions}
          onChange={(value) => setScalar('preferredDaypart', value)}
        />
        <MultiChoiceGroup
          legend="Bạn thích cách thực hành nào?"
          hint="Có thể chọn nhiều lựa chọn."
          field="preferredActivityModes"
          values={form.preferredActivityModes}
          options={modeOptions}
          onToggle={(value) => toggleArray('preferredActivityModes', value)}
        />
        <MultiChoiceGroup
          legend="Điều gì thường khiến bạn khó bắt đầu?"
          hint="MentalBridge dùng thông tin này để ưu tiên bước dễ tiếp cận hơn."
          field="commonBarriers"
          values={form.commonBarriers}
          options={barrierOptions}
          onToggle={(value) => toggleArray('commonBarriers', value)}
        />

        {message && (
          <p className="mb-personalization-message is-success" role="status">
            {message}
          </p>
        )}
        {error && (
          <div className="mb-personalization-message is-error" role="alert">
            <p>{error}</p>
            {conflict && (
              <button className="btn btn-outline" type="button" onClick={load}>
                Tải lựa chọn mới nhất
              </button>
            )}
          </div>
        )}

        <div className="mb-personalization-actions">
          <button
            className="btn btn-primary"
            type="submit"
            disabled={saving || !dirty}
          >
            {saving ? 'Đang lưu…' : 'Lưu lựa chọn'}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={saving}
            onClick={() => {
              setForm(EMPTY_FORM)
              void save(EMPTY_FORM)
            }}
          >
            Bỏ qua tất cả
          </button>
          <span>Mọi lựa chọn đều có thể thay đổi sau.</span>
        </div>
      </form>
    </section>
  )
}
