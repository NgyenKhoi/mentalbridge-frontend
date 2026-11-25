'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import {
  AlertCircle,
  CalendarDays,
  Check,
  Clock,
  FileText,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  X,
} from 'lucide-react'

import { ApiError } from '@/lib/api/api-error'
import type {
  Appointment,
  AppointmentChatEligibility,
} from '@/lib/consultation/consultation-validation'
import type { SessionSummary } from '@/lib/consultation/session-summary-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import { sessionSummaryBrowserClient } from '../api/session-summary-browser-client'
import {
  chatEligibility,
  chatHistory,
  type ChatMessage,
} from '../api/chat-browser-client'
import {
  appointmentCreditLabel,
  appointmentModalityLabel,
  appointmentStatusLabel,
  canOpenChat,
} from '../model/appointment-view'
import AppointmentChatPanel from './AppointmentChatPanel'
import styles from './SpecialistChatView.module.css'
import './session-record-print.css'

// ==========================================
// 1. Data Models & TypeScript Interfaces
// ==========================================

export type MessageSenderType = 'specialist' | 'user' | 'system'

export interface RecommendationItem {
  id: string
  title: string
  items: string[]
}

export interface ChatMessageItem {
  id: string
  senderType: MessageSenderType
  senderName: string
  senderAvatar?: string
  timestamp: string
  content: string
  recommendations?: RecommendationItem
}

export interface SpecialistProfile {
  id: string
  name: string
  avatarUrl?: string
}

export interface AppointmentSummary {
  id: string
  specialist: SpecialistProfile
  date: string
  timeSlot: string
  durationMinutes: number
  status: 'completed' | 'ended' | 'upcoming' | 'cancelled'
  statusLabel: string
  isActive: boolean
  rawAppointment: Appointment
}

export interface EmrSessionData {
  appointmentId: string
  consultationTime: {
    date: string
    timeRange: string
    durationLabel: string
  }
  summaryText: string | null
  nextSteps: Array<{
    step: number
    title: string
    description?: string
    isDone?: boolean
  }> | null
  creditLabel: string
}

interface SpecialistChatViewProps {
  initialAppointmentId?: string
  viewerRole?: 'USER' | 'SPECIALIST'
}

// ==========================================
// 2. Helper Functions
// ==========================================

function getInitials(name: string) {
  if (!name) return 'BS'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatSessionDate(isoString: string, timezone = 'Asia/Ho_Chi_Minh') {
  try {
    const d = new Date(isoString)
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      timeZone: timezone,
    }).format(d)
  } catch {
    return '01/10'
  }
}

function formatFullDate(isoString: string, timezone = 'Asia/Ho_Chi_Minh') {
  try {
    const d = new Date(isoString)
    const formatted = new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: timezone,
    }).format(d)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  } catch {
    return 'Thứ Năm, ngày 01 tháng 10, 2026'
  }
}

function formatTimeRange(
  startIso: string,
  endIso: string,
  timezone = 'Asia/Ho_Chi_Minh',
) {
  try {
    const s = new Date(startIso)
    const e = new Date(endIso)
    const fmt = new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: timezone,
    })
    return `${fmt.format(s)} – ${fmt.format(e)}`
  } catch {
    return '22:55 – 23:55'
  }
}

function calculateDurationMinutes(startIso: string, endIso: string) {
  try {
    const s = new Date(startIso).getTime()
    const e = new Date(endIso).getTime()
    return Math.max(15, Math.round((e - s) / 60000))
  } catch {
    return 60
  }
}

// Below 768px the info drawer covers the chat, so it starts closed there.
const NARROW_QUERY = '(max-width: 767px)'
function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia?.(NARROW_QUERY)
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}
function isNarrowViewport() {
  return window.matchMedia?.(NARROW_QUERY).matches ?? false
}

const NOT_OPEN_FALLBACK = 'Chưa có nội dung trò chuyện để xem.'

// Calm reason and time for a conversation whose history cannot be opened yet.
function chatNotOpenNotice(
  appointment: Appointment,
  eligibility: AppointmentChatEligibility,
) {
  // The waiting room opens 10 minutes before the appointment (see AppointmentChatPanel).
  const opensAt = Date.parse(eligibility.scheduledStartAt) - 10 * 60_000
  if (eligibility.phase === 'TOO_EARLY' && Number.isFinite(opensAt)) {
    const parts = new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      hourCycle: 'h23',
      timeZone: appointment.timezone || 'Asia/Ho_Chi_Minh',
    }).formatToParts(opensAt)
    const part = (type: string) => parts.find((p) => p.type === type)?.value
    return `Phòng chat mở lúc ${part('hour')}:${part('minute')}, ${part('day')}/${part('month')}`
  }
  return NOT_OPEN_FALLBACK
}

// Messages workspace bound to real appointment, session summary and chat history data
export default function SpecialistChatView({
  initialAppointmentId,
  viewerRole = 'USER',
}: SpecialistChatViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const isNarrow = useSyncExternalStore(
    subscribeNarrow,
    isNarrowViewport,
    () => false,
  )

  // State
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedId, setSelectedId] = useState<string>(
    initialAppointmentId || '',
  )
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // null = default: closed while the live panel already shows the appointment info, open otherwise.
  const [emrDrawerOverride, setEmrDrawerOverride] = useState<boolean | null>(
    null,
  )

  // Real data details for selected session
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(
    null,
  )
  // The print record is portalled to <body> after mount so print CSS can hide the whole app shell.
  const [printHost, setPrintHost] = useState<HTMLElement | null>(null)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- document exists only after mount
  useEffect(() => setPrintHost(document.body), [])

  // Chat message feed & truthful status
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([])
  const [chatStatus, setChatStatus] = useState<
    'loading' | 'ready' | 'empty' | 'notOpen' | 'error'
  >('loading')
  const [notOpenNotice, setNotOpenNotice] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // 1. Load appointment list from backend
  const loadAppointments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response =
        viewerRole === 'SPECIALIST'
          ? await appointmentBrowserClient.assigned()
          : await appointmentBrowserClient.list()
      // Only conversations that can be opened are listed.
      const items = (response.items || []).filter(canOpenChat)
      setAppointments(items)

      // Set initial selected appointment if none or if missing
      if (!selectedId && items.length > 0) {
        const match =
          items.find((a) => a.id === initialAppointmentId) || items[0]
        if (match) setSelectedId(match.id)
      }
    } catch (err) {
      if (err instanceof ApiError && [401, 403].includes(err.status ?? 0)) {
        setAppointments([])
      }
      setError('Chưa thể tải danh sách lịch hẹn. Vui lòng thử lại.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [initialAppointmentId, selectedId, viewerRole])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAppointments()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAppointments])

  // Current selected appointment object
  const selectedAppointment = useMemo(() => {
    if (!selectedId && appointments.length > 0) return appointments[0]
    return appointments.find((a) => a.id === selectedId) || appointments[0]
  }, [appointments, selectedId])

  // Fail closed: clear one appointment's medical data during render, before
  // another appointment's metadata can be painted next to it.
  const selectedAppointmentId = selectedAppointment?.id
  const [detailsAppointmentId, setDetailsAppointmentId] = useState(
    selectedAppointmentId,
  )
  if (detailsAppointmentId !== selectedAppointmentId) {
    setDetailsAppointmentId(selectedAppointmentId)
    setSessionSummary(null)
    setEmrDrawerOverride(null)
    setChatMessages([])
    setNotOpenNotice('')
    setChatStatus('loading')
  }

  // 2. Load session summary & chat history for selected appointment
  useEffect(() => {
    if (!selectedAppointment?.id) return

    let cancelled = false
    const aptId = selectedAppointment.id

    async function loadSessionDetails() {
      // 1) Session summary
      try {
        const summaries = await sessionSummaryBrowserClient.list(
          aptId,
          viewerRole,
        )
        if (!cancelled && summaries.items?.length > 0) {
          setSessionSummary(summaries.items[0])
        } else if (!cancelled) {
          setSessionSummary(null)
        }
      } catch {
        if (!cancelled) setSessionSummary(null)
      }

      // 2) Chat history
      setNotOpenNotice('')
      setChatStatus('loading')
      try {
        const eligibility = await chatEligibility(aptId, 'history')
        if (
          !cancelled &&
          eligibility.historyAllowed &&
          eligibility.conversationId
        ) {
          const hist = await chatHistory(eligibility.conversationId)
          if (!cancelled) {
            if (hist.items && hist.items.length > 0) {
              const mapped: ChatMessageItem[] = hist.items.map(
                (m: ChatMessage) => {
                  const isUser =
                    m.senderId === selectedAppointment.heldCreditId ||
                    m.senderId !== selectedAppointment.specialistAccountId
                  return {
                    id: m.messageId,
                    senderType: isUser ? 'user' : 'specialist',
                    senderName: isUser
                      ? viewerRole === 'SPECIALIST'
                        ? 'Khách hàng'
                        : 'Bạn'
                      : selectedAppointment.specialistDisplayName ||
                        'Chuyên gia Tâm lý',
                    timestamp: new Intl.DateTimeFormat('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hourCycle: 'h23',
                      timeZone:
                        selectedAppointment.timezone || 'Asia/Ho_Chi_Minh',
                    }).format(new Date(m.sentAt)),
                    // A deleted message has no content (MB-694).
                    content: m.content ?? 'Tin nhắn này đã được xóa.',
                  }
                },
              )
              setChatMessages(mapped)
              setChatStatus('ready')
            } else {
              setChatMessages([])
              setChatStatus('empty')
            }
          }
        } else if (!cancelled) {
          setChatMessages([])
          const notOpen = !eligibility?.historyAllowed
          if (notOpen) {
            setNotOpenNotice(
              eligibility
                ? chatNotOpenNotice(selectedAppointment, eligibility)
                : NOT_OPEN_FALLBACK,
            )
          }
          setChatStatus(notOpen ? 'notOpen' : 'empty')
        }
      } catch {
        if (!cancelled) {
          setChatMessages([])
          setChatStatus('error')
        }
      }
    }

    void loadSessionDetails()

    return () => {
      cancelled = true
    }
  }, [selectedAppointment, viewerRole])

  // Handle appointment selection
  const handleSelectAppointment = (appointmentId: string) => {
    setSelectedId(appointmentId)
    const params = new URLSearchParams(window.location.search)
    params.set('appointmentId', appointmentId)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Filtered appointment summaries
  const appointmentSummaries: AppointmentSummary[] = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- list tone depends on the current time
    const now = Date.now()
    return appointments.map((apt) => {
      // Tone only; the pill text is always appointmentStatusLabel (same as /appointments).
      const stillAhead =
        ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS'].includes(apt.status) &&
        Date.parse(apt.scheduledEndAt) > now
      const status: AppointmentSummary['status'] =
        apt.status === 'COMPLETED'
          ? 'completed'
          : apt.status === 'CANCELLED'
            ? 'cancelled'
            : stillAhead
              ? 'upcoming'
              : 'ended'

      const isCurrentActive = selectedAppointment?.id === apt.id
      const specName = apt.specialistDisplayName || 'Chuyên gia'

      return {
        id: apt.id,
        specialist: {
          id: apt.specialistAccountId,
          name: specName,
        },
        date: formatSessionDate(apt.scheduledStartAt, apt.timezone),
        timeSlot: `${formatTimeRange(apt.scheduledStartAt, apt.scheduledEndAt, apt.timezone)} (${calculateDurationMinutes(apt.scheduledStartAt, apt.scheduledEndAt)} ph)`,
        durationMinutes: calculateDurationMinutes(
          apt.scheduledStartAt,
          apt.scheduledEndAt,
        ),
        status,
        statusLabel: appointmentStatusLabel(apt, viewerRole),
        isActive: isCurrentActive,
        rawAppointment: apt,
      }
    })
  }, [appointments, selectedAppointment, viewerRole])

  const filteredAppointments = useMemo(() => {
    return appointmentSummaries.filter((item) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = item.specialist.name.toLowerCase().includes(q)
        const matchDate = item.date.includes(q)
        if (!matchName && !matchDate) return false
      }

      return true
    })
  }, [appointmentSummaries, searchQuery])

  // Active specialist data
  const currentSpecialist: SpecialistProfile = useMemo(() => {
    if (selectedAppointment) {
      const name = selectedAppointment.specialistDisplayName || 'Chuyên gia'
      return {
        id: selectedAppointment.specialistAccountId,
        name,
      }
    }
    return {
      id: 'default',
      name: 'Chuyên gia',
    }
  }, [selectedAppointment])

  // Session info for the current appointment
  const emrData: EmrSessionData | null = useMemo(() => {
    if (!selectedAppointment) return null

    const apt = selectedAppointment
    const startIso = apt.scheduledStartAt || ''
    const endIso = apt.scheduledEndAt || ''
    const tz = apt.timezone || 'Asia/Ho_Chi_Minh'

    // Real agreed steps from sessionSummary
    const rawSteps =
      sessionSummary?.agreedNextSteps &&
      sessionSummary.agreedNextSteps.length > 0
        ? sessionSummary.agreedNextSteps.map((step, idx) => ({
            step: idx + 1,
            title: step.title,
            description: step.details || undefined,
            isDone: step.state === 'COMPLETED',
          }))
        : null

    return {
      appointmentId: apt.id,
      consultationTime: {
        date: startIso ? formatFullDate(startIso, tz) : 'Chưa xác định',
        timeRange:
          startIso && endIso
            ? formatTimeRange(startIso, endIso, tz)
            : 'Chưa xác định',
        durationLabel:
          startIso && endIso
            ? `${calculateDurationMinutes(startIso, endIso)} phút`
            : '—',
      },
      summaryText:
        sessionSummary?.specialistNoteForUser ||
        sessionSummary?.progressSummary ||
        null,
      nextSteps: rawSteps,
      creditLabel: appointmentCreditLabel(apt),
    }
  }, [selectedAppointment, sessionSummary])

  const isSessionEnded =
    !selectedAppointment ||
    ['COMPLETED', 'SESSION_ENDED', 'CANCELLED'].includes(
      selectedAppointment.status,
    )
  // Sending, check-in and presence run only on the realtime chat panel.
  const isLiveSession =
    !!selectedAppointment &&
    ['CONFIRMED', 'IN_PROGRESS'].includes(selectedAppointment.status)
  const isEmrDrawerOpen =
    emrDrawerOverride ?? (!!selectedAppointment && !isLiveSession && !isNarrow)
  const nextSessionHref = selectedAppointment
    ? `/specialists?specialist=${encodeURIComponent(selectedAppointment.specialistAccountId)}`
    : '/specialists'
  const composerDisabledReason = isSessionEnded
    ? 'Phiên tư vấn đã kết thúc • Khung chat chỉ đọc'
    : 'Khung chat hiện không khả dụng cho phiên này'

  return (
    <div
      className={styles.workspace}
      data-messages-workspace="true"
      data-purpose="three-column-workspace"
    >
      {printHost &&
        selectedAppointment &&
        emrData &&
        createPortal(
          <section className="mb-print-record" aria-hidden="true">
            <header>
              <p>MentalBridge · Biên bản phiên tư vấn</p>
              <h1>{currentSpecialist.name}</h1>
              <dl>
                <div>
                  <dt>Ngày</dt>
                  <dd>{emrData.consultationTime.date}</dd>
                </div>
                <div>
                  <dt>Thời gian</dt>
                  <dd>
                    {emrData.consultationTime.timeRange} (
                    {emrData.consultationTime.durationLabel})
                  </dd>
                </div>
                <div>
                  <dt>Hình thức</dt>
                  <dd>
                    {appointmentModalityLabel(selectedAppointment.modality)}
                  </dd>
                </div>
              </dl>
            </header>
            <section>
              <h2>Tổng kết sau phiên</h2>
              {sessionSummary ? (
                <>
                  {(sessionSummary.topicsDiscussed?.length ?? 0) > 0 && (
                    <p>
                      <strong>Nội dung đã trao đổi:</strong>{' '}
                      {sessionSummary.topicsDiscussed.join(', ')}
                    </p>
                  )}
                  {sessionSummary.progressSummary && (
                    <p>{sessionSummary.progressSummary}</p>
                  )}
                  {sessionSummary.specialistNoteForUser && (
                    <p>
                      <strong>Lời nhắn từ chuyên gia:</strong>{' '}
                      {sessionSummary.specialistNoteForUser}
                    </p>
                  )}
                  {(sessionSummary.agreedNextSteps?.length ?? 0) > 0 && (
                    <>
                      <h3>Đã thống nhất sau phiên</h3>
                      <ol>
                        {sessionSummary.agreedNextSteps?.map((step) => (
                          <li key={step.id}>
                            {step.title}
                            {step.details ? `: ${step.details}` : ''}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </>
              ) : (
                <p>Chuyên gia chưa xuất bản bản tổng kết cho phiên này.</p>
              )}
            </section>
            <section>
              <h2>Nội dung trò chuyện</h2>
              {chatMessages.length > 0 ? (
                <ol className="mb-print-transcript">
                  {chatMessages.map((msg) => (
                    <li key={msg.id}>
                      <strong>{msg.senderName}</strong>
                      <span> · {msg.timestamp}</span>
                      <p>{msg.content}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>Phiên này không có tin nhắn được lưu.</p>
              )}
            </section>
            <footer>
              Tài liệu chứa thông tin sức khỏe riêng tư. Chỉ chia sẻ khi người
              dùng đồng ý.
            </footer>
          </section>,
          printHost,
        )}
      {/* ======================================================== */}
      {/* COLUMN 1: Session Master List (Cuộc trò chuyện)          */}
      {/* ======================================================== */}
      <section
        className={styles.sessionListColumn}
        data-purpose="session-master-column"
        aria-label="Danh sách cuộc trò chuyện"
      >
        <div className={styles.sessionHeader}>
          <div className={styles.sessionHeaderTop}>
            <h2 className={styles.sessionHeaderTitle}>
              Cuộc trò chuyện{' '}
              <span className={styles.sessionHeaderCount}>
                ({filteredAppointments.length})
              </span>
            </h2>
            <button
              className={styles.iconBtn}
              onClick={() => {
                setRefreshing(true)
                void loadAppointments()
              }}
              title="Làm mới danh sách"
              disabled={refreshing}
              aria-label="Làm mới danh sách"
            >
              <RefreshCw
                size={14}
                className={refreshing ? 'animate-spin' : ''}
              />
            </button>
          </div>

          {/* Search Filter */}
          <div className="relative mt-2 mb-1">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên, ngày..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
            />
          </div>
        </div>

        {error && (
          <div className="mx-3 my-2 p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Appointment Cards Stream */}
        <div className={`${styles.sessionStream} ${styles.customScroll}`}>
          {loading && appointments.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Đang tải cuộc trò chuyện…
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              <MessageSquare
                size={28}
                className="mx-auto mb-2 text-slate-300"
              />
              Chưa có cuộc trò chuyện nào phù hợp.
            </div>
          ) : (
            filteredAppointments.map((item) => {
              const isSelected = item.isActive
              const initials = getInitials(item.specialist.name)
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectAppointment(item.id)}
                  className={`${styles.appointmentCard} ${isSelected ? styles.appointmentCardActive : ''}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ')
                      handleSelectAppointment(item.id)
                  }}
                >
                  <div className={styles.cardInner}>
                    <div
                      className={`${styles.cardAvatar} ${item.status === 'upcoming' ? styles.cardAvatarMuted : ''}`}
                    >
                      {initials}
                    </div>
                    <div className={styles.cardContent}>
                      <div className={styles.cardTopRow}>
                        <h3
                          className={`${styles.cardName} ${item.status === 'upcoming' ? styles.cardNameMuted : ''}`}
                        >
                          {item.specialist.name}
                        </h3>
                        <span
                          className={`${styles.statusPill} ${item.status === 'completed' ? styles.statusPillCompleted : styles.statusPillUpcoming}`}
                          title={item.statusLabel}
                        >
                          {item.statusLabel}
                        </span>
                      </div>
                      <p className={styles.cardTime}>
                        <Clock size={12} className="text-slate-400" />
                        {item.date} • {item.timeSlot}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* COLUMN 2: Chat Main Area (Khung trò chuyện trung tâm)     */}
      {/* ======================================================== */}
      <main className={styles.chatMainArea} data-purpose="chat-stream-column">
        {!selectedAppointment ? (
          <div className={styles.chatEmpty} role="status">
            <strong>Chưa có cuộc trò chuyện nào</strong>
            <p>Cuộc trò chuyện mở khi bạn có lịch hẹn với chuyên gia.</p>
            {viewerRole !== 'SPECIALIST' && (
              <Link href="/specialists">Tìm chuyên gia</Link>
            )}
          </div>
        ) : (
          <>
            {/* Chat Header Bar */}
            <header
              className={styles.chatHeader}
              data-purpose="chat-top-header"
            >
              <div className={styles.specialistBadge}>
                <div className={styles.avatarWrapper}>
                  <div className={styles.headerAvatar}>
                    {getInitials(currentSpecialist.name)}
                  </div>
                </div>
                <div className={styles.headerIdentity}>
                  <div className={styles.headerNameRow}>
                    <h1
                      className={styles.headerName}
                      title={currentSpecialist.name}
                    >
                      {currentSpecialist.name}
                    </h1>
                    {selectedAppointment?.status === 'COMPLETED' && (
                      <span
                        className={`${styles.statusPill} ${styles.statusPillCompleted}`}
                        title={appointmentStatusLabel(
                          selectedAppointment,
                          viewerRole,
                        )}
                      >
                        {appointmentStatusLabel(
                          selectedAppointment,
                          viewerRole,
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className={styles.headerActions}>
                {viewerRole !== 'SPECIALIST' && (
                  <Link href={nextSessionHref} className={styles.btnPrimary}>
                    <CalendarDays size={14} />
                    <span>Đặt buổi tiếp theo</span>
                  </Link>
                )}

                {/* Split-Panel Drawer Toggle Button (Theo mẫu Stitch design) */}
                <button
                  type="button"
                  onClick={() => setEmrDrawerOverride(!isEmrDrawerOpen)}
                  aria-label="Thông tin buổi hẹn"
                  aria-expanded={isEmrDrawerOpen}
                  aria-controls="appointment-info-drawer"
                  title="Thông tin buổi hẹn"
                  className={styles.drawerToggleBtn}
                >
                  <svg
                    className="w-4 h-4 text-brand-600"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="16"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M15 4.5v15"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M15 5h5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-5V5z"
                      fill="currentColor"
                      opacity="0.85"
                    />
                  </svg>
                  <span className={styles.toggleDot} />
                </button>
              </div>
            </header>

            {isLiveSession && selectedAppointment ? (
              <div className={styles.liveChat} data-purpose="live-chat">
                <AppointmentChatPanel
                  key={selectedAppointment.id}
                  appointmentId={selectedAppointment.id}
                  viewerRole={viewerRole}
                  timezone={selectedAppointment.timezone}
                  embedded
                />
              </div>
            ) : (
              <>
                {/* Bento Metric Strip over Conversation */}
                {emrData && (
                  <div
                    className={styles.bentoMetricStrip}
                    data-purpose="chat-session-bento-strip"
                  >
                    <div className={styles.metricStripContent}>
                      <div className={styles.metricLeft}>
                        <span>
                          <span className={styles.metricDot} />
                          Thời lượng:{' '}
                          <strong className="text-slate-800 font-semibold">
                            {emrData.consultationTime.durationLabel}
                          </strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Tóm tắt phiên:{' '}
                          <strong className="text-emerald-800 font-semibold">
                            {sessionSummary
                              ? 'Đã có tóm tắt phiên'
                              : 'Chưa có tóm tắt'}
                          </strong>
                        </span>
                      </div>
                      <span className="text-slate-500 text-[11px]">
                        <strong className="text-slate-700 font-semibold">
                          {emrData.creditLabel}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}

                {/* Dialogue Message Stream Area */}
                <div
                  className={`${styles.messagesContainer} ${styles.customScroll}`}
                  data-purpose="chat-messages-container"
                >
                  {/* Timeline Date Pill */}
                  {emrData && (
                    <div className={styles.timelinePill}>
                      <span className={styles.timelineText}>
                        Phiên tham vấn lúc {emrData.consultationTime.timeRange}{' '}
                        • {emrData.consultationTime.date}
                      </span>
                    </div>
                  )}

                  {/* Message Stream with Truthful Status Handling */}
                  {chatStatus === 'loading' && (
                    <div
                      className="py-12 text-center text-sm text-slate-500"
                      data-testid="chat-loading-state"
                    >
                      Đang tải lịch sử hội thoại...
                    </div>
                  )}

                  {chatStatus === 'notOpen' && (
                    <div
                      className="py-12 text-center px-4"
                      data-testid="chat-not-open-state"
                      role="status"
                    >
                      <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-500 mb-2">
                        <Clock size={20} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {notOpenNotice}
                      </p>
                    </div>
                  )}

                  {chatStatus === 'error' && (
                    <div
                      className="py-12 text-center px-4"
                      data-testid="chat-error-state"
                    >
                      <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-700 mb-2">
                        <AlertCircle size={20} />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        Không thể tải lịch sử trò chuyện
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Đã xảy ra lỗi kết nối khi tải lịch sử phiên. Vui lòng
                        thử lại sau.
                      </p>
                    </div>
                  )}

                  {chatStatus === 'empty' && (
                    <div
                      className="py-12 text-center px-4"
                      data-testid="chat-empty-state"
                    >
                      <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-500 mb-2">
                        <MessageSquare size={20} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        Chưa có tin nhắn trong phiên này
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Phiên tư vấn này chưa có lịch sử tin nhắn nào được lưu
                        trữ.
                      </p>
                    </div>
                  )}

                  {chatStatus === 'ready' &&
                    chatMessages.map((msg) => {
                      const isDoctor = msg.senderType === 'specialist'

                      if (isDoctor) {
                        return (
                          <div key={msg.id} className={styles.messageRowDoctor}>
                            <div className={styles.msgAvatarDoctor}>
                              {getInitials(msg.senderName)}
                            </div>
                            <div className={styles.msgBodyDoctor}>
                              <div className={styles.msgHeaderDoctor}>
                                <span className={styles.msgAuthorDoctor}>
                                  {msg.senderName}
                                </span>
                                <span className={styles.msgTime}>
                                  {msg.timestamp}
                                </span>
                              </div>
                              <div className={styles.bubbleDoctor}>
                                <p className="m-0 leading-relaxed">
                                  {msg.content}
                                </p>
                                {msg.recommendations && (
                                  <div className={styles.recommendationCard}>
                                    <p className={styles.recommendationTitle}>
                                      {msg.recommendations.title}
                                    </p>
                                    <ul className={styles.recommendationList}>
                                      {msg.recommendations.items.map(
                                        (item, idx) => (
                                          <li key={idx}>{item}</li>
                                        ),
                                      )}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      }

                      // Patient Message
                      return (
                        <div key={msg.id} className={styles.messageRowPatient}>
                          <div className={styles.msgBodyPatient}>
                            <div className={styles.msgHeaderPatient}>
                              <span className={styles.msgTime}>
                                {msg.timestamp}
                              </span>
                              <span className={styles.msgAuthorPatient}>
                                {msg.senderName}
                              </span>
                            </div>
                            <div className={styles.bubblePatient}>
                              <p className="m-0 leading-relaxed text-white font-medium">
                                {msg.content}
                              </p>
                            </div>
                          </div>
                          <div className={styles.msgAvatarPatient}>
                            {getInitials(msg.senderName)}
                          </div>
                        </div>
                      )
                    })}

                  {/* Completion Badge */}
                  {isSessionEnded &&
                    selectedAppointment?.status !== 'CANCELLED' &&
                    emrData && (
                      <div className={styles.completionBadge}>
                        <p className={styles.completionTitle}>
                          Phiên kết thúc lúc{' '}
                          {emrData.consultationTime.timeRange
                            .split('–')[1]
                            ?.trim()}
                        </p>
                      </div>
                    )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Read-Only Status Banner / Active Input Bar (Zalo / Messenger Style) */}
                <footer
                  className={styles.chatFooter}
                  data-purpose="chat-input-and-status-area"
                >
                  {isSessionEnded && (
                    <div className={styles.readOnlyBanner}>
                      <div className={styles.bannerText}>
                        <Lock size={15} className="text-slate-400 shrink-0" />
                        <span className="truncate">
                          Phiên đã kết thúc. Khung chat chỉ đọc.
                        </span>
                      </div>
                      <div className={styles.bannerActions}>
                        <button
                          type="button"
                          onClick={() => setEmrDrawerOverride(true)}
                          className={styles.btnSecondary}
                          title="Mở thông tin buổi hẹn"
                        >
                          <FileText size={14} className="text-brand-600" />
                          <span>Xem thông tin buổi hẹn</span>
                        </button>
                        {viewerRole !== 'SPECIALIST' && (
                          <Link
                            href={nextSessionHref}
                            className={`${styles.btnSecondary} text-brand-700 bg-brand-50 border-brand-200`}
                          >
                            <CalendarDays
                              size={14}
                              className="text-emerald-600"
                            />
                            <span>Đặt buổi tiếp theo</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={styles.composerForm}>
                    <div className={styles.composerInputRow}>
                      <input
                        type="text"
                        disabled
                        aria-label={composerDisabledReason}
                        placeholder={composerDisabledReason}
                        className={styles.composerTextarea}
                      />
                      <button
                        type="button"
                        disabled
                        className={styles.sendBtn}
                        aria-label="Gửi tin nhắn"
                        title={composerDisabledReason}
                      >
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                </footer>
              </>
            )}
          </>
        )}
      </main>

      {/* ======================================================== */}
      {/* COLUMN 3: Appointment info drawer                        */}
      {/* ======================================================== */}
      <aside
        id="appointment-info-drawer"
        className={`${styles.emrDrawer} ${isEmrDrawerOpen ? '' : styles.emrDrawerHidden} ${styles.customScroll}`}
        data-purpose="appointment-info-panel"
      >
        {/* Drawer Header */}
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitleGroup}>
            <div className={styles.drawerIconBox}>
              <FileText size={16} />
            </div>
            <div>
              <h2 className={styles.drawerTitle}>Thông tin buổi hẹn</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEmrDrawerOverride(false)}
            className={styles.iconBtn}
            title="Đóng ngăn kéo"
            aria-label="Đóng ngăn kéo"
          >
            <X size={15} />
          </button>
        </div>

        {!emrData ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            Chưa có thông tin buổi hẹn.
          </div>
        ) : (
          <>
            {/* Card 1: Thời gian tư vấn */}
            <div className={styles.bentoCard}>
              <div className={styles.cardTopLabelRow}>
                <span className={styles.cardSectionLabel}>
                  Thời gian tư vấn
                </span>
                {selectedAppointment && (
                  <span
                    className={`${styles.statusPill} ${selectedAppointment.status === 'COMPLETED' ? styles.statusPillCompleted : styles.statusPillUpcoming}`}
                    title={appointmentStatusLabel(
                      selectedAppointment,
                      viewerRole,
                    )}
                  >
                    {appointmentStatusLabel(selectedAppointment, viewerRole)}
                  </span>
                )}
              </div>
              <div>
                <div className={styles.timeLarge}>
                  {emrData.consultationTime.timeRange}
                </div>
                <div className={styles.timeDateSub}>
                  {emrData.consultationTime.date} (
                  {emrData.consultationTime.durationLabel})
                </div>
              </div>
              <div className={styles.timeDividerRow}>
                <span>
                  Hình thức:{' '}
                  <strong className="font-semibold text-slate-800">
                    {appointmentModalityLabel(selectedAppointment?.modality)}
                  </strong>
                </span>
                {sessionSummary && (
                  <span className="text-emerald-800 font-semibold flex items-center gap-1">
                    <Check size={13} className="stroke-[3]" /> Đã có tóm tắt
                    phiên
                  </span>
                )}
              </div>
            </div>

            {/* Card 2: Tóm tắt phiên (only when the specialist published one) */}
            {emrData.summaryText && (
              <div className={styles.bentoCard}>
                <div className={styles.cardTopLabelRow}>
                  <span className={styles.cardSectionLabel}>Tóm tắt phiên</span>
                </div>
                <div className="py-2.5 px-3 bg-slate-50 rounded-lg text-xs text-slate-600 mb-2">
                  {emrData.summaryText}
                </div>
              </div>
            )}

            {/* Card 3: Bước tiếp theo */}
            <div className={styles.bentoCard}>
              <div className={styles.cardTopLabelRow}>
                <span className={styles.cardSectionLabel}>Bước tiếp theo</span>
                {emrData.nextSteps && (
                  <span className="text-[11px] text-emerald-800 font-semibold">
                    {emrData.nextSteps.length} mục
                  </span>
                )}
              </div>
              {emrData.nextSteps && emrData.nextSteps.length > 0 ? (
                <ul className={styles.protocolList}>
                  {emrData.nextSteps.map((task) => (
                    <li key={task.step} className={styles.protocolItem}>
                      <span className={styles.protocolNumBadge}>
                        {task.step}
                      </span>
                      <span>{task.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-2.5 px-3 bg-slate-50 rounded-lg text-xs text-slate-500 mb-2">
                  Chưa có kế hoạch chăm sóc tiếp theo được ghi nhận cho phiên
                  này.
                </div>
              )}
            </div>

            {/* Card 4: trạng thái buổi tư vấn */}
            <div className={styles.bentoCard}>
              <span className="text-xs font-semibold text-emerald-700">
                {emrData.creditLabel}
              </span>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
