'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { ApiError } from '@/lib/api/api-error'
import {
  changeSupportPlanOccurrenceState,
  getSupportPlanOccurrences,
} from '../api/browser-support-plan'
import type {
  SupportPlanOccurrence,
  SupportPlanOccurrenceList,
} from '../api/support-plan-contract'

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'

const stateLabels: Record<SupportPlanOccurrence['displayState'], string> = {
  SCHEDULED: 'Sắp tới',
  MISSED: 'Đã qua giờ',
  COMPLETED: 'Bạn đã hoàn thành',
  SKIPPED: 'Bạn đã bỏ qua',
  CANCELLED: 'Đã hủy theo kế hoạch',
}

const sourceLabels: Record<SupportPlanOccurrence['source']['type'], string> = {
  RESOURCE: 'Tài nguyên SupportPlan',
  JOURNAL_PROMPT: 'Gợi ý viết nhật ký',
  EMOTION_CHECK_IN_PROMPT: 'Gợi ý ghi nhận cảm xúc',
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
      return 'Lịch đã thay đổi ở nơi khác. Vui lòng tải lại.'
    }
    if (
      error.code === 'OCCURRENCE_NOT_OPEN' ||
      error.code === 'SUPPORT_PLAN_NOT_CURRENT'
    ) {
      return 'Mục này không còn nhận cập nhật. Trạng thái mới nhất sẽ được tải lại.'
    }
  }
  return 'Chưa thể cập nhật mục này. Vui lòng thử lại.'
}

type Props = Readonly<{ planStatus: 'ACTIVE' | 'PAUSED' }>

export default function SupportPlanSchedule({ planStatus }: Props) {
  const today = useMemo(() => dateInZone(new Date(), DEFAULT_TIMEZONE), [])
  const [schedule, setSchedule] = useState<SupportPlanOccurrenceList>()
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string>()
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      setSchedule(await getSupportPlanOccurrences(today, addDays(today, 13)))
    } catch {
      setMessage('Chưa thể tải lịch hoạt động lúc này.')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load, planStatus])

  const update = async (
    occurrence: SupportPlanOccurrence,
    state: 'COMPLETED' | 'SKIPPED',
  ) => {
    setBusyId(occurrence.occurrenceId)
    setMessage('')
    try {
      const updated = await changeSupportPlanOccurrenceState(
        occurrence.occurrenceId,
        occurrence.version,
        state,
      )
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
    } catch (error) {
      setMessage(errorMessage(error))
      await load()
    } finally {
      setBusyId(undefined)
    }
  }

  if (loading) {
    return (
      <section className="support-plan-schedule" aria-busy="true">
        <div className="support-plan-schedule-heading">
          <h3>Lịch hoạt động</h3>
        </div>
        <p role="status">Đang tải lịch hữu hạn…</p>
      </section>
    )
  }

  const occurrences = schedule?.occurrences ?? []
  const todayItems = occurrences.filter((item) => item.localDate === today)
  const upcoming = occurrences.filter((item) => item.localDate !== today)

  const renderItem = (occurrence: SupportPlanOccurrence) => {
    const open = occurrence.state === 'SCHEDULED' && planStatus === 'ACTIVE'
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
          <details>
            <summary>Chi tiết nguồn</summary>
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
            {occurrence.stateReason && (
              <p>Thay đổi do: {occurrence.stateReason}</p>
            )}
          </details>
        </div>
        {open && (
          <div className="support-plan-occurrence-actions">
            <button
              className="btn btn-primary"
              type="button"
              disabled={busyId === occurrence.occurrenceId}
              onClick={() => void update(occurrence, 'COMPLETED')}
            >
              Đã làm
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busyId === occurrence.occurrenceId}
              onClick={() => void update(occurrence, 'SKIPPED')}
            >
              Bỏ qua
            </button>
          </div>
        )}
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
          <h3 id="support-plan-schedule-title">Hôm nay và sắp tới</h3>
        </div>
        {planStatus === 'PAUSED' && <strong>Đang tạm dừng</strong>}
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
              <p>Hôm nay không có mục được xếp lịch.</p>
            )}
          </div>
          <div>
            <h4>13 ngày sắp tới</h4>
            <ol>{upcoming.map(renderItem)}</ol>
          </div>
        </div>
      )}
      <p className="support-plan-schedule-boundary">
        Hoàn thành hoặc bỏ qua là thông tin bạn tự ghi nhận, không phải đánh giá
        tuân thủ điều trị, kết quả lâm sàng hay phục hồi.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  )
}
