'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Disclosure } from '@/components/ui/Disclosure'
import { ApiError } from '@/lib/api/api-error'
import {
  deleteSupportPlanOccurrenceEngagement,
  getSupportPlanOccurrences,
  replaceSupportPlanOccurrenceEngagement,
} from '../api/browser-support-plan'
import type {
  ReplaceSupportPlanOccurrenceEngagementRequest,
  SupportPlanOccurrence,
  SupportPlanOccurrenceList,
} from '../api/support-plan-contract'

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'

const stateLabels: Record<SupportPlanOccurrence['displayState'], string> = {
  SCHEDULED: 'Sắp tới',
  MISSED: 'Đã qua giờ',
  COMPLETED: 'Bạn đã ghi nhận là đã làm',
  SKIPPED: 'Bạn đã ghi nhận là bỏ qua',
  CANCELLED: 'Đã huỷ theo kế hoạch',
}

const sourceLabels: Record<SupportPlanOccurrence['source']['type'], string> = {
  RESOURCE: 'Tài nguyên trong kế hoạch',
  JOURNAL_PROMPT: 'Gợi ý viết nhật ký',
  EMOTION_CHECK_IN_PROMPT: 'Gợi ý ghi nhận cảm xúc',
}

const helpfulnessOptions = [
  ['NOT_HELPFUL', 'Không hữu ích'],
  ['A_LITTLE_HELPFUL', 'Hữu ích một chút'],
  ['HELPFUL', 'Hữu ích'],
  ['VERY_HELPFUL', 'Rất hữu ích'],
] as const

const barrierOptions = [
  ['LOW_ENERGY', 'Chưa đủ năng lượng'],
  ['NOT_ENOUGH_TIME', 'Chưa đủ thời gian'],
  ['DIFFICULT_TO_START', 'Khó bắt đầu'],
  ['NOT_A_GOOD_FIT', 'Hoạt động chưa phù hợp'],
  ['OTHER', 'Lý do khác'],
] as const

type EditableState = 'COMPLETED' | 'SKIPPED'
type Draft = {
  state: EditableState
  helpfulness: ReplaceSupportPlanOccurrenceEngagementRequest['helpfulness']
  barrierCode: ReplaceSupportPlanOccurrenceEngagementRequest['barrierCode']
  reflection: string
  summaryReuseApproved: boolean
}

function dateInZone(value: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function timeLabel(occurrence: SupportPlanOccurrence) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: occurrence.timezone,
    hour12: false,
  }).format(new Date(occurrence.scheduledAt))
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'OCCURRENCE_VERSION_MISMATCH') {
      return 'Mục này đã thay đổi ở nơi khác. Dữ liệu mới nhất đã được tải lại.'
    }
    if (
      error.code === 'OCCURRENCE_NOT_OPEN' ||
      error.code === 'SUPPORT_PLAN_NOT_CURRENT' ||
      error.code === 'SUPPORT_PLAN_NOT_ACTIVE'
    ) {
      return 'Mục này không còn nhận cập nhật. Trạng thái mới nhất đã được tải lại.'
    }
  }
  return 'Chưa thể lưu thay đổi. Vui lòng thử lại.'
}

function initialDraft(
  occurrence: SupportPlanOccurrence,
  state: EditableState,
): Draft {
  return {
    state,
    helpfulness: state === 'COMPLETED' ? occurrence.helpfulness : null,
    barrierCode: state === 'SKIPPED' ? occurrence.barrierCode : null,
    reflection: occurrence.reflection ?? '',
    summaryReuseApproved: occurrence.summaryReuseApproved,
  }
}

type Props = Readonly<{ planStatus: 'ACTIVE' | 'PAUSED' }>

export default function SupportPlanSchedule({ planStatus }: Props) {
  const today = useMemo(() => dateInZone(new Date(), DEFAULT_TIMEZONE), [])
  const [schedule, setSchedule] = useState<SupportPlanOccurrenceList>()
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string>()
  const [editingId, setEditingId] = useState<string>()
  const [draft, setDraft] = useState<Draft>()
  const [message, setMessage] = useState('')

  const load = useCallback(
    async (messageAfterLoad = '') => {
      setLoading(true)
      if (!messageAfterLoad) setMessage('')
      try {
        const loaded = await getSupportPlanOccurrences(
          today,
          addDays(today, 13),
        )
        setSchedule(loaded)
        if (loaded.supportPlanStatus !== 'ACTIVE') {
          setEditingId(undefined)
          setDraft(undefined)
        }
        setMessage(messageAfterLoad)
      } catch {
        setMessage('Chưa thể tải lịch hoạt động lúc này.')
      } finally {
        setLoading(false)
      }
    },
    [today],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load, planStatus])

  const accept = (updated: SupportPlanOccurrence, successMessage: string) => {
    setSchedule((current) =>
      current
        ? {
            ...current,
            occurrences: current.occurrences.map((item) =>
              item.occurrenceId === updated.occurrenceId ? updated : item,
            ),
          }
        : current,
    )
    setEditingId(undefined)
    setDraft(undefined)
    setMessage(successMessage)
  }

  const replace = async (
    occurrence: SupportPlanOccurrence,
    request: ReplaceSupportPlanOccurrenceEngagementRequest,
    successMessage: string,
  ) => {
    setBusyId(occurrence.occurrenceId)
    setMessage('')
    try {
      accept(
        await replaceSupportPlanOccurrenceEngagement(
          occurrence.occurrenceId,
          occurrence.version,
          request,
        ),
        successMessage,
      )
    } catch (error) {
      await load(errorMessage(error))
    } finally {
      setBusyId(undefined)
    }
  }

  const saveDraft = (occurrence: SupportPlanOccurrence) => {
    if (!draft) return
    const reflection = draft.reflection.trim()
    void replace(
      occurrence,
      {
        state: draft.state,
        hidden: occurrence.hidden,
        helpfulness: draft.state === 'COMPLETED' ? draft.helpfulness : null,
        barrierCode: draft.state === 'SKIPPED' ? draft.barrierCode : null,
        reflection: reflection.length > 0 ? reflection : null,
        summaryReuseApproved: draft.summaryReuseApproved,
      },
      'Đã lưu phần tự ghi nhận của bạn.',
    )
  }

  const remove = async (occurrence: SupportPlanOccurrence) => {
    setBusyId(occurrence.occurrenceId)
    setMessage('')
    try {
      accept(
        await deleteSupportPlanOccurrenceEngagement(
          occurrence.occurrenceId,
          occurrence.version,
        ),
        'Đã xoá phần tự ghi nhận; lịch gốc vẫn được giữ lại.',
      )
    } catch (error) {
      await load(errorMessage(error))
    } finally {
      setBusyId(undefined)
    }
  }

  if (loading) {
    return (
      <section className="support-plan-schedule" aria-busy="true">
        <div className="support-plan-schedule-heading">
          <h3>Hoạt động của tôi</h3>
        </div>
        <p role="status">Đang tải lịch hoạt động…</p>
      </section>
    )
  }

  const occurrences = schedule?.occurrences ?? []
  const authoritativePlanStatus = schedule?.supportPlanStatus ?? planStatus
  const visible = occurrences.filter((item) => !item.hidden)
  const hidden = occurrences.filter((item) => item.hidden)
  const todayItems = visible.filter((item) => item.localDate === today)
  const upcoming = visible.filter((item) => item.localDate !== today)

  const renderForm = (occurrence: SupportPlanOccurrence) => {
    if (
      authoritativePlanStatus !== 'ACTIVE' ||
      editingId !== occurrence.occurrenceId ||
      !draft
    )
      return null
    const busy = busyId === occurrence.occurrenceId
    return (
      <div className="support-plan-engagement-form">
        <h5>
          {draft.state === 'COMPLETED'
            ? 'Ghi nhận sau khi thực hiện'
            : 'Ghi nhận khi bỏ qua'}
        </h5>
        {draft.state === 'COMPLETED' ? (
          <label>
            Hoạt động này hữu ích với bạn thế nào? (không bắt buộc)
            <select
              value={draft.helpfulness ?? ''}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  helpfulness:
                    (event.target.value as Draft['helpfulness']) || null,
                })
              }
            >
              <option value="">Chưa muốn đánh giá</option>
              {helpfulnessOptions.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Điều gì khiến hoạt động chưa phù hợp lúc này? (không bắt buộc)
            <select
              value={draft.barrierCode ?? ''}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  barrierCode:
                    (event.target.value as Draft['barrierCode']) || null,
                })
              }
            >
              <option value="">Chưa muốn chọn</option>
              {barrierOptions.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Ghi chú riêng (không bắt buộc)
          <textarea
            maxLength={500}
            rows={3}
            value={draft.reflection}
            onChange={(event) =>
              setDraft({ ...draft, reflection: event.target.value })
            }
          />
          <span className="support-plan-character-count">
            {draft.reflection.length}/500 ký tự
          </span>
        </label>
        <label className="support-plan-summary-consent">
          <input
            type="checkbox"
            checked={draft.summaryReuseApproved}
            onChange={(event) =>
              setDraft({
                ...draft,
                summaryReuseApproved: event.target.checked,
              })
            }
          />
          <span>
            Cho phép dùng trạng thái hoạt động (đã làm hoặc bỏ qua) trong bản
            tóm tắt do tôi duyệt. Nội dung ghi chú riêng không được chia sẻ.
          </span>
        </label>
        <div className="support-plan-occurrence-actions">
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy}
            onClick={() => saveDraft(occurrence)}
          >
            Lưu tự ghi nhận
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={busy}
            onClick={() => {
              setEditingId(undefined)
              setDraft(undefined)
            }}
          >
            Huỷ chỉnh sửa
          </button>
        </div>
      </div>
    )
  }

  const renderItem = (occurrence: SupportPlanOccurrence) => {
    const mutable =
      occurrence.state !== 'CANCELLED' && authoritativePlanStatus === 'ACTIVE'
    const hasResponse =
      occurrence.state === 'COMPLETED' ||
      occurrence.state === 'SKIPPED' ||
      occurrence.hidden ||
      occurrence.reflection !== null
    const busy = busyId === occurrence.occurrenceId
    return (
      <li
        className={`support-plan-occurrence state-${occurrence.displayState.toLowerCase()}`}
        key={occurrence.occurrenceId}
      >
        <time dateTime={occurrence.scheduledAt}>
          <strong>{timeLabel(occurrence)}</strong>
          <span>{occurrence.timezone}</span>
        </time>
        <div className="support-plan-occurrence-copy">
          <span className="support-plan-occurrence-state">
            {stateLabels[occurrence.displayState]}
          </span>
          <h4>{occurrence.source.title}</h4>
          {occurrence.reflection && (
            <p className="support-plan-reflection">“{occurrence.reflection}”</p>
          )}
          <Disclosure summary="Thông tin kỹ thuật">
            <p>
              {sourceLabels[occurrence.source.type]} · lịch{' '}
              {occurrence.scheduleVersion} · SupportPlan{' '}
              {occurrence.source.supportPlanVersion}
            </p>
            {occurrence.source.type === 'RESOURCE' && (
              <p>
                Phiên bản tài nguyên {occurrence.source.contentVersion} · slot{' '}
                {occurrence.source.slotId}
              </p>
            )}
            {occurrence.engagementUpdatedAt && (
              <p>Tự ghi nhận được lưu theo phiên bản {occurrence.version}.</p>
            )}
          </Disclosure>
          {mutable && (
            <div className="support-plan-occurrence-actions">
              {occurrence.state === 'SCHEDULED' ? (
                <>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(occurrence.occurrenceId)
                      setDraft(initialDraft(occurrence, 'COMPLETED'))
                    }}
                  >
                    Ghi nhận đã làm
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(occurrence.occurrenceId)
                      setDraft(initialDraft(occurrence, 'SKIPPED'))
                    }}
                  >
                    Ghi nhận bỏ qua
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(occurrence.occurrenceId)
                      setDraft(
                        initialDraft(
                          occurrence,
                          occurrence.state as EditableState,
                        ),
                      )
                    }}
                  >
                    Chỉnh sửa tự ghi nhận
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void replace(
                        occurrence,
                        {
                          state: 'SCHEDULED',
                          hidden: occurrence.hidden,
                          helpfulness: null,
                          barrierCode: null,
                          reflection: null,
                          summaryReuseApproved: false,
                        },
                        'Đã mở lại mục này.',
                      )
                    }
                  >
                    Mở lại
                  </button>
                </>
              )}
              <button
                className="btn btn-ghost"
                type="button"
                disabled={busy}
                onClick={() =>
                  void replace(
                    occurrence,
                    {
                      state: occurrence.state as 'SCHEDULED' | EditableState,
                      hidden: !occurrence.hidden,
                      helpfulness: occurrence.helpfulness,
                      barrierCode: occurrence.barrierCode,
                      reflection: occurrence.reflection,
                      summaryReuseApproved: occurrence.summaryReuseApproved,
                    },
                    occurrence.hidden
                      ? 'Đã hiện lại mục này.'
                      : 'Đã ẩn mục này.',
                  )
                }
              >
                {occurrence.hidden ? 'Hiện lại' : 'Ẩn khỏi danh sách'}
              </button>
              {hasResponse && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(occurrence)}
                >
                  Xoá tự ghi nhận
                </button>
              )}
            </div>
          )}
          {renderForm(occurrence)}
        </div>
      </li>
    )
  }

  return (
    <section
      className="support-plan-schedule"
      aria-labelledby="support-plan-schedule-title"
    >
      <div className="support-plan-schedule-heading">
        <div>
          <span>Giờ địa phương</span>
          <h3 id="support-plan-schedule-title">Hoạt động của tôi</h3>
        </div>
        {authoritativePlanStatus === 'PAUSED' && <strong>Đang tạm dừng</strong>}
      </div>
      {occurrences.length === 0 ? (
        <p>Chưa có hoạt động trong khoảng thời gian này.</p>
      ) : (
        <div className="support-plan-schedule-groups">
          <div>
            <h4>Hôm nay</h4>
            {todayItems.length > 0 ? (
              <ol>{todayItems.map(renderItem)}</ol>
            ) : (
              <p>Hôm nay không có mục đang hiển thị.</p>
            )}
          </div>
          <div>
            <h4>13 ngày sắp tới</h4>
            {upcoming.length > 0 ? (
              <ol>{upcoming.map(renderItem)}</ol>
            ) : (
              <p>Không có mục sắp tới đang hiển thị.</p>
            )}
          </div>
          {hidden.length > 0 && (
            <Disclosure
              className="support-plan-hidden-items"
              summary={`Đã ẩn (${hidden.length})`}
            >
              <ol>{hidden.map(renderItem)}</ol>
            </Disclosure>
          )}
        </div>
      )}
      <p className="support-plan-schedule-boundary">
        Đây là thông tin bạn tự ghi nhận cho riêng mình, không phải đánh giá
        tuân thủ điều trị, kết quả lâm sàng hay mức độ hồi phục. Chuyên gia
        không theo dõi trực tiếp danh sách này. Chỉ trạng thái hoạt động mà bạn
        cho phép và duyệt mới có thể dùng trong bản tóm tắt; ghi chú riêng không
        được chia sẻ.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  )
}
