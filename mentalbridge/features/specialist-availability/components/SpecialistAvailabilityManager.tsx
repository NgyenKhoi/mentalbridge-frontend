'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  MessageCircle,
  Plus,
  RefreshCw,
  Video,
  X,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { AvailabilityBrowserError, availabilityWorkspaceService } from '../api/availability-workspace-service'
import type {
  AvailabilityModality,
  AvailabilitySlot,
} from '@/lib/consultation/consultation-validation'
import styles from './SpecialistAvailabilityManager.module.css'

type FormState = Readonly<{
  date: string
  startTime: string
  timezone: string
  modality: AvailabilityModality
}>

const READINESS_LABELS = {
  AVAILABLE: 'Có thể đặt',
  STARTED: 'Đã bắt đầu',
  WITHDRAWN: 'Đã rút',
  VIDEO_DISABLED: 'Video đang tắt',
} as const

function defaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh'
}

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function partsAt(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function localSlotToUtc(date: string, time: string, timezone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match || !timeMatch) throw new Error('Ngày hoặc giờ không hợp lệ.')
  const desired = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  )
  let candidate = desired
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const values = partsAt(new Date(candidate), timezone)
    const represented = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    )
    candidate += desired - represented
  }
  const verified = partsAt(new Date(candidate), timezone)
  if (
    verified.year !== match[1] ||
    verified.month !== match[2] ||
    verified.day !== match[3] ||
    verified.hour !== timeMatch[1] ||
    verified.minute !== timeMatch[2]
  ) {
    throw new Error('Giờ đã chọn không tồn tại trong múi giờ này.')
  }
  const startAt = new Date(candidate)
  return {
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + 60 * 60 * 1000).toISOString(),
  }
}

function displaySlot(slot: AvailabilitySlot) {
  const format = new Intl.DateTimeFormat('vi-VN', {
    timeZone: slot.timezone,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const end = new Intl.DateTimeFormat('vi-VN', {
    timeZone: slot.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return `${format.format(new Date(slot.startAt))}–${end.format(new Date(slot.endAt))}`
}

type AvailabilityView = 'cal' | 'list'
type ModalityFilter = 'all' | AvailabilityModality

const HOURS = Array.from({ length: 10 }, (_, index) => index + 8)
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

function shiftDays(date: Date, amount: number) {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + amount)
  return shifted
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function shortDate(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

function slotClock(slot: AvailabilitySlot, timezone: string) {
  const start = partsAt(new Date(slot.startAt), timezone)
  const end = partsAt(new Date(slot.endAt), timezone)
  return {
    date: `${start.year}-${start.month}-${start.day}`,
    hour: Number(start.hour),
    minute: Number(start.minute),
    range: `${start.hour}:${start.minute} – ${end.hour}:${end.minute}`,
  }
}

const withdrawReloadCodes = new Set([
  'AVAILABILITY_SLOT_NOT_FOUND',
  'AVAILABILITY_SLOT_STALE',
  'AVAILABILITY_SLOT_VERSION_MISMATCH',
  'AVAILABILITY_SLOT_WITHDRAWN',
])

function friendlyError(error: unknown, reloaded = false) {
  if (error instanceof AvailabilityBrowserError) {
    const reloadSuffix = reloaded ? ' Danh sách mới nhất đã được tải lại.' : ''
    switch (error.code) {
      case 'AVAILABILITY_SLOT_OVERLAP':
        return 'Khung giờ này trùng với một khung giờ đang hoạt động. Hãy chọn thời gian khác.'
      case 'AVAILABILITY_REST_DAY':
        return 'Ngày đã chọn là ngày nghỉ. Hãy chọn ngày khác.'
      case 'VIDEO_AVAILABILITY_DISABLED':
        return 'Tư vấn video trong ứng dụng chưa được bật. Hãy chọn chat trong ứng dụng.'
      case 'SPECIALIST_NOT_APPROVED':
        return 'Hồ sơ chuyên gia cần được phê duyệt trước khi xuất bản lịch khả dụng.'
      case 'IDEMPOTENCY_KEY_REUSED':
        return 'Yêu cầu xuất bản xung đột với một lần gửi trước. Hãy thử lại.'
      case 'AVAILABILITY_SLOT_VERSION_MISMATCH':
        return `Khung giờ đã thay đổi.${reloadSuffix || ' Hãy tải lại danh sách rồi thử lại.'}`
      case 'AVAILABILITY_SLOT_WITHDRAWN':
        return `Khung giờ này đã được rút.${reloadSuffix}`
      case 'AVAILABILITY_SLOT_STALE':
        return `Khung giờ đã bắt đầu nên không thể rút.${reloadSuffix}`
      case 'AVAILABILITY_SLOT_NOT_FOUND':
        return `Không tìm thấy khung giờ này.${reloadSuffix}`
      case 'AVAILABILITY_SLOT_VERSION_REQUIRED':
        return 'Không thể xác định phiên bản khung giờ. Hãy tải lại danh sách rồi thử lại.'
      case 'VALIDATION_FAILED':
        return 'Dữ liệu khung giờ không hợp lệ. Hãy kiểm tra ngày, giờ và múi giờ.'
      case 'UNAUTHENTICATED':
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      case 'CONSULTATION_ROLE_REQUIRED':
        return 'Tài khoản hiện tại không có quyền quản lý lịch chuyên gia.'
    }
    return error.message
  }
  if (error instanceof RangeError) return 'Múi giờ không hợp lệ. Hãy kiểm tra lại tên múi giờ.'
  return error instanceof Error ? error.message : 'Không thể hoàn tất yêu cầu.'
}

export default function SpecialistAvailabilityManager() {
  const { confirm, showActionToast } = useFeedback()
  const [form, setForm] = useState<FormState>({
    date: '',
    startTime: '',
    timezone: defaultTimezone(),
    modality: 'IN_APP_VIDEO',
  })
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [restDays, setRestDays] = useState<string[]>([])
  const [repeatWeeklyEnabled, setRepeatWeeklyEnabled] = useState(false)
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [freshSlotIds, setFreshSlotIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [view, setView] = useState<AvailabilityView>('cal')
  const [filter, setFilter] = useState<ModalityFilter>('all')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const calendarTimezone = useMemo(defaultTimezone, [])
  const idempotencyKey = useRef<string | null>(null)
  const firstDayRef = useRef<HTMLButtonElement>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('view')
    setView(requested === 'cal' || requested === 'list'
      ? requested
      : window.matchMedia('(max-width: 767px)').matches ? 'list' : 'cal')
  }, [])

  useEffect(() => {
    if (!modalOpen) return
    const frame = window.requestAnimationFrame(() => firstDayRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [modalOpen])

  useEffect(() => {
    if (freshSlotIds.length === 0) return
    const timer = window.setTimeout(() => setFreshSlotIds([]), 260)
    return () => window.clearTimeout(timer)
  }, [freshSlotIds])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await availabilityWorkspaceService.load()
      setSlots(data.slots)
      setVideoEnabled(data.videoEnabled)
      setRestDays(data.restDays)
      setRepeatWeeklyEnabled(data.repeatWeeklyEnabled)
      return true
    } catch (caught) {
      setError(friendlyError(caught))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    availabilityWorkspaceService
      .load()
      .then((data) => {
        setSlots(data.slots)
        setVideoEnabled(data.videoEnabled)
        setRestDays(data.restDays)
        setRepeatWeeklyEnabled(data.repeatWeeklyEnabled)
      })
      .catch((caught: unknown) => setError(friendlyError(caught)))
      .finally(() => setLoading(false))
  }, [])

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDays(weekStart, index)),
    [weekStart],
  )
  const weekEnd = dateKey(shiftDays(weekStart, 7))
  const weekBegin = dateKey(weekStart)
  const weekSlots = useMemo(
    () => slots.filter((slot) => {
      const date = slotClock(slot, calendarTimezone).date
      return date >= weekBegin && date < weekEnd
    }),
    [slots, calendarTimezone, weekBegin, weekEnd],
  )
  const activeWeekSlots = useMemo(
    () => weekSlots.filter((slot) => slot.status === 'ACTIVE'),
    [weekSlots],
  )
  const filteredWeekSlots = useMemo(
    () => activeWeekSlots.filter((slot) => filter === 'all' || slot.modality === filter),
    [activeWeekSlots, filter],
  )
  const weekAvailable = activeWeekSlots.filter((slot) => slot.readiness === 'AVAILABLE').length
  const weekWithdrawn = weekSlots.filter((slot) => slot.status === 'WITHDRAWN').length
  const weekOpenRate = activeWeekSlots.length + weekWithdrawn === 0
    ? 0
    : Math.round((activeWeekSlots.length / (activeWeekSlots.length + weekWithdrawn)) * 100)

  const changeView = (next: AvailabilityView) => {
    setView(next)
    const url = new URL(window.location.href)
    url.searchParams.set('view', next)
    window.history.replaceState(window.history.state, '', url)
  }

  const moveWeek = (weeks: number) => {
    setWeekStart((current) => shiftDays(current, weeks * 7))
    setSelectedDay(null)
  }

  const openModal = (date = '', startTime = '') => {
    idempotencyKey.current = null
    setFormError('')
    setRepeatWeekly(false)
    setForm((current) => ({
      ...current,
      date,
      startTime,
      modality: current.modality === 'IN_APP_VIDEO' && !videoEnabled ? 'IN_APP_CHAT' : current.modality,
    }))
    setModalOpen(true)
  }

  const hourUnavailable = (date: string, hour: number) => {
    if (!date) return false
    try {
      const range = localSlotToUtc(date, hourLabel(hour), form.timezone)
      const start = new Date(range.startAt).getTime()
      const end = new Date(range.endAt).getTime()
      return slots.some((slot) => slot.status === 'ACTIVE' &&
        start < new Date(slot.endAt).getTime() && end > new Date(slot.startAt).getTime())
    } catch {
      return false
    }
  }

  const updateForm = <Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) => {
    idempotencyKey.current = null
    setForm((current) => ({ ...current, [key]: value }))
  }

  const publish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.date || !form.startTime || form.date < today() || restDays.includes(form.date)) return
    setSaving(true)
    setFormError('')
    setError('')
    setNotice('')
    try {
      const range = localSlotToUtc(form.date, form.startTime, form.timezone)
      const key = idempotencyKey.current ?? crypto.randomUUID()
      idempotencyKey.current = key
      const created = await availabilityWorkspaceService.publish(
        { ...range, timezone: form.timezone, modality: form.modality },
        key,
        repeatWeeklyEnabled && repeatWeekly,
      )
      setSlots((current) => [
        ...created,
        ...current.filter((slot) => !created.some((item) => item.id === slot.id)),
      ])
      setFreshSlotIds(created.map((slot) => slot.id))
      idempotencyKey.current = null
      setForm((current) => ({ ...current, date: '', startTime: '' }))
      setModalOpen(false)
      window.setTimeout(() => addButtonRef.current?.focus(), 160)
      setNotice('Đã xuất bản khung giờ tư vấn trực tuyến 60 phút.')
      showActionToast({
        title: 'Đã xuất bản khung giờ tư vấn',
        description: `Đã thêm ${form.modality === 'IN_APP_VIDEO' ? 'Video' : 'Chat'} ${form.startTime} ngày ${form.date.slice(8, 10)}/${form.date.slice(5, 7)}${repeatWeeklyEnabled && repeatWeekly ? ' và tuần sau' : ''}.`,
        tone: 'success',
      })
    } catch (caught) {
      if (
        caught instanceof AvailabilityBrowserError &&
        caught.code === 'IDEMPOTENCY_KEY_REUSED'
      )
        idempotencyKey.current = null
      setFormError(friendlyError(caught))
    } finally {
      setSaving(false)
    }
  }

  const withdraw = async (slot: AvailabilitySlot) => {
    const confirmed = await confirm({
      title: 'Rút khung giờ này?',
      description:
        'Khung giờ sẽ không còn nhận lượt đặt mới. Các cuộc hẹn đã có không bị thay đổi.',
      confirmLabel: 'Rút khung giờ',
      tone: 'warning',
    })
    if (!confirmed) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const data = await availabilityWorkspaceService.withdraw(slot)
      setSlots((current) =>
        current.map((item) => (item.id === data.id ? data : item)),
      )
      setNotice('Đã rút khung giờ khỏi lịch khả dụng.')
      showActionToast({
        title: 'Đã rút khung giờ',
        description: 'Khung giờ không còn hiển thị để nhận lượt đặt mới.',
        tone: 'success',
      })
    } catch (caught) {
      if (
        caught instanceof AvailabilityBrowserError &&
        withdrawReloadCodes.has(caught.code)
      ) {
        const reloaded = await load()
        if (reloaded) setError(friendlyError(caught, true))
      } else setError(friendlyError(caught))
    } finally {
      setSaving(false)
    }
  }

  const restDaySet = new Set(restDays)
  const firstSelectableDay = weekDays.find((day) => !restDaySet.has(dateKey(day)) && dateKey(day) >= today())
  const timezoneLabel = new Intl.DateTimeFormat('en', {
    timeZone: calendarTimezone,
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value ?? calendarTimezone
  const filterCounts = {
    all: activeWeekSlots.length,
    IN_APP_VIDEO: activeWeekSlots.filter((slot) => slot.modality === 'IN_APP_VIDEO').length,
    IN_APP_CHAT: activeWeekSlots.filter((slot) => slot.modality === 'IN_APP_CHAT').length,
  }
  const listedDays = weekDays.filter((day) => !selectedDay || dateKey(day) === selectedDay)
  const offGridSlots = filteredWeekSlots.filter((slot) => {
    const time = slotClock(slot, calendarTimezone)
    return time.hour < 8 || time.hour > 17
  })

  return (
    <section className={styles.manager} aria-labelledby="availability-title">
      <header className={styles.heading}>
        <div className={styles.headingCopy}>
          <span className={styles.eyebrow}>Không gian chuyên gia</span>
          <h1 id="availability-title">Lịch khả dụng trực tuyến</h1>
          <p>Mỗi khung giờ chuẩn 60 phút cho phiên Chat hoặc Video. Xem dạng lịch tuần hoặc danh sách, thêm nhanh ngay trên cùng một màn hình.</p>
        </div>
        <div className={styles.summary} aria-label="Tổng quan tuần đang xem">
          <div className={styles.stat}><strong>{weekAvailable}</strong><span>Có thể đặt</span></div>
          <div className={styles.stat}><strong>{weekWithdrawn}</strong><span>Đã rút</span></div>
          <div className={styles.stat}><strong>{weekOpenRate}%</strong><span>Tỷ lệ mở tuần</span></div>
          <button data-availability-ui="" className={styles.syncButton} type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
            {loading ? 'Đang cập nhật…' : 'Đồng bộ lịch'}
          </button>
        </div>
      </header>

      <section className={styles.calendarCard} aria-label="Lịch tiếp nhận">
        <div className={styles.toolbar}>
          <div className={styles.segment} role="group" aria-label="Chế độ xem">
            <button data-availability-ui="" type="button" aria-pressed={view === 'cal'} className={view === 'cal' ? styles.selected : ''} onClick={() => changeView('cal')}>
              <CalendarDays size={16} strokeWidth={1.75} aria-hidden="true" /> Lịch
            </button>
            <button data-availability-ui="" type="button" aria-pressed={view === 'list'} className={view === 'list' ? styles.selected : ''} onClick={() => changeView('list')}>
              <List size={16} strokeWidth={1.75} aria-hidden="true" /> Danh sách
            </button>
          </div>
          <div className={styles.weekNav}>
            <button data-availability-ui="" type="button" className={styles.iconButton} onClick={() => moveWeek(-1)} aria-label="Tuần trước"><ChevronLeft size={18} strokeWidth={1.75} /></button>
            <span>Tuần {shortDate(weekDays[0])} – {shortDate(weekDays[6])}/{weekDays[6].getFullYear()}</span>
            <button data-availability-ui="" type="button" className={styles.iconButton} onClick={() => moveWeek(1)} aria-label="Tuần sau"><ChevronRight size={18} strokeWidth={1.75} /></button>
            <button data-availability-ui="" type="button" className={styles.todayButton} onClick={() => { setWeekStart(startOfWeek(new Date())); setSelectedDay(null) }}>Hôm nay</button>
          </div>
          <div className={styles.filterSegment} role="group" aria-label="Lọc hình thức tham vấn">
            {([
              ['all', 'Tất cả'],
              ['IN_APP_VIDEO', 'Video'],
              ['IN_APP_CHAT', 'Chat'],
            ] as const).map(([value, label]) => (
              <button data-availability-ui="" key={value} type="button" aria-pressed={filter === value} className={filter === value ? styles.selected : ''} onClick={() => setFilter(value)}>
                {label} ({filterCounts[value]})
              </button>
            ))}
          </div>
          <button data-availability-ui="" ref={addButtonRef} type="button" className={styles.primaryButton} onClick={() => openModal()}>
            <Plus size={17} strokeWidth={1.75} aria-hidden="true" /> Thêm khung giờ
          </button>
        </div>

        <div aria-live="polite" aria-atomic="true">
          {error && <p className={styles.error} role="alert">{error} <button data-availability-ui="" type="button" onClick={() => void load()}>Tải lại</button></p>}
          {notice && <p className={styles.notice} role="status">{notice}</p>}
        </div>
        {loading && slots.length === 0 ? (
          <p className={styles.state}>Đang tải lịch khả dụng…</p>
        ) : view === 'cal' ? (
          <>
            <div className={styles.calendarScroll} role="region" aria-label="Lịch tuần" tabIndex={0}>
              <div className={styles.calendarGrid}>
                <div className={styles.calendarCorner}>{timezoneLabel}</div>
                {weekDays.map((day) => {
                  const key = dateKey(day)
                  return <div key={key} className={`${styles.dayHeader} ${key === today() ? styles.currentDay : ''}`}>
                    <small>{WEEKDAY_SHORT[day.getDay()]}</small>
                    <strong>{shortDate(day)}</strong>
                    {restDaySet.has(key) && <em>Zen Day</em>}
                  </div>
                })}
                {HOURS.map((hour) => (
                  <div className={styles.calendarHourRow} key={hour}>
                    <div className={styles.hourLabel}>{hourLabel(hour)}</div>
                    {weekDays.map((day) => {
                      const key = dateKey(day)
                      if (restDaySet.has(key)) return <div className={styles.restCell} key={key}><span>Nghỉ ngơi</span></div>
                      const occupied = activeWeekSlots.filter((slot) => {
                        const time = slotClock(slot, calendarTimezone)
                        return time.date === key && time.hour === hour
                      })
                      const shown = occupied.filter((slot) => filter === 'all' || slot.modality === filter)
                      return <div className={styles.calendarCell} key={key}>
                        {shown.length > 0 ? shown.map((slot) => <div key={slot.id} className={`${styles.calendarSlot} ${slot.modality === 'IN_APP_VIDEO' ? styles.video : styles.chat} ${freshSlotIds.includes(slot.id) ? styles.freshSlot : ''}`}>
                          <div className={styles.calendarSlotTop}>
                            {slot.modality === 'IN_APP_VIDEO' ? <Video size={12} strokeWidth={1.75} aria-hidden="true" /> : <MessageCircle size={12} strokeWidth={1.75} aria-hidden="true" />}
                            <span>{slot.modality === 'IN_APP_VIDEO' ? 'Video' : 'Chat'} (60p)</span>
                            {slot.readiness !== 'STARTED' && <button data-availability-ui="" type="button" disabled={saving} aria-label={`Rút khung ${slotClock(slot, calendarTimezone).range} ngày ${shortDate(day)}`} onClick={() => void withdraw(slot)}><X size={12} strokeWidth={1.75} /></button>}
                          </div>
                          <small>{slotClock(slot, calendarTimezone).range}</small>
                          {slot.readiness !== 'AVAILABLE' && <small>{READINESS_LABELS[slot.readiness]}</small>}
                        </div>) : occupied.length > 0 ? <span className={styles.occupiedCell}>Đã có khung khác</span> : <button data-availability-ui="" type="button" className={styles.emptyCell} disabled={key < today()} aria-label={`Thêm khung giờ ${hourLabel(hour)} ngày ${shortDate(day)}`} onClick={() => openModal(key, hourLabel(hour))}><Plus size={18} strokeWidth={1.75} aria-hidden="true" /></button>}
                      </div>
                    })}
                  </div>
                ))}
              </div>
            </div>
            {offGridSlots.length > 0 && <div className={styles.offGrid}>
              <h2>Khung giờ ngoài khoảng 08:00 – 18:00</h2>
              {offGridSlots.map((slot) => <div className={styles.offGridRow} key={slot.id}>
                <span>{displaySlot(slot)}</span>
                {slot.readiness !== 'STARTED' && <button data-availability-ui="" type="button" className={styles.withdrawButton} disabled={saving} aria-label={`Rút khung ${displaySlot(slot)}`} onClick={() => void withdraw(slot)}>Rút khung</button>}
              </div>)}
            </div>}
            <div className={styles.legend}>
              <span><i className={styles.videoSwatch} /> Video tham vấn</span>
              <span><i className={styles.chatSwatch} /> Chat trò chuyện</span>
              {weekDays.some((day) => restDaySet.has(dateKey(day))) && <span><i className={styles.restSwatch} /> Zen Day (nghỉ)</span>}
              <span className={styles.legendTip}>Bấm vào ô trống trên lịch để thêm nhanh.</span>
            </div>
          </>
        ) : (
          <div className={styles.listView}>
            <div className={styles.dayStrip} role="group" aria-label="Lọc theo ngày">
              {weekDays.map((day) => {
                const key = dateKey(day)
                const dayCount = filteredWeekSlots.filter((slot) => slotClock(slot, calendarTimezone).date === key).length
                return <button data-availability-ui="" type="button" key={key} className={`${styles.dayChip} ${selectedDay === key ? styles.dayChipSelected : ''}`} aria-pressed={selectedDay === key} onClick={() => setSelectedDay((current) => current === key ? null : key)}>
                  <small>{WEEKDAY_SHORT[day.getDay()]}</small><strong>{day.getDate()}</strong><em>{restDaySet.has(key) ? 'Nghỉ' : `${dayCount} khung`}</em>
                </button>
              })}
            </div>
            {listedDays.map((day) => {
              const key = dateKey(day)
              const daySlots = filteredWeekSlots.filter((slot) => slotClock(slot, calendarTimezone).date === key).sort((a, b) => a.startAt.localeCompare(b.startAt))
              if (daySlots.length === 0) return null
              return <section className={styles.dayGroup} key={key} aria-label={day.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}>
                <div className={styles.dayGroupHeading}><h2>{day.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</h2><span>{daySlots.length} khung khả dụng</span></div>
                {daySlots.map((slot) => <div className={`${styles.listRow} ${freshSlotIds.includes(slot.id) ? styles.freshSlot : ''}`} key={slot.id}>
                  <span className={`${styles.modalityIcon} ${slot.modality === 'IN_APP_VIDEO' ? styles.video : styles.chat}`}>
                    {slot.modality === 'IN_APP_VIDEO' ? <Video size={18} strokeWidth={1.75} /> : <MessageCircle size={18} strokeWidth={1.75} />}
                  </span>
                  <div className={styles.slotCopy}><strong>{slotClock(slot, calendarTimezone).range}</strong><small>{slot.modality === 'IN_APP_VIDEO' ? 'Video' : 'Chat'} trong ứng dụng · Múi giờ: {slot.timezone} · 60 phút</small></div>
                  <span className={styles.readiness} data-readiness={slot.readiness}>{READINESS_LABELS[slot.readiness]}</span>
                  {slot.readiness !== 'STARTED' && <button data-availability-ui="" type="button" className={styles.withdrawButton} disabled={saving} aria-label={`Rút khung ${slotClock(slot, calendarTimezone).range} ngày ${shortDate(day)}`} onClick={() => void withdraw(slot)}>Rút khung</button>}
                </div>)}
              </section>
            })}
            {filteredWeekSlots.filter((slot) => !selectedDay || slotClock(slot, calendarTimezone).date === selectedDay).length === 0 && <div className={styles.emptyState}>
              <CalendarDays size={18} strokeWidth={1.75} aria-hidden="true" />
              <h2>Chưa có khung giờ nào</h2>
              <p>Chọn ngày khác hoặc thêm khung giờ tiếp nhận.</p>
              <button data-availability-ui="" type="button" className={styles.secondaryButton} onClick={() => openModal(selectedDay && !restDaySet.has(selectedDay) && selectedDay >= today() ? selectedDay : '', '')}>Thêm khung giờ</button>
            </div>}
          </div>
        )}
      </section>

      {weekWithdrawn > 0 && <section className={styles.withdrawnSection} aria-label="Khung giờ đã rút">
        <h2>Khung giờ đã rút</h2>
        {weekSlots.filter((slot) => slot.status === 'WITHDRAWN').map((slot) => <div key={slot.id}><span>{displaySlot(slot)}</span><span>Đã rút</span></div>)}
      </section>}

      <Dialog open={modalOpen} onOpenChange={setModalOpen} labelledBy="availability-dialog-title" describedBy="availability-dialog-description" className={styles.dialog}>
        <form className={styles.dialogForm} onSubmit={publish}>
          <div className={styles.dialogHeader}>
            <div><h2 id="availability-dialog-title">Thêm khung giờ tiếp nhận</h2><p id="availability-dialog-description">Xuất bản ca tư vấn mới chỉ với vài thao tác.</p></div>
            <button data-availability-ui="" type="button" className={styles.iconButton} aria-label="Đóng" onClick={() => setModalOpen(false)}><X size={18} strokeWidth={1.75} /></button>
          </div>
          <div className={styles.dialogBody}>
            <div className={styles.fieldHeading}><span>Ngày tiếp nhận</span><small>{form.date ? `Đã chọn: ${form.date.slice(8, 10)}/${form.date.slice(5, 7)}` : 'Chọn một ngày'}</small></div>
            <div className={styles.dayChoices} role="group" aria-label="Ngày tiếp nhận">
              {weekDays.map((day) => {
                const key = dateKey(day)
                const isRest = restDaySet.has(key)
                return <button data-availability-ui="" key={key} ref={firstSelectableDay && key === dateKey(firstSelectableDay) ? firstDayRef : undefined} type="button" title={isRest ? 'Ngày nghỉ' : undefined} disabled={isRest || key < today()} aria-pressed={form.date === key} className={form.date === key ? styles.choiceSelected : ''} onClick={() => { updateForm('date', key); updateForm('startTime', '') }}>
                  <small>{WEEKDAY_SHORT[day.getDay()]}</small><strong>{day.getDate()}</strong>
                </button>
              })}
            </div>
            <div className={styles.fieldHeading}><span>Giờ bắt đầu</span><small>Kết thúc tự động (+60 phút)</small></div>
            <div className={styles.hourChoices} role="group" aria-label="Giờ bắt đầu">
              {HOURS.map((hour) => <button data-availability-ui="" key={hour} type="button" disabled={!form.date || hourUnavailable(form.date, hour)} aria-pressed={form.startTime === hourLabel(hour)} className={form.startTime === hourLabel(hour) ? styles.choiceSelected : ''} onClick={() => updateForm('startTime', hourLabel(hour))}>{hourLabel(hour)}</button>)}
            </div>
            {form.startTime && <p className={styles.timeSummary}><Clock3 size={15} strokeWidth={1.75} /> {form.startTime} – {hourLabel(Number(form.startTime.slice(0, 2)) + 1)}</p>}
            <div className={styles.fieldHeading}><span>Hình thức tham vấn</span></div>
            <div className={styles.modalityChoices} role="group" aria-label="Hình thức tham vấn">
              <button data-availability-ui="" type="button" disabled={!videoEnabled} aria-pressed={form.modality === 'IN_APP_VIDEO'} className={form.modality === 'IN_APP_VIDEO' ? styles.modalitySelected : ''} onClick={() => updateForm('modality', 'IN_APP_VIDEO')}><span className={`${styles.modalityIcon} ${styles.video}`}><Video size={18} strokeWidth={1.75} /></span><span><strong>Video bảo mật</strong><small>Video trong ứng dụng</small></span></button>
              <button data-availability-ui="" type="button" aria-pressed={form.modality === 'IN_APP_CHAT'} className={form.modality === 'IN_APP_CHAT' ? styles.modalitySelected : ''} onClick={() => updateForm('modality', 'IN_APP_CHAT')}><span className={`${styles.modalityIcon} ${styles.chat}`}><MessageCircle size={18} strokeWidth={1.75} /></span><span><strong>Chat đồng bộ</strong><small>Chat trong ứng dụng</small></span></button>
            </div>
            {!videoEnabled && <p className={styles.info} role="note">Video chưa sẵn sàng. Bạn vẫn có thể xuất bản lịch chat.</p>}
            {repeatWeeklyEnabled && <button data-availability-ui="" type="button" role="switch" aria-checked={repeatWeekly} className={styles.repeatControl} onClick={() => setRepeatWeekly((current) => !current)}><span><strong>Lặp lại vào tuần sau</strong><small>Tự động lặp lại tuần tới</small></span><span className={`${styles.switchTrack} ${repeatWeekly ? styles.switchOn : ''}`} aria-hidden="true"><i /></span></button>}
            <label className={styles.timezoneField}>Múi giờ hiển thị<input required maxLength={64} value={form.timezone} onChange={(event) => updateForm('timezone', event.target.value)} aria-describedby="timezone-help" /></label>
            <small id="timezone-help" className={styles.timezoneHelp}>Tên IANA, ví dụ Asia/Ho_Chi_Minh.</small>
            {formError && <p className={styles.error} role="alert">{formError}</p>}
          </div>
          <div className={styles.dialogFooter}>
            <button data-availability-ui="" type="button" className={styles.secondaryButton} onClick={() => setModalOpen(false)}>Hủy</button>
            <button data-availability-ui="" type="submit" className={styles.primaryButton} disabled={saving || !form.date || !form.startTime || form.date < today() || restDaySet.has(form.date)}><Plus size={17} strokeWidth={1.75} />{saving ? 'Đang lưu…' : 'Xuất bản khung giờ'}</button>
          </div>
        </form>
      </Dialog>
    </section>
  )
}
