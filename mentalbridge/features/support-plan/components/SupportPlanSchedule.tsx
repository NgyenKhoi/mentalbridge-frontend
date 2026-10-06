'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Disclosure } from '@/components/ui/Disclosure'
import { useFeedback } from '@/components/ui/FeedbackProvider'
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

import SupportPlanWeekCalendar from './SupportPlanWeekCalendar'
import SupportPlanFeaturedActivity from './SupportPlanFeaturedActivity'
import SupportPlanActivityRow from './SupportPlanActivityRow'
import SupportPlanSidebarCards from './SupportPlanSidebarCards'
import SupportPlanIcon from './SupportPlanIcon'

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'

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

type Props = Readonly<{
  planStatus: 'ACTIVE' | 'PAUSED'
  onToggleStatus?: () => void
  onSwitchToManageTab?: () => void
}>

export default function SupportPlanSchedule({
  planStatus,
  onToggleStatus,
  onSwitchToManageTab,
}: Props) {
  const { showActionToast } = useFeedback()
  const today = useMemo(() => dateInZone(new Date(), DEFAULT_TIMEZONE), [])
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [weekOffset, setWeekOffset] = useState<number>(0)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')

  const [schedule, setSchedule] = useState<SupportPlanOccurrenceList>()
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string>()
  const [editingId, setEditingId] = useState<string>()
  const [draft, setDraft] = useState<Draft>()
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [message, setMessage] = useState('')

  // Compute 7 days of the currently navigated week
  const weekDays = useMemo(() => {
    // Determine start of current week (Monday)
    const todayDate = new Date(`${today}T00:00:00Z`)
    const dayOfWeek = todayDate.getUTCDay() // 0 = Sun, 1 = Mon ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const mondayStr = addDays(today, diffToMonday + weekOffset * 7)

    const days: string[] = []
    for (let i = 0; i < 7; i++) {
      days.push(addDays(mondayStr, i))
    }
    return days
  }, [today, weekOffset])

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return ''
    const startParts = weekDays[0].split('-')
    const endParts = weekDays[6].split('-')
    const startDay = parseInt(startParts[2], 10)
    const endDay = parseInt(endParts[2], 10)
    const endMonth = parseInt(endParts[1], 10)
    const endYear = endParts[0]
    return `${startDay} - ${endDay} Tháng ${endMonth}, ${endYear}`
  }, [weekDays])

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
    showActionToast({ title: successMessage, tone: 'success' })
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
      setEditingId(undefined)
      setDraft(undefined)
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
      setEditingId(undefined)
      setDraft(undefined)
      await load(errorMessage(error))
    } finally {
      setBusyId(undefined)
    }
  }

  const toggleVisibility = async (occurrence: SupportPlanOccurrence) => {
    await replace(
      occurrence,
      {
        state: occurrence.state as 'SCHEDULED' | EditableState,
        hidden: !occurrence.hidden,
        helpfulness: occurrence.helpfulness,
        barrierCode: occurrence.barrierCode,
        reflection: occurrence.reflection,
        summaryReuseApproved: occurrence.summaryReuseApproved,
      },
      occurrence.hidden ? 'Đã hiện lại mục này.' : 'Đã ẩn mục này.',
    )
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

  // Items for selected date
  const selectedDateItems = visible.filter(
    (item) => item.localDate === selectedDate,
  )
  const todayItems = visible.filter((item) => item.localDate === today)
  const upcoming = visible.filter(
    (item) =>
      item.localDate > today &&
      item.localDate >= weekDays[0] &&
      item.localDate <= weekDays[6],
  )

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
          <span
            className="support-plan-summary-consent-control"
            data-state={draft.summaryReuseApproved ? 'checked' : 'unchecked'}
            aria-hidden="true"
          >
            {draft.summaryReuseApproved ? '✓' : null}
          </span>
          <span className="support-plan-summary-consent-copy">
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

  const formattedSelectedDateHeading = (() => {
    try {
      const d = new Date(`${selectedDate}T00:00:00Z`)
      const weekday = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        timeZone: 'UTC',
      }).format(d)
      const dayMonthYear = new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(d)
      const prefix = selectedDate === today ? 'Hoạt động hôm nay' : 'Hoạt động'
      return `${prefix} · ${weekday}, ${dayMonthYear}`
    } catch {
      return `Hoạt động ngày ${selectedDate}`
    }
  })()

  return (
    <section
      className="support-plan-schedule"
      aria-labelledby="support-plan-schedule-title"
    >
      <h2 id="support-plan-schedule-title" className="sr-only">
        Hoạt động của tôi
      </h2>
      {/* 7-Day Calendar Grid with integrated View Switcher & Title */}
      <SupportPlanWeekCalendar
        weekDays={weekDays}
        selectedDate={selectedDate}
        today={today}
        occurrences={occurrences}
        onSelectDate={(d) => setSelectedDate(d)}
        onPrevWeek={() => setWeekOffset((prev) => prev - 1)}
        onNextWeek={() => setWeekOffset((prev) => prev + 1)}
        weekRangeLabel={weekRangeLabel}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        pausedStatusBadge={
          authoritativePlanStatus === 'PAUSED' ? (
            <div className="support-plan-status-badge-paused">
              <SupportPlanIcon name="pause_circle" size={16} />
              <span>Kế hoạch đang tạm dừng</span>
            </div>
          ) : undefined
        }
      />

      {/* Main 2-Column Area: 8 cols activities, 4 cols sidebar */}
      <div className="support-plan-content-grid">
        {/* Left Column (8 cols): Activities for selected date */}
        <div className="support-plan-activities-col">
          <div className="support-plan-col-header">
            <div className="flex items-center gap-2">
              <h4 className="support-plan-section-title">
                {formattedSelectedDateHeading}
              </h4>
              <span className="support-plan-count-badge">
                {selectedDateItems.length} mục
              </span>
            </div>
          </div>

          {/* Selected Date or Today's Activities */}
          {occurrences.length === 0 ? (
            <p>Chưa có hoạt động trong khoảng thời gian này.</p>
          ) : selectedDateItems.length === 0 ? (
            <div className="support-plan-empty-date-state">
              <p>
                {selectedDate === today
                  ? 'Hôm nay chưa có hoạt động nào được xếp lịch.'
                  : 'Không có hoạt động nào được xếp lịch cho ngày này.'}
              </p>
            </div>
          ) : (
            <div className="support-plan-activities-list">
              {/* First activity is rendered as Featured Card */}
              {selectedDateItems[0] && (
                <SupportPlanFeaturedActivity
                  key={selectedDateItems[0].occurrenceId}
                  occurrence={selectedDateItems[0]}
                  authoritativePlanStatus={authoritativePlanStatus}
                  busy={busyId === selectedDateItems[0].occurrenceId}
                  isEditing={editingId === selectedDateItems[0].occurrenceId}
                  onStartEditing={(st) => {
                    setEditingId(selectedDateItems[0].occurrenceId)
                    setDraft(initialDraft(selectedDateItems[0], st))
                  }}
                  onReopen={() =>
                    void replace(
                      selectedDateItems[0],
                      {
                        state: 'SCHEDULED',
                        hidden: selectedDateItems[0].hidden,
                        helpfulness: null,
                        barrierCode: null,
                        reflection: null,
                        summaryReuseApproved: false,
                      },
                      'Đã mở lại mục này.',
                    )
                  }
                  onToggleVisibility={() =>
                    void toggleVisibility(selectedDateItems[0])
                  }
                  onRemove={() => void remove(selectedDateItems[0])}
                  renderForm={() => renderForm(selectedDateItems[0])}
                />
              )}

              {/* Remaining activities are rendered as compact rows */}
              {selectedDateItems.length > 1 && (
                <div className="support-plan-rows-container">
                  {selectedDateItems.slice(1).map((item) => (
                    <SupportPlanActivityRow
                      key={item.occurrenceId}
                      occurrence={item}
                      authoritativePlanStatus={authoritativePlanStatus}
                      busy={busyId === item.occurrenceId}
                      isEditing={editingId === item.occurrenceId}
                      onStartEditing={(st) => {
                        setEditingId(item.occurrenceId)
                        setDraft(initialDraft(item, st))
                      }}
                      onReopen={() =>
                        void replace(
                          item,
                          {
                            state: 'SCHEDULED',
                            hidden: item.hidden,
                            helpfulness: null,
                            barrierCode: null,
                            reflection: null,
                            summaryReuseApproved: false,
                          },
                          'Đã mở lại mục này.',
                        )
                      }
                      onToggleVisibility={() => void toggleVisibility(item)}
                      onRemove={() => void remove(item)}
                      renderForm={() => renderForm(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming Section: always shown when viewing today (or list view) and upcoming items exist */}
          {(selectedDate === today || viewMode === 'list') &&
            upcoming.length > 0 && (
              <div className="support-plan-upcoming-section">
                <div className="support-plan-upcoming-heading">
                  <h4 className="support-plan-section-title">
                    Hoạt động sắp tới
                  </h4>
                  <span>Trong tuần này</span>
                </div>
                <div className="support-plan-activities-list">
                  {/* First item is featured if today has no items */}
                  {todayItems.length === 0 && upcoming[0] && (
                    <SupportPlanFeaturedActivity
                      key={upcoming[0].occurrenceId}
                      occurrence={upcoming[0]}
                      authoritativePlanStatus={authoritativePlanStatus}
                      busy={busyId === upcoming[0].occurrenceId}
                      isEditing={editingId === upcoming[0].occurrenceId}
                      onStartEditing={(st) => {
                        setEditingId(upcoming[0].occurrenceId)
                        setDraft(initialDraft(upcoming[0], st))
                      }}
                      onReopen={() =>
                        void replace(
                          upcoming[0],
                          {
                            state: 'SCHEDULED',
                            hidden: upcoming[0].hidden,
                            helpfulness: null,
                            barrierCode: null,
                            reflection: null,
                            summaryReuseApproved: false,
                          },
                          'Đã mở lại mục này.',
                        )
                      }
                      onToggleVisibility={() =>
                        void toggleVisibility(upcoming[0])
                      }
                      onRemove={() => void remove(upcoming[0])}
                      renderForm={() => renderForm(upcoming[0])}
                    />
                  )}

                  {/* Remaining items rendered as modern rows */}
                  <div className="support-plan-rows-container">
                    {(todayItems.length === 0 ? upcoming.slice(1) : upcoming)
                      .slice(0, showAllUpcoming ? undefined : 3)
                      .map((item) => (
                        <SupportPlanActivityRow
                          key={item.occurrenceId}
                          occurrence={item}
                          authoritativePlanStatus={authoritativePlanStatus}
                          busy={busyId === item.occurrenceId}
                          isEditing={editingId === item.occurrenceId}
                          onStartEditing={(st) => {
                            setEditingId(item.occurrenceId)
                            setDraft(initialDraft(item, st))
                          }}
                          onReopen={() =>
                            void replace(
                              item,
                              {
                                state: 'SCHEDULED',
                                hidden: item.hidden,
                                helpfulness: null,
                                barrierCode: null,
                                reflection: null,
                                summaryReuseApproved: false,
                              },
                              'Đã mở lại mục này.',
                            )
                          }
                          onToggleVisibility={() => void toggleVisibility(item)}
                          onRemove={() => void remove(item)}
                          renderForm={() => renderForm(item)}
                        />
                      ))}
                  </div>
                </div>

                {upcoming.length > (todayItems.length === 0 ? 4 : 3) && (
                  <div className="support-plan-schedule-more">
                    <button
                      type="button"
                      className="support-plan-schedule-more-btn"
                      onClick={() => setShowAllUpcoming((prev) => !prev)}
                    >
                      {showAllUpcoming
                        ? 'Thu gọn danh sách ↑'
                        : `Còn ${upcoming.length - (todayItems.length === 0 ? 4 : 3)} hoạt động khác trong tuần này · Xem tất cả →`}
                    </button>
                  </div>
                )}
              </div>
            )}

          {/* Hidden Items Disclosure */}
          {hidden.length > 0 && (
            <Disclosure
              className="support-plan-hidden-items"
              summary={`Đã ẩn (${hidden.length})`}
            >
              <div className="support-plan-hidden-list">
                {hidden.map((item) => (
                  <SupportPlanActivityRow
                    key={item.occurrenceId}
                    occurrence={item}
                    authoritativePlanStatus={authoritativePlanStatus}
                    busy={busyId === item.occurrenceId}
                    isEditing={editingId === item.occurrenceId}
                    onStartEditing={(st) => {
                      setEditingId(item.occurrenceId)
                      setDraft(initialDraft(item, st))
                    }}
                    onReopen={() =>
                      void replace(
                        item,
                        {
                          state: 'SCHEDULED',
                          hidden: item.hidden,
                          helpfulness: null,
                          barrierCode: null,
                          reflection: null,
                          summaryReuseApproved: false,
                        },
                        'Đã mở lại mục này.',
                      )
                    }
                    onToggleVisibility={() => void toggleVisibility(item)}
                    onRemove={() => void remove(item)}
                    renderForm={() => renderForm(item)}
                  />
                ))}
              </div>
            </Disclosure>
          )}

          {/* Clinical Boundary Disclaimer */}
          <div className="support-plan-schedule-boundary">
            <SupportPlanIcon
              name="info"
              size={16}
              className="support-plan-boundary-icon"
            />
            <p>
              Đây là thông tin bạn tự ghi nhận cho riêng mình, không phải đánh
              giá tuân thủ điều trị, kết quả lâm sàng hay mức độ hồi phục.
              Chuyên gia không theo dõi trực tiếp danh sách này. Chỉ trạng thái
              hoạt động mà bạn cho phép và duyệt mới có thể dùng trong bản tóm
              tắt; ghi chú riêng không được chia sẻ.
            </p>
          </div>

          <p role="status" aria-live="polite">
            {message}
          </p>
        </div>

        {/* Right Column (4 cols): Sidebar cards */}
        <SupportPlanSidebarCards
          planStatus={authoritativePlanStatus}
          onToggleStatus={onToggleStatus}
          onSwitchToManageTab={onSwitchToManageTab}
        />
      </div>
    </section>
  )
}
