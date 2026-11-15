'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Lock,
  MessageSquare,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react'

import { ApiError } from '@/lib/api/api-error'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import type { SessionSummary } from '@/lib/consultation/session-summary-validation'
import type { ConsultationBrief } from '../api/consultation-brief-contract'
import { appointmentBrowserClient } from '../api/browser-client'
import { sessionSummaryBrowserClient } from '../api/session-summary-browser-client'
import { consultationBriefBrowserClient } from '../api/consultation-brief-browser-client'
import {
  chatEligibility,
  chatHistory,
  type ChatMessage,
} from '../api/chat-browser-client'
import AppointmentChatPanel from './AppointmentChatPanel'
import styles from './SpecialistChatView.module.css'

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
  title: string
  specialty: string
  avatarUrl?: string
  code: string
  isOnline: boolean
}

export interface AppointmentSummary {
  id: string
  specialist: SpecialistProfile
  date: string
  timeSlot: string
  durationMinutes: number
  status: 'completed' | 'upcoming' | 'cancelled'
  isActive: boolean
  rawAppointment: Appointment
}

export interface EmrSessionData {
  appointmentId: string
  consultationTime: {
    date: string
    timeRange: string
    durationLabel: string
    isEncrypted: boolean
  }
  clinicalAssessment: {
    tool: string | null
    preScore: number | null
    postScore: number | null
    maxScore: number | null
    summaryText: string | null
  }
  treatmentPlan: {
    week: number
    tasks: Array<{
      step: number
      title: string
      description?: string
      isDone?: boolean
    }>
  } | null
  creditsUsed: number
  invoiceId: string
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
      hour12: false,
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

function getSpecialistSpecialty(name: string) {
  if (name.includes('Quốc Bảo')) {
    return 'Khoa Tâm lý Lâm sàng • Giấc ngủ & Burnout'
  }
  if (name.includes('Thu Hà')) {
    return 'Khoa Tâm lý • Mối quan hệ & Cảm xúc'
  }
  if (name.includes('Đức Long')) {
    return 'Khoa Tâm thần • Tâm lý Học đường & Thi cử'
  }
  return 'Khoa Sức khỏe Tâm thần • BV ĐHYD TP.HCM'
}

// Helper to construct dynamic clinical consultation dialogue bound to real appointment, brief and session summary data
export default function SpecialistChatView({
  initialAppointmentId,
  viewerRole = 'USER',
}: SpecialistChatViewProps) {
  const router = useRouter()
  const pathname = usePathname()

  // State
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedId, setSelectedId] = useState<string>(
    initialAppointmentId || '',
  )
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'recent' | 'specialist'>('recent')
  const [selectedDoctorFilter, setSelectedDoctorFilter] =
    useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // EMR Drawer state: default OPEN as specified in Stitch spec
  const [isEmrDrawerOpen, setIsEmrDrawerOpen] = useState(true)

  // Real data details for selected session
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(
    null,
  )
  const [consultationBrief, setConsultationBrief] =
    useState<ConsultationBrief | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false)
  const [ratingInput, setRatingInput] = useState(5)
  const [savingRating, setSavingRating] = useState(false)
  const [isEmrModalOpen, setIsEmrModalOpen] = useState(false)

  // Chat message feed & truthful status
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([])
  const [chatStatus, setChatStatus] = useState<
    'loading' | 'ready' | 'empty' | 'forbidden' | 'error'
  >('loading')
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
      const items = response.items || []
      setAppointments(items)

      // Set initial selected appointment if none or if missing
      if (!selectedId && items.length > 0) {
        // Find first completed or confirmed appointment
        const match =
          items.find((a) => a.id === initialAppointmentId) ||
          items.find(
            (a) => a.status === 'COMPLETED' || a.status === 'SESSION_ENDED',
          ) ||
          items[0]
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
    setConsultationBrief(null)
    setRating(null)
    setChatMessages([])
    setChatStatus('loading')
  }

  // 2. Load EMR, Brief, Rating & Chat history for selected appointment
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

      // 2) Consultation brief & situation
      try {
        const brief = await consultationBriefBrowserClient.get(aptId)
        if (!cancelled) {
          setConsultationBrief(brief)
        }
      } catch {
        if (!cancelled) setConsultationBrief(null)
      }

      // 3) Rating
      try {
        const ratingData = await appointmentBrowserClient.rating(aptId)
        if (!cancelled) setRating(ratingData.rating)
      } catch {
        if (!cancelled) setRating(null)
      }

      // 4) Chat history
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
                      hour12: false,
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
          setChatStatus(eligibility?.historyAllowed ? 'empty' : 'forbidden')
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

  // Handle save rating
  const handleSaveRating = async () => {
    if (!selectedAppointment?.id || savingRating) return
    setSavingRating(true)
    try {
      await appointmentBrowserClient.saveRating(
        selectedAppointment.id,
        ratingInput,
      )
      setRating(ratingInput)
      setIsRatingModalOpen(false)
    } catch {
      // Keep state on failure
    } finally {
      setSavingRating(false)
    }
  }

  // Handle PDF Export
  const handleExportPdf = () => {
    window.print()
  }

  // Filtered appointment summaries
  const appointmentSummaries: AppointmentSummary[] = useMemo(() => {
    return appointments.map((apt) => {
      const isCompleted = ['COMPLETED', 'SESSION_ENDED'].includes(apt.status)
      const isCancelled = apt.status === 'CANCELLED'
      const status: 'completed' | 'upcoming' | 'cancelled' = isCompleted
        ? 'completed'
        : isCancelled
          ? 'cancelled'
          : 'upcoming'

      const isCurrentActive = selectedAppointment?.id === apt.id
      const specName = apt.specialistDisplayName || 'ThS. BS. Minh Anh'

      return {
        id: apt.id,
        specialist: {
          id: apt.specialistAccountId,
          name: specName,
          title: specName,
          specialty: getSpecialistSpecialty(specName),
          code: `#MB-${apt.id.slice(-3).toUpperCase()}`,
          isOnline: true,
        },
        date: formatSessionDate(apt.scheduledStartAt, apt.timezone),
        timeSlot: `${formatTimeRange(apt.scheduledStartAt, apt.scheduledEndAt, apt.timezone)} (${calculateDurationMinutes(apt.scheduledStartAt, apt.scheduledEndAt)} ph)`,
        durationMinutes: calculateDurationMinutes(
          apt.scheduledStartAt,
          apt.scheduledEndAt,
        ),
        status,
        isActive: isCurrentActive,
        rawAppointment: apt,
      }
    })
  }, [appointments, selectedAppointment])

  const filteredAppointments = useMemo(() => {
    return appointmentSummaries.filter((item) => {
      // Tab filter
      if (activeTab === 'specialist' && selectedDoctorFilter !== 'ALL') {
        if (!item.specialist.name.includes(selectedDoctorFilter)) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = item.specialist.name.toLowerCase().includes(q)
        const matchSpec = item.specialist.specialty.toLowerCase().includes(q)
        const matchDate = item.date.includes(q)
        if (!matchName && !matchSpec && !matchDate) return false
      }

      return true
    })
  }, [appointmentSummaries, activeTab, selectedDoctorFilter, searchQuery])

  // Active specialist data
  const currentSpecialist: SpecialistProfile = useMemo(() => {
    if (selectedAppointment) {
      const name =
        selectedAppointment.specialistDisplayName || 'ThS. BS. Minh Anh'
      return {
        id: selectedAppointment.specialistAccountId,
        name,
        title: name,
        specialty: getSpecialistSpecialty(name),
        code: `#MB-${selectedAppointment.id.slice(-3).toUpperCase() || '383'}`,
        isOnline: true,
      }
    }
    return {
      id: 'default',
      name: 'ThS. BS. Minh Anh',
      title: 'ThS. BS. Minh Anh',
      specialty: 'Khoa Sức khỏe Tâm thần • BV ĐHYD TP.HCM',
      code: '#MB-383',
      isOnline: true,
    }
  }, [selectedAppointment])

  // EMR session data for current appointment
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

    const assessmentSummary =
      sessionSummary?.specialistNoteForUser ||
      sessionSummary?.progressSummary ||
      null

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
        isEncrypted: false,
      },
      clinicalAssessment: {
        tool: consultationBrief?.screeningContext?.[0]?.instrument
          ? `Thang đo: ${consultationBrief.screeningContext[0].instrument}`
          : null,
        preScore: null,
        postScore: null,
        maxScore: null,
        summaryText: assessmentSummary,
      },
      treatmentPlan: rawSteps
        ? {
            week: 1,
            tasks: rawSteps,
          }
        : null,
      creditsUsed: apt.creditState === 'CONSUMED' || apt.heldCreditId ? 1 : 0,
      invoiceId: `INV-MB-${apt.id.slice(-6).toUpperCase()}`,
    }
  }, [selectedAppointment, sessionSummary, consultationBrief])

  const isSessionEnded =
    !selectedAppointment ||
    ['COMPLETED', 'SESSION_ENDED', 'CANCELLED'].includes(
      selectedAppointment.status,
    )
  // Sending, check-in and presence run only on the realtime chat panel.
  const isLiveSession =
    !!selectedAppointment &&
    ['CONFIRMED', 'IN_PROGRESS'].includes(selectedAppointment.status)
  const composerDisabledReason = isSessionEnded
    ? 'Phiên tư vấn đã kết thúc • Khung chat chỉ đọc'
    : 'Khung chat hiện không khả dụng cho phiên này'

  return (
    <div
      className={styles.workspace}
      data-messages-workspace="true"
      data-purpose="three-column-workspace"
    >
      {/* ======================================================== */}
      {/* COLUMN 1: Session Master List (Lịch hẹn chat)            */}
      {/* ======================================================== */}
      <section
        className={styles.sessionListColumn}
        data-purpose="session-master-column"
        aria-label="Danh sách cuộc trò chuyện"
      >
        <div className={styles.sessionHeader}>
          <div className={styles.sessionHeaderTop}>
            <h2 className={styles.sessionHeaderTitle}>
              Lịch hẹn chat{' '}
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
              placeholder="Tìm theo bác sĩ, ngày..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
            />
          </div>

          {/* Filter Tabs */}
          <div className={styles.filterTabs} role="tablist">
            <button
              type="button"
              className={`${styles.filterTabBtn} ${activeTab === 'recent' ? styles.filterTabBtnActive : ''}`}
              onClick={() => {
                setActiveTab('recent')
                setSelectedDoctorFilter('ALL')
              }}
            >
              Gần đây
            </button>
            <button
              type="button"
              className={`${styles.filterTabBtn} ${activeTab === 'specialist' ? styles.filterTabBtnActive : ''}`}
              onClick={() => setActiveTab('specialist')}
            >
              Bác sĩ
            </button>
          </div>

          {/* Sub-filter chips when Bác sĩ tab is active */}
          {activeTab === 'specialist' && (
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'Minh Anh', label: 'BS. Minh Anh' },
                { id: 'Quốc Bảo', label: 'TS. Quốc Bảo' },
                { id: 'Thu Hà', label: 'ThS. Thu Hà' },
                { id: 'Đức Long', label: 'BS. Đức Long' },
              ].map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedDoctorFilter(doc.id)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full whitespace-nowrap transition ${
                    selectedDoctorFilter === doc.id
                      ? 'bg-[#174e3e] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {doc.label}
                </button>
              ))}
            </div>
          )}
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
                        {item.status === 'completed' && (
                          <span
                            className={`${styles.statusPill} ${styles.statusPillCompleted}`}
                          >
                            Đã xong
                          </span>
                        )}
                        {item.status === 'upcoming' && (
                          <span
                            className={`${styles.statusPill} ${styles.statusPillUpcoming}`}
                          >
                            Sắp tới
                          </span>
                        )}
                        {item.status === 'cancelled' && (
                          <span
                            className={`${styles.statusPill} ${styles.statusPillUpcoming}`}
                          >
                            Đã hủy
                          </span>
                        )}
                      </div>
                      <p className={styles.cardSpecialty}>
                        {item.specialist.specialty}
                      </p>
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

        {/* Security Note Footer */}
        <div className={styles.securityNote}>
          <Lock size={14} className="text-brand-600 shrink-0" />
          <span className="truncate">
            Lưu trữ an toàn theo tiêu chuẩn lâm sàng
          </span>
        </div>
      </section>

      {/* ======================================================== */}
      {/* COLUMN 2: Chat Main Area (Khung trò chuyện trung tâm)     */}
      {/* ======================================================== */}
      <main className={styles.chatMainArea} data-purpose="chat-stream-column">
        {/* Chat Header Bar */}
        <header className={styles.chatHeader} data-purpose="chat-top-header">
          <div className={styles.specialistBadge}>
            <div className={styles.avatarWrapper}>
              <div className={styles.headerAvatar}>
                {getInitials(currentSpecialist.name)}
              </div>
              <span className={styles.onlineDot} />
            </div>
            <div className={styles.headerIdentity}>
              <div className={styles.headerNameRow}>
                <h1 className={styles.headerName}>{currentSpecialist.name}</h1>
                <span
                  className={`${styles.statusPill} ${styles.statusPillCompleted}`}
                >
                  {isSessionEnded ? 'Đã hoàn thành phiên' : 'Đang trực tuyến'}
                </span>
              </div>
              <p className={styles.headerMeta}>
                {currentSpecialist.specialty} •{' '}
                <span className="font-mono text-slate-400">
                  {currentSpecialist.code}
                </span>
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleExportPdf}
              title="Xuất tệp PDF cuộc trò chuyện"
            >
              <Download size={14} className="text-slate-500" />
              <span>Xuất PDF</span>
            </button>

            <Link href="/specialists" className={styles.btnPrimary}>
              <CalendarDays size={14} />
              <span>Đặt lịch tái khám</span>
            </Link>

            {/* Split-Panel Drawer Toggle Button (Theo mẫu Stitch design) */}
            <button
              type="button"
              onClick={() => setIsEmrDrawerOpen((prev) => !prev)}
              aria-label="Đóng / Mở Ngăn kéo EMR"
              title="Hồ sơ & EMR"
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
                <path d="M15 4.5v15" stroke="currentColor" strokeWidth="1.8" />
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
                      Báo cáo lâm sàng:{' '}
                      <strong className="text-emerald-800 font-semibold">
                        {sessionSummary
                          ? 'Đã có tóm tắt phiên'
                          : 'Chưa có tóm tắt'}
                      </strong>
                    </span>
                  </div>
                  <span className="text-slate-500 text-[11px]">
                    {emrData.creditsUsed > 0 ? (
                      <span>
                        Đã trừ:{' '}
                        <strong className="text-slate-700 font-semibold">
                          {emrData.creditsUsed} Credit
                        </strong>
                      </span>
                    ) : (
                      <span>Chưa trừ Credit</span>
                    )}
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
                    Phiên tham vấn lúc {emrData.consultationTime.timeRange} •{' '}
                    {emrData.consultationTime.date}
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

              {chatStatus === 'forbidden' && (
                <div
                  className="py-12 text-center px-4"
                  data-testid="chat-forbidden-state"
                >
                  <div className="inline-flex p-3 rounded-full bg-amber-50 text-amber-700 mb-2">
                    <Lock size={20} />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    Không có quyền truy cập
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Bạn không có quyền truy cập lịch sử hội thoại của phiên này
                    (403).
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
                    Đã xảy ra lỗi kết nối khi tải lịch sử phiên. Vui lòng thử
                    lại sau.
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
                    Phiên tư vấn này chưa có lịch sử tin nhắn nào được lưu trữ.
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
                            <p className="m-0 leading-relaxed">{msg.content}</p>
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
              {isSessionEnded && emrData && (
                <div className={styles.completionBadge}>
                  <p className={styles.completionTitle}>
                    Phiên hoàn thành lúc{' '}
                    {emrData.consultationTime.timeRange.split('–')[1]?.trim() ||
                      '23:55'}
                  </p>
                  <p className={styles.completionSub}>
                    Hồ sơ phiên đã được lưu trữ an toàn trong hệ thống lâm sàng.
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
                      Phiên đã kết thúc và được lưu trữ an toàn trong hồ sơ bệnh
                      án EMR.
                    </span>
                  </div>
                  <div className={styles.bannerActions}>
                    <button
                      type="button"
                      onClick={() => setIsEmrDrawerOpen(true)}
                      className={styles.btnSecondary}
                      title="Mở ngăn kéo EMR"
                    >
                      <FileText size={14} className="text-brand-600" />
                      <span>Xem EMR</span>
                    </button>
                    <Link
                      href="/specialists"
                      className={`${styles.btnSecondary} text-brand-700 bg-brand-50 border-brand-200`}
                    >
                      <CalendarDays size={14} className="text-emerald-600" />
                      <span>Tái khám</span>
                    </Link>
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
      </main>

      {/* ======================================================== */}
      {/* COLUMN 3: EmrDrawer (Ngăn kéo Hồ sơ Lâm sàng & EMR)       */}
      {/* ======================================================== */}
      <aside
        id="emr-drawer"
        className={`${styles.emrDrawer} ${isEmrDrawerOpen ? '' : styles.emrDrawerHidden} ${styles.customScroll}`}
        data-purpose="clinical-emr-bento-panel"
      >
        {/* Drawer Header */}
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitleGroup}>
            <div className={styles.drawerIconBox}>
              <FileText size={16} />
            </div>
            <div>
              <h2 className={styles.drawerTitle}>Thông tin buổi hẹn & EMR</h2>
              <span className={styles.drawerCode}>
                Mã {currentSpecialist.code}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEmrDrawerOpen(false)}
            className={styles.iconBtn}
            title="Đóng ngăn kéo"
            aria-label="Đóng ngăn kéo"
          >
            <X size={15} />
          </button>
        </div>

        {!emrData ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            Chưa có thông tin hồ sơ cho phiên này.
          </div>
        ) : (
          <>
            {/* Card 1: Thời gian tư vấn */}
            <div className={styles.bentoCard}>
              <div className={styles.cardTopLabelRow}>
                <span className={styles.cardSectionLabel}>
                  Thời gian tư vấn
                </span>
                <span
                  className={`${styles.statusPill} ${styles.statusPillCompleted}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />
                  {selectedAppointment?.status === 'COMPLETED'
                    ? 'Đã hoàn thành'
                    : selectedAppointment?.status || 'Đang cập nhật'}
                </span>
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
                    {selectedAppointment?.modality === 'IN_APP_CHAT'
                      ? 'Tư vấn qua khung chat'
                      : selectedAppointment?.modality || 'Tư vấn trực tuyến'}
                  </strong>
                </span>
                <span className="text-emerald-800 font-semibold flex items-center gap-1">
                  <Check size={13} className="stroke-[3]" />{' '}
                  {sessionSummary
                    ? 'Đã có tóm tắt phiên'
                    : 'Hồ sơ tư vấn lâm sàng'}
                </span>
              </div>
            </div>

            {/* Card 2: Đánh giá lâm sàng phiên này */}
            <div className={styles.bentoCard}>
              <div className={styles.cardTopLabelRow}>
                <span className={styles.cardSectionLabel}>
                  Đánh giá lâm sàng phiên này
                </span>
                {emrData.clinicalAssessment.tool && (
                  <span className="text-[10px] text-emerald-800 font-semibold">
                    {emrData.clinicalAssessment.tool}
                  </span>
                )}
              </div>
              {emrData.clinicalAssessment.preScore !== null &&
              emrData.clinicalAssessment.postScore !== null ? (
                <div className={styles.scoreGrid}>
                  <div className={styles.scoreBoxBefore}>
                    <p className={styles.scoreSublabel}>Trước tư vấn</p>
                    <p className={styles.scoreValue}>
                      Mức {emrData.clinicalAssessment.preScore} /{' '}
                      {emrData.clinicalAssessment.maxScore}
                    </p>
                  </div>
                  <div className={styles.scoreBoxAfter}>
                    <p
                      className={`${styles.scoreSublabel} ${styles.scoreDescHighlight}`}
                    >
                      Sau tư vấn
                    </p>
                    <p
                      className={`${styles.scoreValue} ${styles.scoreValueHighlight}`}
                    >
                      Mức {emrData.clinicalAssessment.postScore} /{' '}
                      {emrData.clinicalAssessment.maxScore}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-2.5 px-3 bg-slate-50 rounded-lg text-xs text-slate-600 mb-2">
                  {emrData.clinicalAssessment.summaryText ||
                    'Chưa ghi nhận đánh giá định lượng cho phiên này.'}
                </div>
              )}
              {emrData.clinicalAssessment.preScore !== null &&
                emrData.clinicalAssessment.summaryText && (
                  <p className={styles.clinicalNote}>
                    <strong className="text-slate-800">Ghi chú:</strong>{' '}
                    {emrData.clinicalAssessment.summaryText}
                  </p>
                )}
            </div>

            {/* Card 3: Toa dặn dò & Lộ trình */}
            <div className={styles.bentoCard}>
              <div className={styles.cardTopLabelRow}>
                <span className={styles.cardSectionLabel}>
                  Toa dặn dò & Lộ trình
                </span>
                {emrData.treatmentPlan && (
                  <span className="text-[11px] text-emerald-800 font-semibold">
                    {emrData.treatmentPlan.tasks.length} mục
                  </span>
                )}
              </div>
              {emrData.treatmentPlan &&
              emrData.treatmentPlan.tasks.length > 0 ? (
                <ul className={styles.protocolList}>
                  {emrData.treatmentPlan.tasks.map((task) => (
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
              <Link href="/resources" className={styles.readMoreLink}>
                <span>
                  📖 Khám phá thêm các bài thực hành sức khỏe tinh thần
                </span>
                <span className="text-slate-400">→</span>
              </Link>
            </div>

            {/* Card 4: Số dư gói & Actions */}
            <div className={styles.bentoCard}>
              <div className={styles.cardTopLabelRow}>
                <span className="text-xs text-slate-500">
                  Mã phiên:{' '}
                  <strong className="text-slate-800">
                    {emrData.invoiceId}
                  </strong>
                </span>
                <span className="text-xs font-semibold text-emerald-700">
                  {emrData.creditsUsed > 0 ? 'Đã trừ 1 credit' : 'Miễn phí'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <button
                  type="button"
                  className={styles.btnRateSession}
                  onClick={() => {
                    setRatingInput(rating || 5)
                    setIsRatingModalOpen(true)
                  }}
                >
                  {rating
                    ? `Đã đánh giá: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (Chỉnh sửa)`
                    : `Đánh giá phiên với ${currentSpecialist.name} (★★★★★)`}
                </button>
                <button
                  type="button"
                  className={styles.btnViewInvoice}
                  onClick={() => setIsEmrModalOpen(true)}
                >
                  Xem biên bản EMR & Hóa đơn
                </button>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ======================================================== */}
      {/* Floating Quick Support Trigger (AI Companion)            */}
      {/* ======================================================== */}
      <aside
        className={styles.floatingTrigger}
        data-purpose="floating-quick-support"
      >
        <Link
          href="/ai-companion"
          className={styles.floatingBtn}
          title="Tâm sự 24/7 với AI"
        >
          <div className={styles.pingDotWrapper}>
            <div className={styles.pingWave} />
            <div className={styles.pingDot} />
          </div>
          <span className={styles.floatingText}>Tâm sự 24/7 với AI</span>
          <div className={styles.leafIcon}>🌿</div>
        </Link>
      </aside>

      {/* ======================================================== */}
      {/* MODAL 1: Rating Dialog (Đánh giá phiên tư vấn)           */}
      {/* ======================================================== */}
      {isRatingModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsRatingModalOpen(false)}
        >
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Đánh giá phiên tham vấn</h3>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setIsRatingModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className="text-sm text-slate-600 mb-2">
                Trải nghiệm của bạn cùng{' '}
                <strong>{currentSpecialist.name}</strong> như thế nào? Đánh giá
                của bạn giúp duy trì chất lượng chăm sóc lâm sàng chuẩn y khoa.
              </p>
              <div className="flex justify-center">
                <div className={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`${styles.starBtn} ${star <= ratingInput ? styles.starBtnActive : ''}`}
                      onClick={() => setRatingInput(star)}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-center text-xs font-semibold text-emerald-800">
                {ratingInput === 5
                  ? 'Tuyệt vời, bác sĩ thấu cảm và hiệu quả cao'
                  : ratingInput === 4
                    ? 'Rất tốt, hài lòng với lộ trình điều hòa'
                    : ratingInput === 3
                      ? 'Bình thường, phiên đạt mục tiêu'
                      : 'Cần cải thiện'}
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setIsRatingModalOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleSaveRating}
                disabled={savingRating}
              >
                {savingRating ? 'Đang lưu…' : 'Gửi đánh giá'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EMR Summary & Invoice Dialog                     */}
      {/* ======================================================== */}
      {isEmrModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsEmrModalOpen(false)}
        >
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-700" />
                <h3 className={styles.modalTitle}>
                  Biên bản EMR & Hóa đơn lâm sàng
                </h3>
              </div>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setIsEmrModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* EMR Badge Header */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl mb-4">
                <div className="flex justify-between items-center text-xs font-semibold text-emerald-900 mb-1">
                  <span>HỒ SƠ TƯ VẤN LÂM SÀNG</span>
                  <span className="font-mono text-[11px] text-emerald-700">
                    Mã {currentSpecialist.code}
                  </span>
                </div>
                <p className="text-xs text-slate-600 m-0">
                  Biên bản ghi nhận kết quả phiên tham vấn chuyên gia trên hệ
                  thống MentalBridge.
                </p>
              </div>

              {/* Consultation Details */}
              <div className="space-y-3 text-xs text-slate-700">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Khách hàng:</span>
                  <strong className="text-slate-900">
                    {viewerRole === 'SPECIALIST'
                      ? 'Khách hàng tham vấn'
                      : 'Tài khoản của bạn'}
                  </strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Chuyên gia phụ trách:</span>
                  <strong className="text-slate-900">
                    {currentSpecialist.name} ({currentSpecialist.specialty})
                  </strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Thời gian tham vấn:</span>
                  <span>
                    {emrData?.consultationTime.timeRange || 'Chưa xác định'} •{' '}
                    {emrData?.consultationTime.date || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Đánh giá phiên:</span>
                  <span className="font-semibold text-slate-700">
                    {emrData?.clinicalAssessment.summaryText ||
                      'Đã ghi nhận tóm tắt phiên'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Hóa đơn thanh toán:</span>
                  <span className="font-semibold text-slate-900">
                    {emrData?.invoiceId || 'INV-MB'} (
                    {emrData?.creditsUsed ? '1 Credit' : '0 Credit'})
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Trạng thái phiên:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={14} />{' '}
                    {selectedAppointment?.status === 'COMPLETED'
                      ? 'Đã hoàn tất phiên'
                      : selectedAppointment?.status || 'Đang xử lý'}
                  </span>
                </div>
              </div>

              {/* Tasks List */}
              <div className="mt-4 pt-3 border-t border-slate-200">
                <h4 className="font-bold text-slate-800 text-xs mb-2">
                  Toa dặn dò & Kế hoạch tiếp theo:
                </h4>
                {emrData?.treatmentPlan &&
                emrData.treatmentPlan.tasks.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-600 pl-4 list-disc">
                    {emrData.treatmentPlan.tasks.map((task) => (
                      <li key={task.step}>{task.title}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Chưa ghi nhận kế hoạch chi tiết.
                  </p>
                )}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => window.print()}
              >
                <Printer size={14} />
                <span>In biên bản</span>
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => setIsEmrModalOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
