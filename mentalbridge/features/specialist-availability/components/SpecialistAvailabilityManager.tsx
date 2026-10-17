'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Globe2,
  Info,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import {
  AvailabilityBrowserError,
  browserAvailability,
} from '../api/browser-client'
import type {
  AvailabilityModality,
  AvailabilitySlot,
} from '@/lib/consultation/consultation-validation'
import {
  AvailabilityDatePicker,
  AvailabilityTimePicker,
} from './AvailabilityPickers'
import {
  addDays,
  availabilityWindow,
  dateInTimezone,
  formatDate,
  formatTime,
  localSlotToUtc,
  timezoneOffset,
  validTimezone,
} from './availability-time'
import styles from './SpecialistAvailabilityManager.module.css'

export { localSlotToUtc } from './availability-time'

type FormState = Readonly<{
  date: string
  startTime: string
  timezone: string
  modality: AvailabilityModality
}>
type Filter = 'ALL' | 'AVAILABLE' | 'WITHDRAWN'
const READINESS_LABELS = {
  AVAILABLE: 'Có thể đặt',
  STARTED: 'Đã bắt đầu',
  WITHDRAWN: 'Đã rút',
  VIDEO_DISABLED: 'Video đang tắt',
} as const
const TIMES = [
  ['09:00', '09:30', '10:00', '11:00'],
  ['14:00', '15:00', '16:00', '19:00'],
]
const withdrawReloadCodes = new Set([
  'AVAILABILITY_SLOT_NOT_FOUND',
  'AVAILABILITY_SLOT_STALE',
  'AVAILABILITY_SLOT_VERSION_MISMATCH',
  'AVAILABILITY_SLOT_WITHDRAWN',
])

function friendlyError(error: unknown, reloaded = false) {
  if (error instanceof AvailabilityBrowserError) {
    const suffix = reloaded ? ' Danh sách mới nhất đã được tải lại.' : ''
    switch (error.code) {
      case 'AVAILABILITY_SLOT_OVERLAP':
        return 'Khung giờ này trùng với một khung giờ đang hoạt động. Hãy chọn thời gian khác.'
      case 'VIDEO_AVAILABILITY_DISABLED':
        return 'Tư vấn video trong ứng dụng chưa được bật. Hãy chọn chat trong ứng dụng.'
      case 'SPECIALIST_NOT_APPROVED':
        return 'Hồ sơ chuyên gia cần được phê duyệt trước khi xuất bản lịch khả dụng.'
      case 'IDEMPOTENCY_KEY_REUSED':
        return 'Yêu cầu xuất bản xung đột với một lần gửi trước. Hãy thử lại.'
      case 'AVAILABILITY_SLOT_VERSION_MISMATCH':
        return `Khung giờ đã thay đổi.${suffix || ' Hãy tải lại danh sách rồi thử lại.'}`
      case 'AVAILABILITY_SLOT_WITHDRAWN':
        return `Khung giờ này đã được rút.${suffix}`
      case 'AVAILABILITY_SLOT_STALE':
        return `Khung giờ đã bắt đầu nên không thể rút.${suffix}`
      case 'AVAILABILITY_SLOT_NOT_FOUND':
        return `Không tìm thấy khung giờ này.${suffix}`
      case 'AVAILABILITY_SLOT_VERSION_REQUIRED':
        return 'Không thể xác định phiên bản khung giờ. Hãy tải lại danh sách rồi thử lại.'
      case 'VALIDATION_FAILED':
        return 'Dữ liệu khung giờ không hợp lệ. Hãy kiểm tra ngày, giờ và múi giờ.'
      case 'UNAUTHENTICATED':
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      case 'CONSULTATION_ROLE_REQUIRED':
        return 'Tài khoản hiện tại không có quyền quản lý lịch chuyên gia.'
    }
  }
  return 'Chưa thể kết nối để hoàn tất yêu cầu. Dữ liệu bạn nhập vẫn được giữ lại. Hãy thử lại.'
}

function slotDate(slot: AvailabilitySlot) {
  return dateInTimezone(Date.parse(slot.startAt), slot.timezone)
}
function slotRange(
  slot: Pick<AvailabilitySlot, 'startAt' | 'endAt' | 'timezone'>,
) {
  const startOffset = timezoneOffset(slot.timezone, Date.parse(slot.startAt))
  const endOffset = timezoneOffset(slot.timezone, Date.parse(slot.endAt))
  const offsetsChanged = startOffset !== endOffset
  const nextDay =
    dateInTimezone(Date.parse(slot.endAt), slot.timezone) !==
    dateInTimezone(Date.parse(slot.startAt), slot.timezone)
  return `${formatTime(slot.startAt, slot.timezone)}${offsetsChanged ? ` ${startOffset}` : ''} – ${formatTime(slot.endAt, slot.timezone)}${offsetsChanged ? ` ${endOffset}` : ''}${nextDay ? ' (+1 ngày)' : ''}`
}

export default function SpecialistAvailabilityManager() {
  const { showActionToast } = useFeedback()
  const [form, setForm] = useState<FormState>({
    date: '',
    startTime: '',
    timezone: 'Asia/Ho_Chi_Minh',
    modality: 'IN_APP_CHAT',
  })
  const [now, setNow] = useState(0)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [reading, setReading] = useState(true)
  const [pending, setPending] = useState<'publish' | 'withdraw' | null>(null)
  const [listError, setListError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [updatedAt, setUpdatedAt] = useState('')
  const [rangeAnchor, setRangeAnchor] = useState('')
  const [loadedAnchor, setLoadedAnchor] = useState('')
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [withdrawTarget, setWithdrawTarget] = useState<AvailabilitySlot | null>(
    null,
  )
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const listRef = useRef<HTMLHeadingElement>(null)
  const rangeAnchorRef = useRef('')
  const restoreListFocus = useCallback(() => listRef.current, [])
  const mounted = useRef(false)
  const readSequence = useRef(0)
  const pendingRef = useRef(false)
  const idempotencyKey = useRef<{ key: string; fingerprint: string } | null>(
    null,
  )

  const expireAccess = useCallback((caught: unknown) => {
    if (
      caught instanceof AvailabilityBrowserError &&
      [401, 403].includes(caught.status)
    ) {
      setSlots([])
      setLoaded(false)
      setVideoEnabled(false)
      setWithdrawTarget(null)
      setWithdrawOpen(false)
      return true
    }
    return false
  }, [])

  const load = useCallback(
    async (anchor = rangeAnchorRef.current) => {
      const sequence = ++readSequence.current
      rangeAnchorRef.current = anchor
      setRangeAnchor(anchor)
      setReading(true)
      setListError('')
      try {
        const { data } = await browserAvailability.list(
          anchor ? availabilityWindow(anchor) : undefined,
        )
        if (!mounted.current || sequence !== readSequence.current) return false
        setSlots(data.items)
        setVideoEnabled(data.videoPublishingEnabled)
        setLoaded(true)
        setUpdatedAt(data.generatedAt)
        setLoadedAnchor(anchor)
        setForm((current) =>
          !data.videoPublishingEnabled && current.modality === 'IN_APP_VIDEO'
            ? { ...current, modality: 'IN_APP_CHAT' }
            : current,
        )
        return true
      } catch (caught) {
        if (!mounted.current || sequence !== readSequence.current) return false
        expireAccess(caught)
        setListError(friendlyError(caught))
        return false
      } finally {
        if (mounted.current && sequence === readSequence.current)
          setReading(false)
      }
    },
    [expireAccess],
  )

  useEffect(() => {
    mounted.current = true
    const frame = window.requestAnimationFrame(() => {
      setNow(Date.now())
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      const timezone =
        detected === 'Asia/Saigon' ? 'Asia/Ho_Chi_Minh' : detected
      if (timezone && validTimezone(timezone))
        setForm((current) => ({ ...current, timezone }))
      void load(dateInTimezone(Date.now(), timezone || 'Asia/Ho_Chi_Minh'))
    })
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      mounted.current = false
      readSequence.current += 1
      window.clearInterval(timer)
      window.cancelAnimationFrame(frame)
    }
  }, [load])

  const safeTimezone = validTimezone(form.timezone)
    ? form.timezone
    : 'Asia/Ho_Chi_Minh'
  const minDate = now ? dateInTimezone(now, safeTimezone) : '1970-01-01'
  const quickDays = now
    ? Array.from({ length: 5 }, (_, index) => addDays(minDate, index))
    : []
  const counts = useMemo(
    () => ({
      available: slots.filter((slot) => slot.readiness === 'AVAILABLE').length,
      withdrawn: slots.filter((slot) => slot.status === 'WITHDRAWN').length,
    }),
    [slots],
  )
  const visibleSlots = useMemo(
    () =>
      slots
        .filter(
          (slot) =>
            filter === 'ALL' ||
            (filter === 'AVAILABLE'
              ? slot.readiness === 'AVAILABLE'
              : slot.status === 'WITHDRAWN'),
        )
        .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
    [slots, filter],
  )

  const selection = useMemo(() => {
    if (!form.date || !form.startTime)
      return { range: null, issue: '', overlap: false }
    if (!validTimezone(form.timezone))
      return {
        range: null,
        issue: 'Múi giờ chưa hợp lệ. Ví dụ: Asia/Ho_Chi_Minh.',
        overlap: false,
      }
    try {
      const range = localSlotToUtc(form.date, form.startTime, form.timezone)
      if (Date.parse(range.startAt) <= now)
        return {
          range,
          issue: 'Giờ này đã qua. Hãy chọn thời điểm bắt đầu trong tương lai.',
          overlap: false,
        }
      const overlap = slots.some(
        (slot) =>
          slot.status === 'ACTIVE' &&
          Date.parse(range.startAt) < Date.parse(slot.endAt) &&
          Date.parse(range.endAt) > Date.parse(slot.startAt),
      )
      return {
        range,
        issue: overlap
          ? 'Giờ này trùng lịch đã lưu. Hãy chọn một khung giờ khác.'
          : '',
        overlap,
      }
    } catch {
      return {
        range: null,
        issue: 'Ngày hoặc giờ không tồn tại trong múi giờ đã chọn.',
        overlap: false,
      }
    }
  }, [form.date, form.startTime, form.timezone, now, slots])

  const updateForm = <Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) => {
    if (pendingRef.current || form[key] === value) return
    idempotencyKey.current = null
    setForm((current) => ({ ...current, [key]: value }))
    setFormError('')
  }
  const resetForm = () => {
    if (pendingRef.current) return
    idempotencyKey.current = null
    setForm((current) => ({
      ...current,
      date: '',
      startTime: '',
      modality: 'IN_APP_CHAT',
    }))
    setFormError('')
    formRef.current
      ?.querySelector<HTMLInputElement>('input[type="date"]')
      ?.focus()
  }
  const beginCommand = (kind: 'publish' | 'withdraw') => {
    if (pendingRef.current) return false
    pendingRef.current = true
    readSequence.current += 1
    setReading(false)
    setPending(kind)
    setNotice('')
    return true
  }
  const finishCommand = () => {
    pendingRef.current = false
    if (mounted.current) setPending(null)
  }
  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (selection.range && Date.parse(selection.range.startAt) <= Date.now()) {
      setNow(Date.now())
      return
    }
    if (
      !loaded ||
      !selection.range ||
      selection.issue ||
      !beginCommand('publish')
    )
      return
    setFormError('')
    try {
      const body = {
        ...selection.range,
        timezone: form.timezone,
        modality: form.modality,
      }
      const fingerprint = JSON.stringify(body)
      const key =
        idempotencyKey.current?.fingerprint === fingerprint
          ? idempotencyKey.current.key
          : crypto.randomUUID()
      idempotencyKey.current = { key, fingerprint }
      const { data } = await browserAvailability.publish(body, key)
      if (!mounted.current) return
      setSlots((current) => [
        data,
        ...current.filter((slot) => slot.id !== data.id),
      ])
      setHighlighted(data.id)
      setFilter('ALL')
      idempotencyKey.current = null
      setForm((current) => ({ ...current, date: '', startTime: '' }))
      const message =
        data.readiness === 'AVAILABLE'
          ? 'Đã xuất bản khung giờ tư vấn trực tuyến 60 phút.'
          : `Yêu cầu đã được lưu. Trạng thái khung giờ: ${READINESS_LABELS[data.readiness].toLowerCase()}.`
      setNotice(message)
      showActionToast({
        title: 'Đã lưu khung giờ tư vấn',
        description: message,
        tone: 'success',
      })
      if (rangeAnchorRef.current) {
        const window = availabilityWindow(rangeAnchorRef.current)
        if (
          Date.parse(data.startAt) < Date.parse(window.from) ||
          Date.parse(data.startAt) >= Date.parse(window.to)
        ) {
          await load(slotDate(data))
        }
      }
    } catch (caught) {
      if (!mounted.current) return
      expireAccess(caught)
      if (
        caught instanceof AvailabilityBrowserError &&
        caught.code === 'IDEMPOTENCY_KEY_REUSED'
      )
        idempotencyKey.current = null
      if (
        caught instanceof AvailabilityBrowserError &&
        caught.code === 'VIDEO_AVAILABILITY_DISABLED'
      ) {
        setVideoEnabled(false)
        setForm((current) => ({ ...current, modality: 'IN_APP_CHAT' }))
        idempotencyKey.current = null
      }
      setFormError(friendlyError(caught))
    } finally {
      finishCommand()
    }
  }
  const withdraw = async () => {
    if (
      !withdrawOpen ||
      !withdrawTarget ||
      !loaded ||
      !beginCommand('withdraw')
    )
      return
    setWithdrawError('')
    try {
      const { data } = await browserAvailability.withdraw(
        withdrawTarget.id,
        withdrawTarget.version,
      )
      if (!mounted.current) return
      setSlots((current) =>
        current.map((slot) => (slot.id === data.id ? data : slot)),
      )
      setHighlighted(data.id)
      setWithdrawOpen(false)
      setNotice(
        'Đã rút khung giờ khỏi lịch khả dụng. Các cuộc hẹn đã có không bị thay đổi.',
      )
      showActionToast({
        title: 'Đã rút khung giờ',
        description: 'Khung giờ không còn nhận lượt đặt mới.',
        tone: 'success',
      })
    } catch (caught) {
      if (!mounted.current) return
      if (expireAccess(caught)) setListError(friendlyError(caught))
      else if (
        caught instanceof AvailabilityBrowserError &&
        withdrawReloadCodes.has(caught.code)
      ) {
        const reloaded = await load()
        if (!mounted.current) return
        setWithdrawOpen(false)
        setListError(friendlyError(caught, reloaded))
      } else setWithdrawError(friendlyError(caught))
    } finally {
      finishCommand()
    }
  }
  const suggestIssue = (time: string) => {
    if (!form.date) return 'Chọn ngày trước'
    if (!validTimezone(form.timezone)) return 'Múi giờ chưa hợp lệ'
    try {
      const range = localSlotToUtc(form.date, time, safeTimezone)
      if (Date.parse(range.startAt) <= now) return 'Thời điểm đã qua'
      if (
        slots.some(
          (slot) =>
            slot.status === 'ACTIVE' &&
            Date.parse(range.startAt) < Date.parse(slot.endAt) &&
            Date.parse(range.endAt) > Date.parse(slot.startAt),
        )
      )
        return 'Trùng khung giờ đã lưu'
      return ''
    } catch {
      return 'Giờ không tồn tại trong múi giờ này'
    }
  }

  return (
    <section
      className={styles.manager}
      data-availability-ui
      aria-labelledby="availability-title"
    >
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>
            <span />
            Không gian chuyên gia
          </span>
          <h1 id="availability-title">Lịch khả dụng trực tuyến</h1>
          <p>
            Chọn thời gian phù hợp cho những cuộc trò chuyện. Mỗi khung tư vấn
            kéo dài 60 phút.
          </p>
        </div>
        <div className={styles.summary} aria-label="Tổng quan lịch khả dụng">
          <button
            type="button"
            aria-label="Xem khung giờ có thể đặt"
            aria-pressed={filter === 'AVAILABLE'}
            disabled={!loaded}
            onClick={() =>
              setFilter(filter === 'AVAILABLE' ? 'ALL' : 'AVAILABLE')
            }
          >
            <span className={styles.statusDot} />
            <strong>{loaded ? counts.available : '—'}</strong> có thể đặt
          </button>
          <button
            type="button"
            aria-label="Xem khung giờ đã rút"
            aria-pressed={filter === 'WITHDRAWN'}
            disabled={!loaded}
            onClick={() =>
              setFilter(filter === 'WITHDRAWN' ? 'ALL' : 'WITHDRAWN')
            }
          >
            <CalendarX2 size={14} />
            <strong>{loaded ? counts.withdrawn : '—'}</strong> đã rút
          </button>
        </div>
      </header>
      <div className={styles.layout}>
        <form
          ref={formRef}
          className={styles.form}
          onSubmit={publish}
          aria-labelledby="availability-form-title"
        >
          <div className={styles.panelHeading}>
            <div>
              <h2 id="availability-form-title">Thêm khung giờ</h2>
              <p>Thiết lập một lời mời trò chuyện.</p>
            </div>
            <button
              type="button"
              className={styles.resetButton}
              disabled={
                !!pending ||
                (!form.date &&
                  !form.startTime &&
                  form.modality === 'IN_APP_CHAT')
              }
              onClick={resetForm}
            >
              Nhập lại
            </button>
          </div>
          <fieldset disabled={!!pending} className={styles.formFields}>
            <legend className={styles.srOnly}>
              Thiết lập khung giờ tư vấn
            </legend>
            <div className={styles.fieldHeading}>
              <span>Chọn ngày làm việc</span>
              {form.date && (
                <small>
                  {formatDate(form.date, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </small>
              )}
            </div>
            <div
              className={styles.quickDays}
              aria-label="Chọn nhanh ngày tư vấn"
            >
              {quickDays.map((date) => (
                <button
                  key={date}
                  type="button"
                  aria-label={formatDate(date, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  aria-pressed={form.date === date}
                  onClick={() => updateForm('date', date)}
                >
                  <span>
                    {date === minDate
                      ? 'Hôm nay'
                      : formatDate(date, { weekday: 'short' })}
                  </span>
                  <strong>{date.slice(-2)}</strong>
                  <small>{formatDate(date, { month: '2-digit' })}</small>
                </button>
              ))}
            </div>
            <AvailabilityDatePicker
              value={form.date}
              min={minDate}
              disabled={!!pending}
              onChange={(value) => updateForm('date', value)}
            />
            <div className={styles.fieldHeading}>
              <span>Khung giờ hợp ý bạn</span>
              <small>60 phút / khung</small>
            </div>
            {TIMES.map((times, index) => (
              <div key={index} className={styles.timeSuggestions}>
                <small>{index === 0 ? 'Buổi sáng' : 'Buổi chiều & tối'}</small>
                <div>
                  {times.map((time) => {
                    const issue = suggestIssue(time)
                    return (
                      <button
                        key={time}
                        type="button"
                        aria-label={`Chọn ${time}${issue ? ` · ${issue}` : ''}`}
                        aria-pressed={form.startTime === time}
                        disabled={!!pending || !!issue}
                        title={issue || `${time} · 60 phút`}
                        onClick={() => updateForm('startTime', time)}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <AvailabilityTimePicker
              value={form.startTime}
              disabled={!!pending}
              onChange={(value) => updateForm('startTime', value)}
            />
            <div className={styles.timezoneField}>
              <label htmlFor="availability-timezone">Múi giờ hiển thị</label>
              <div className={styles.inputShell}>
                <Globe2 size={16} />
                <input
                  id="availability-timezone"
                  required
                  maxLength={64}
                  list="availability-timezones"
                  value={form.timezone}
                  onChange={(event) =>
                    updateForm('timezone', event.target.value)
                  }
                  aria-describedby="availability-timezone-help"
                  aria-invalid={!validTimezone(form.timezone)}
                />
              </div>
              <datalist id="availability-timezones">
                {[
                  'Asia/Ho_Chi_Minh',
                  'Asia/Bangkok',
                  'Asia/Singapore',
                  'Europe/London',
                  'America/New_York',
                ].map((zone) => (
                  <option key={zone} value={zone} />
                ))}
              </datalist>
              <small id="availability-timezone-help">
                Tên múi giờ IANA ·{' '}
                {now ? timezoneOffset(safeTimezone, now) : 'GMT+7'}
              </small>
            </div>
            <fieldset className={styles.modalityGroup}>
              <legend>Hình thức tư vấn</legend>
              <div className={styles.modalities}>
                <label
                  className={styles.modality}
                  data-selected={form.modality === 'IN_APP_CHAT'}
                >
                  <input
                    type="radio"
                    name="availability-modality"
                    aria-label="Chat trong ứng dụng"
                    checked={form.modality === 'IN_APP_CHAT'}
                    onChange={() => updateForm('modality', 'IN_APP_CHAT')}
                  />
                  <span>
                    <MessageSquare size={18} />
                    <strong>Chat trực tuyến</strong>
                    <Check size={14} />
                  </span>
                  <small>Nhắn tin trực tiếp với bạn.</small>
                </label>
                <label
                  className={styles.modality}
                  data-selected={form.modality === 'IN_APP_VIDEO'}
                  data-disabled={!videoEnabled}
                >
                  <input
                    type="radio"
                    name="availability-modality"
                    aria-label="Video trong ứng dụng"
                    checked={form.modality === 'IN_APP_VIDEO'}
                    disabled={!loaded || !videoEnabled}
                    onChange={() => updateForm('modality', 'IN_APP_VIDEO')}
                  />
                  <span>
                    <Video size={18} />
                    <strong>Video call</strong>
                    {videoEnabled ? (
                      <Check size={14} />
                    ) : (
                      <LockKeyhole size={13} />
                    )}
                  </span>
                  <small>
                    {!loaded
                      ? 'Đang kiểm tra hình thức tư vấn…'
                      : videoEnabled
                        ? 'Gặp gỡ qua video trong ứng dụng.'
                        : 'Chưa được bật cho lịch tư vấn.'}
                  </small>
                </label>
              </div>
            </fieldset>
            {loaded && !videoEnabled && (
              <p className={styles.info} role="note">
                <Info size={16} />
                <span>
                  <strong>Video chưa sẵn sàng.</strong> Bạn vẫn có thể xuất bản
                  lịch chat.
                </span>
              </p>
            )}
            <div
              className={styles.preview}
              aria-live="polite"
              aria-atomic="true"
              data-ready={!!selection.range && !selection.issue}
            >
              <Clock3 size={18} />
              <div>
                <small>Khung giờ sẽ xuất bản</small>
                <strong>
                  {selection.range
                    ? slotRange({ ...selection.range, timezone: form.timezone })
                    : 'Chọn ngày và giờ bắt đầu'}
                </strong>
                {selection.range && (
                  <span>
                    {formatDate(form.date, {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    })}{' '}
                    · 60 phút ·{' '}
                    {form.modality === 'IN_APP_CHAT' ? 'Chat' : 'Video'}
                  </span>
                )}
              </div>
              {selection.range && !selection.issue && (
                <CheckCircle2 size={17} />
              )}
            </div>
            {selection.issue && (
              <p className={styles.fieldIssue}>
                <Info size={15} />
                {selection.issue}
              </p>
            )}
            {formError && (
              <p className={styles.error} role="alert">
                {formError}
              </p>
            )}
            <button
              type="submit"
              className={`btn-primary ${styles.primaryButton}`}
              disabled={
                !loaded ||
                !!pending ||
                !selection.range ||
                !!selection.issue ||
                (form.modality === 'IN_APP_VIDEO' && !videoEnabled)
              }
            >
              {pending === 'publish' ? (
                <>
                  <LoaderCircle className={styles.spinner} size={18} />
                  Đang xuất bản…
                </>
              ) : (
                <>
                  <CalendarPlus size={18} />
                  Xuất bản khung giờ
                </>
              )}
            </button>
          </fieldset>
        </form>
        <div className={styles.rightColumn}>
          <section
            className={styles.list}
            aria-labelledby="availability-list-title"
            aria-busy={reading}
          >
            <div className={styles.listHeading}>
              <div>
                <CalendarDays size={19} />
                <h2 ref={listRef} tabIndex={-1} id="availability-list-title">
                  Khung giờ đã lưu
                </h2>
                <span className={styles.countBadge}>
                  {loaded ? visibleSlots.length : '—'}
                </span>
              </div>
              <button
                type="button"
                className={styles.refreshButton}
                onClick={() => void load()}
                disabled={reading || !!pending}
              >
                <RefreshCw
                  size={14}
                  className={reading ? styles.spinner : ''}
                />
                {reading && loaded ? 'Đang tải…' : 'Tải lại'}
              </button>
            </div>
            <div className={styles.rangeControl}>
              <label htmlFor="availability-list-date">
                Xem lịch quanh ngày
              </label>
              <input
                id="availability-list-date"
                type="date"
                value={rangeAnchor}
                disabled={!now || !!pending}
                onChange={(event) => {
                  setRangeAnchor(event.target.value)
                  if (event.target.value) void load(event.target.value)
                }}
              />
              {rangeAnchor && rangeAnchor !== minDate && (
                <button
                  type="button"
                  className={styles.textButton}
                  disabled={!!pending || reading}
                  onClick={() => void load(minDate)}
                >
                  Hôm nay
                </button>
              )}
            </div>
            {filter !== 'ALL' && (
              <div className={styles.activeFilter}>
                <span>
                  {filter === 'AVAILABLE'
                    ? 'Các khung giờ có thể đặt'
                    : 'Các khung giờ đã rút'}
                </span>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => setFilter('ALL')}
                >
                  Xem tất cả
                  <X size={14} />
                </button>
              </div>
            )}
            {notice && (
              <div className={styles.notice} role="status">
                <CheckCircle2 size={18} />
                <span>{notice}</span>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Đóng thông báo khung giờ"
                  onClick={() => setNotice('')}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {listError && (
              <div className={styles.error} role="alert">
                <Info size={18} />
                <div>
                  <strong>
                    {loaded
                      ? 'Chưa thể cập nhật danh sách'
                      : 'Chưa thể tải lịch khả dụng'}
                  </strong>
                  <p>{listError}</p>
                  {loaded && (
                    <small>
                      Các khung giờ đã tải vẫn đang hiển thị bên dưới.
                    </small>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.textButton}
                  disabled={reading || !!pending}
                  onClick={() => void load()}
                >
                  Thử lại
                </button>
              </div>
            )}
            {reading && !loaded ? (
              <div className={styles.loading} role="status">
                <LoaderCircle size={24} className={styles.spinner} />
                <span>Đang tải lịch khả dụng…</span>
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
              </div>
            ) : !loaded ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>
                  <CalendarX2 size={30} />
                </span>
                <h3>Chưa có dữ liệu để hiển thị</h3>
                <p>Tải lại lịch để tiếp tục quản lý khung giờ của bạn.</p>
              </div>
            ) : visibleSlots.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>
                  <CalendarDays size={32} />
                  <i />
                  <i />
                  <i />
                </span>
                <h3>
                  {filter === 'ALL'
                    ? 'Chưa có khung giờ nào được xuất bản'
                    : filter === 'AVAILABLE'
                      ? 'Chưa có khung giờ có thể đặt'
                      : 'Chưa có khung giờ đã rút'}
                </h3>
                <p>
                  {filter === 'ALL'
                    ? 'Hãy thiết lập ngày và giờ phù hợp để người dùng có thể hẹn trò chuyện cùng bạn.'
                    : 'Bạn có thể xem lại tất cả các khung giờ đã lưu.'}
                </p>
                <button
                  type="button"
                  className={`btn-outline ${styles.emptyAction}`}
                  onClick={() => {
                    if (filter !== 'ALL') setFilter('ALL')
                    else
                      formRef.current
                        ?.querySelector<HTMLInputElement>('input[type="date"]')
                        ?.focus()
                  }}
                >
                  {filter === 'ALL' ? (
                    <>
                      <CalendarPlus size={16} />
                      Tạo khung giờ đầu tiên
                    </>
                  ) : (
                    'Xem tất cả khung giờ'
                  )}
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : (
              <ul className={styles.slots}>
                {visibleSlots.map((slot) => (
                  <li
                    key={slot.id}
                    className={styles.slot}
                    data-withdrawn={slot.status === 'WITHDRAWN'}
                    data-highlighted={slot.id === highlighted}
                  >
                    <div className={styles.dateTile}>
                      <small>THÁNG {slotDate(slot).slice(5, 7)}</small>
                      <strong>{slotDate(slot).slice(-2)}</strong>
                      <span>
                        {formatDate(slotDate(slot), { weekday: 'short' })}
                      </span>
                    </div>
                    <div className={styles.slotDetails}>
                      <div className={styles.slotTitle}>
                        <h3>{slotRange(slot)}</h3>
                        <span
                          className={styles.readiness}
                          data-readiness={slot.readiness}
                        >
                          {slot.readiness === 'AVAILABLE' ? (
                            <span className={styles.statusDot} />
                          ) : slot.readiness === 'WITHDRAWN' ? (
                            <CalendarX2 size={12} />
                          ) : (
                            <Clock3 size={12} />
                          )}
                          {READINESS_LABELS[slot.readiness]}
                        </span>
                      </div>
                      <p>
                        {formatDate(slotDate(slot), {
                          weekday: 'long',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </p>
                      <div className={styles.slotMeta}>
                        <span>
                          {slot.modality === 'IN_APP_CHAT' ? (
                            <MessageSquare size={13} />
                          ) : (
                            <Video size={13} />
                          )}
                          {slot.modality === 'IN_APP_CHAT'
                            ? 'Chat trong ứng dụng'
                            : 'Video trong ứng dụng'}
                        </span>
                        <span>
                          <Clock3 size={13} />
                          60 phút
                        </span>
                      </div>
                      <small>{slot.timezone}</small>
                    </div>
                    {slot.status === 'ACTIVE' &&
                      slot.readiness !== 'STARTED' && (
                        <button
                          type="button"
                          className={styles.withdrawButton}
                          disabled={!!pending || !loaded}
                          onClick={() => {
                            setWithdrawTarget(slot)
                            setWithdrawOpen(true)
                            setWithdrawError('')
                          }}
                        >
                          <Trash2 size={15} />
                          Rút khung giờ
                        </button>
                      )}
                  </li>
                ))}
              </ul>
            )}
            <footer className={styles.listFooter}>
              <span>
                <Clock3 size={13} />
                {loadedAnchor && loaded
                  ? `Lịch đã tải: ${formatDate(addDays(loadedAnchor, -7), { day: '2-digit', month: '2-digit', year: 'numeric' })} – ${formatDate(addDays(loadedAnchor, 89), { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                  : 'Mỗi khung 60 phút · Giờ theo múi giờ đã lưu'}
              </span>
              {updatedAt && loaded && (
                <span>Cập nhật {formatTime(updatedAt, safeTimezone)}</span>
              )}
            </footer>
          </section>
          <aside className={styles.tip}>
            <span className={styles.tipIcon}>
              <Lightbulb size={21} />
            </span>
            <div>
              <h3>Một lịch hẹn, một khoảng dành riêng</h3>
              <p>
                Bắt đầu với những khung giờ bạn có thể dành trọn vẹn. Thời gian
                rõ ràng giúp cả hai dễ dàng sắp xếp.
              </p>
            </div>
          </aside>
          <div className={styles.privacy}>
            <ShieldCheck size={19} />
            <p>
              <strong>Bạn luôn chủ động với lịch của mình.</strong> Rút một
              khung giờ chỉ dừng nhận lượt đặt mới, không hủy các cuộc hẹn đã
              có.
            </p>
          </div>
        </div>
      </div>
      <Dialog
        open={withdrawOpen && !!withdrawTarget}
        onOpenChange={(open) => {
          if (!open && !pendingRef.current) setWithdrawOpen(false)
        }}
        labelledBy="availability-withdraw-title"
        describedBy="availability-withdraw-description"
        className={styles.withdrawDialog}
        restoreFocusTo={restoreListFocus}
      >
        {withdrawTarget && (
          <div className={styles.dialogContent}>
            <button
              type="button"
              className={styles.dialogClose}
              aria-label="Đóng xác nhận rút khung giờ"
              disabled={!!pending}
              onClick={() => setWithdrawOpen(false)}
            >
              <X size={20} />
            </button>
            <span className={styles.warningIcon}>
              <CalendarX2 size={29} />
            </span>
            <h2 id="availability-withdraw-title">Rút khung giờ này?</h2>
            <p id="availability-withdraw-description">
              Khung giờ sẽ không còn nhận lượt đặt mới. Các cuộc hẹn đã có không
              bị thay đổi.
            </p>
            <div className={styles.dialogSlot}>
              <CalendarDays size={21} />
              <div>
                <strong>{slotRange(withdrawTarget)}</strong>
                <span>
                  {formatDate(slotDate(withdrawTarget), {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
                <small>
                  {withdrawTarget.timezone} ·{' '}
                  {withdrawTarget.modality === 'IN_APP_CHAT' ? 'Chat' : 'Video'}
                </small>
              </div>
            </div>
            {withdrawError && (
              <p role="alert" className={styles.error}>
                {withdrawError}
              </p>
            )}
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={`btn-outline ${styles.keepButton}`}
                autoFocus
                disabled={!!pending}
                onClick={() => setWithdrawOpen(false)}
              >
                Giữ lại khung giờ
              </button>
              <button
                type="button"
                className={`btn-primary ${styles.confirmWithdraw}`}
                disabled={!!pending || !withdrawOpen}
                onClick={() => void withdraw()}
              >
                {pending === 'withdraw' ? (
                  <>
                    <LoaderCircle size={16} className={styles.spinner} />
                    Đang rút…
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Rút khung giờ
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  )
}
