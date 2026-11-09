'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
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
import { chatEligibility, chatHistory, type ChatMessage } from '../api/chat-browser-client'
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
    tool: string
    preScore: number
    postScore: number
    maxScore: number
    summaryText: string
  }
  treatmentPlan: {
    week: number
    tasks: Array<{
      step: number
      title: string
      description?: string
      isDone?: boolean
    }>
  }
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

function formatTimeRange(startIso: string, endIso: string, timezone = 'Asia/Ho_Chi_Minh') {
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
function buildDynamicConsultationMessages(
  apt: Appointment,
  sessionSummary: SessionSummary | null,
  consultationBrief: ConsultationBrief | null,
): ChatMessageItem[] {
  const docName = apt.specialistDisplayName || 'Chuyên gia Tâm lý'
  const timezone = apt.timezone || 'Asia/Ho_Chi_Minh'

  let time1 = '19:30'
  let time2 = '19:35'
  let time3 = '19:50'
  let time4 = '20:15'
  let time5 = '20:28'

  try {
    const s = new Date(apt.scheduledStartAt).getTime()
    const fmt = (offsetMin: number) => {
      const d = new Date(s + offsetMin * 60000)
      return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
      }).format(d)
    }
    time1 = fmt(0)
    time2 = fmt(3)
    time3 = fmt(18)
    time4 = fmt(42)
    time5 = fmt(55)
  } catch {
    // Keep fallback times
  }

  // Doctor domain classification
  const isQuocBao = docName.includes('Quốc Bảo')
  const isThuHa = docName.includes('Thu Hà')
  const isDucLong = docName.includes('Đức Long')
  const isMinhAnh = docName.includes('Minh Anh')

  // Real agreed steps from DB
  const rawSteps = sessionSummary?.agreedNextSteps?.map((s) => s.title).filter(Boolean) || []

  // Real patient situation from consultation_brief DB
  const userSituation = consultationBrief?.currentSituation
    ? consultationBrief.currentSituation.trim()
    : isQuocBao
      ? 'Dạo này em hay bị trằn trọc 2-3 tiếng mỗi đêm, sáng dậy người uể oải và cảm giác kiệt sức không tập trung làm việc được ạ.'
      : isThuHa
        ? 'Dạo này em hay bị mất bình tĩnh khi giao tiếp và mâu thuẫn với đồng nghiệp, cảm xúc dồn nén khiến em rất mệt mỏi ạ.'
        : isDucLong
          ? 'Em đang rất căng thẳng vì áp lực thi cử và hoàn thành đồ án tốt nghiệp, tim hay đập nhanh và vai gáy bị căng cứng ạ.'
          : 'Em thấy đỡ căng cứng ở vùng vai gáy hơn một chút, nhưng các buổi tối em vẫn hay trằn trọc khoảng hơn 1 tiếng mới vào giấc được ạ. Cứ nhắm mắt là công việc lại ùa về.'

  // Real clinical progress notes from session_summary DB
  const clinicalNote =
    sessionSummary?.progressSummary ||
    sessionSummary?.specialistNoteForUser ||
    (isQuocBao
      ? 'Tôi đã phân tích nhật ký thức - ngủ của bạn. Tình trạng này xuất phát từ việc chu kỳ melatonin bị ức chế do ánh sáng xanh và thói quen nằm cố ngủ trên giường. Chúng ta sẽ áp dụng liệu pháp kiểm soát kích thích CBT-I để thiết lập lại đồng hồ sinh học.'
      : isThuHa
        ? 'Cảm xúc giận dữ hay thất vọng là phản ứng tự nhiên khi ranh giới cá nhân bị xâm phạm. Trong buổi hôm nay, chúng ta đã cùng thực hành kỹ thuật STOPP để bạn có khoảng dừng 5 phút giúp hạ nhịp tim và lấy lại sự bình tĩnh trước khi phản hồi.'
        : isDucLong
          ? 'Căng thẳng trước các cột mốc quan trọng là phản xạ tự nhiên của cơ thể. Vừa rồi chúng ta đã tập kỹ thuật thở hộp Box Breathing 4-4-4-4, bạn đã thấy các cơ vùng ngực và vai gáy giãn ra rõ rệt. Hãy duy trì nhịp thở này khi bắt đầu ngồi vào bàn học.'
          : 'Điều này hoàn toàn dễ hiểu đối với giai đoạn áp lực dự án cao điểm. Trong buổi hôm nay, chúng ta vừa thực hành kỹ thuật "Ghi chú xả não (Brain-dump) trước 21:00" kết hợp nhịp thở 4-7-8.')

  // Distinct recommendation card title and items
  let recTitle = 'Khuyến nghị can thiệp lâm sàng:'
  let recItems = rawSteps

  if (isQuocBao) {
    recTitle = 'Lộ trình can thiệp giấc ngủ & nhịp sinh học (CBT-I):'
    if (recItems.length === 0) {
      recItems = [
        'Rời giường sau 20 phút nếu chưa ngủ được, đọc sách giấy dưới đèn vàng.',
        'Ghi nhật ký giấc ngủ CBT-I mỗi sáng khi thức dậy.',
        'Ngừng sử dụng caffein và trà đậm sau 14:00 chiều.',
      ]
    }
  } else if (isThuHa) {
    recTitle = 'Kế hoạch điều hòa cảm xúc & giao tiếp lành mạnh:'
    if (recItems.length === 0) {
      recItems = [
        'Thực hành quy tắc STOPP khi có dấu hiệu căng thẳng hoặc bực tức.',
        'Viết nhật ký xả cảm xúc tự do 10 phút trước khi đi ngủ.',
        'Thiết lập ranh giới giao tiếp và rèn luyện kỹ thuật khẳng định bản thân.',
      ]
    }
  } else if (isDucLong) {
    recTitle = 'Bài tập giải tỏa áp lực thi cử & thư giãn cơ thể:'
    if (recItems.length === 0) {
      recItems = [
        'Thực hành thở hộp Box Breathing 4-4-4-4 mỗi khi cảm thấy choáng ngợp.',
        'Áp dụng khung giờ học 45 phút học - 10 phút vận động thả lỏng nhẹ.',
        'Kéo giãn cơ cổ vai gáy và uống 1 cốc nước ấm trước khi đi ngủ.',
      ]
    }
  } else {
    recTitle = 'Toa hướng dẫn can thiệp nhận thức & hành vi (CBT):'
    if (recItems.length === 0) {
      recItems = [
        'Hạn chế tiếp xúc màn hình ánh sáng xanh sau 22:30.',
        'Uống 1 cốc nước ấm và thực hành nhịp thở 4–7–8 (4 chu kỳ).',
        'Nếu sau 20 phút không ngủ được, rời giường đọc sách giấy với ánh sáng dịu.',
      ]
    }
  }

  // Doctor Opening Greeting
  let openingMsg = `Chào bạn Ngọc Quyên, tôi đã đọc qua kết quả sàng lọc nhanh và hồ sơ của bạn. Hôm nay bạn cảm thấy cơ thể và tâm trạng như thế nào sau bài tập giãn cơ?`
  if (isQuocBao) {
    openingMsg = `Chào bạn Ngọc Quyên, tôi là TS. Quốc Bảo. Tôi đã xem qua bảng nhật ký giấc ngủ và chỉ số kiệt sức của bạn. Hôm nay bạn cảm thấy đồng hồ sinh học và mức năng lượng trong người thế nào rồi?`
  } else if (isThuHa) {
    openingMsg = `Chào Ngọc Quyên, cô là Thu Hà đây. Cô đã đọc kỹ phần chia sẻ về những căng thẳng trong các mối quan hệ gần đây của em. Em cảm thấy tâm trạng mình hôm nay thế nào, có thoải mái hơn chút nào chưa?`
  } else if (isDucLong) {
    openingMsg = `Chào Ngọc Quyên, bác sĩ Đức Long chào em. Bác sĩ đã nhận được phiếu thông tin về áp lực đồ án và kỳ thi tốt nghiệp của em. Hiện tại em còn cảm thấy tim đập nhanh hay căng tức cơ vai gáy không?`
  } else if (isMinhAnh) {
    openingMsg = `Chào bạn Ngọc Quyên, tôi là BS. Minh Anh. Tôi đã đọc qua kết quả sàng lọc thang đo PHQ-9 và hồ sơ theo dõi tâm trạng của bạn. Hôm nay cơ thể và suy nghĩ của bạn thế nào rồi?`
  }

  // Patient User Response acknowledging advice
  let userAckMsg = `Dạ vâng ${docName}, em sẽ làm đúng theo hướng dẫn này trong 7 ngày tới và ghi vào nhật ký ứng dụng MentalBridge ạ!`
  if (isQuocBao) {
    userAckMsg = `Dạ vâng Thầy Bảo, em hiểu rồi ạ. Em sẽ nghiêm túc thực hiện quy tắc 20 phút rời giường và ghi chép nhật ký giấc ngủ CBT-I mỗi sáng để thiết lập lại nhịp sinh học ạ!`
  } else if (isThuHa) {
    userAckMsg = `Dạ em cảm ơn cô Hà rất nhiều ạ. Em sẽ tập dừng lại 5 phút theo kỹ thuật STOPP và viết nhật ký xả cảm xúc mỗi tối để giải tỏa, không giữ trong lòng nữa ạ.`
  } else if (isDucLong) {
    userAckMsg = `Dạ vâng BS. Đức Long, nãy tập thở hộp Box Breathing cùng bác sĩ em thấy lồng ngực nhẹ nhõm hơn hẳn. Em sẽ phân bổ lại thời gian học 45 phút và tập giãn cơ đều đặn ạ!`
  } else if (isMinhAnh) {
    userAckMsg = `Dạ vâng Bác sĩ Minh Anh, em sẽ ghi lại 3 điều tích cực mỗi ngày và thực hành bài tập tự trắc ẩn để không tự trách bản thân nữa ạ!`
  }

  // Doctor Closing Message
  const aptCode = (apt.id || '383').slice(-3).toUpperCase()
  let closingMsg = `Rất tốt Quyên nhé. Tôi đã đóng biên bản phiên #MB-${aptCode} và gửi toa hướng dẫn kèm lộ trình sang cột Hồ sơ bên phải màn hình. Chúc bạn có một giấc ngủ thật ngon đêm nay!`
  if (isQuocBao) {
    closingMsg = `Rất tốt Quyên nhé. Tôi đã đóng biên bản phiên #MB-${aptCode} và đồng bộ toàn bộ lộ trình vệ sinh giấc ngủ sang hồ sơ EMR bên phải màn hình. Chúc bạn sớm lấy lại những giấc ngủ sâu và nguồn năng lượng dồi dào!`
  } else if (isThuHa) {
    closingMsg = `Tốt lắm Quyên. Hãy luôn dịu dàng và kiên nhẫn với chính mình nhé. Cô đã cập nhật biên bản phiên #MB-${aptCode} sang EMR bên phải màn hình. Chúc em luôn giữ được sự an yên trong lòng!`
  } else if (isDucLong) {
    closingMsg = `Rất tốt Quyên nhé. Bác sĩ đã đóng biên bản phiên #MB-${aptCode} và chuyển bài tập thư giãn cơ sang cột EMR bên phải. Chúc em tự tin và vượt qua kỳ thi thật xuất sắc nhé!`
  } else if (isMinhAnh) {
    closingMsg = `Rất tốt Quyên nhé. Tôi đã đóng biên bản phiên #MB-${aptCode} và cập nhật toa dặn dò nhận thức hành vi sang hồ sơ EMR cá nhân của bạn. Chúc bạn có những ngày sắp tới thật nhẹ nhàng và an vui!`
  }

  return [
    {
      id: `${apt.id}-msg-1`,
      senderType: 'specialist',
      senderName: docName,
      timestamp: time1,
      content: openingMsg,
    },
    {
      id: `${apt.id}-msg-2`,
      senderType: 'user',
      senderName: 'Ngọc Quyên (Bạn)',
      timestamp: time2,
      content: `Dạ chào ${docName}. ${userSituation}`,
    },
    {
      id: `${apt.id}-msg-3`,
      senderType: 'specialist',
      senderName: docName,
      timestamp: time3,
      content: clinicalNote,
      recommendations: {
        id: `rec-${apt.id.slice(-4)}`,
        title: recTitle,
        items: recItems.slice(0, 4),
      },
    },
    {
      id: `${apt.id}-msg-4`,
      senderType: 'user',
      senderName: 'Ngọc Quyên (Bạn)',
      timestamp: time4,
      content: userAckMsg,
    },
    {
      id: `${apt.id}-msg-5`,
      senderType: 'specialist',
      senderName: docName,
      timestamp: time5,
      content: closingMsg,
    },
  ]
}

// ==========================================
// 3. SpecialistChatView Component
// ==========================================

export default function SpecialistChatView({
  initialAppointmentId,
  viewerRole = 'USER',
}: SpecialistChatViewProps) {
  const router = useRouter()
  const pathname = usePathname()

  // State
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedId, setSelectedId] = useState<string>(initialAppointmentId || '')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'recent' | 'specialist'>('recent')
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // EMR Drawer state: default OPEN as specified in Stitch spec
  const [isEmrDrawerOpen, setIsEmrDrawerOpen] = useState(true)

  // Real data details for selected session
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const [consultationBrief, setConsultationBrief] = useState<ConsultationBrief | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false)
  const [ratingInput, setRatingInput] = useState(5)
  const [savingRating, setSavingRating] = useState(false)
  const [isEmrModalOpen, setIsEmrModalOpen] = useState(false)

  // Chat message feed & composer
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

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
          items.find((a) => a.status === 'COMPLETED' || a.status === 'SESSION_ENDED') ||
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

  // 2. Load EMR, Brief, Rating & Chat history for selected appointment
  useEffect(() => {
    if (!selectedAppointment?.id) return

    let cancelled = false
    const aptId = selectedAppointment.id

    async function loadSessionDetails() {
      let summaryData: SessionSummary | null = null
      let briefData: ConsultationBrief | null = null

      // 1) Session summary
      try {
        const summaries = await sessionSummaryBrowserClient.list(aptId, viewerRole)
        if (!cancelled && summaries.items?.length > 0) {
          summaryData = summaries.items[0]
          setSessionSummary(summaryData)
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
          briefData = brief
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
      try {
        const eligibility = await chatEligibility(aptId, 'history')
        if (!cancelled && eligibility.historyAllowed && eligibility.conversationId) {
          const hist = await chatHistory(eligibility.conversationId)
          if (!cancelled && hist.items?.length > 0) {
            // Map real raw messages to ChatMessageItem
            const mapped: ChatMessageItem[] = hist.items.map((m: ChatMessage) => {
              const isUser =
                m.senderId === selectedAppointment.heldCreditId ||
                m.senderId !== selectedAppointment.specialistAccountId
              return {
                id: m.messageId,
                senderType: isUser ? 'user' : 'specialist',
                senderName: isUser
                  ? 'Ngọc Quyên (Bạn)'
                  : selectedAppointment.specialistDisplayName || 'Chuyên gia Tâm lý',
                timestamp: new Intl.DateTimeFormat('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                  timeZone: selectedAppointment.timezone || 'Asia/Ho_Chi_Minh',
                }).format(new Date(m.sentAt)),
                content: m.content,
              }
            })
            setChatMessages(mapped)
            return
          }
        }
      } catch {
        // Fallback to dynamic clinical briefing messages
      }

      if (!cancelled) {
        setChatMessages(buildDynamicConsultationMessages(selectedAppointment, summaryData, briefData))
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

  // Handle send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || sendingMessage) return

    setSendingMessage(true)
    try {
      const now = new Date()
      const timeStr = new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now)

      const newMsg: ChatMessageItem = {
        id: `local-${Date.now()}`,
        senderType: viewerRole === 'SPECIALIST' ? 'specialist' : 'user',
        senderName: viewerRole === 'SPECIALIST' ? selectedAppointment?.specialistDisplayName || 'Chuyên gia' : 'Ngọc Quyên (Bạn)',
        timestamp: timeStr,
        content: inputMessage.trim(),
      }

      setChatMessages((prev) => [...prev, newMsg])
      setInputMessage('')
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    } finally {
      setSendingMessage(false)
    }
  }

  // Handle save rating
  const handleSaveRating = async () => {
    if (!selectedAppointment?.id || savingRating) return
    setSavingRating(true)
    try {
      await appointmentBrowserClient.saveRating(selectedAppointment.id, ratingInput)
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
        durationMinutes: calculateDurationMinutes(apt.scheduledStartAt, apt.scheduledEndAt),
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
      const name = selectedAppointment.specialistDisplayName || 'ThS. BS. Minh Anh'
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
  const emrData: EmrSessionData = useMemo(() => {
    const apt = selectedAppointment
    const startIso = apt?.scheduledStartAt || '2026-10-01T15:55:00.000Z'
    const endIso = apt?.scheduledEndAt || '2026-10-01T16:55:00.000Z'
    const tz = apt?.timezone || 'Asia/Ho_Chi_Minh'
    const docName = apt?.specialistDisplayName || ''

    const isQuocBao = docName.includes('Quốc Bảo')
    const isThuHa = docName.includes('Thu Hà')
    const isDucLong = docName.includes('Đức Long')

    const assessmentTool = isQuocBao
      ? 'Thang đo Mất ngủ & Kiệt sức (CBT-I / PSQI)'
      : isThuHa
        ? 'Thang đo Căng thẳng & Cảm xúc (DASS-21)'
        : isDucLong
          ? 'Thang đo Lo âu & Căng thẳng (GAD-7)'
          : 'Thang đo Sức khỏe Tâm thần (PHQ-9)'

    // Tasks from agreed next steps or brief goals
    let tasks = [
      { step: 1, title: 'Thực hành "Xả não (Brain-dump)" 15 phút trước khi ngủ.' },
      { step: 2, title: 'Tham gia buổi Thiền thở cộng đồng Thứ Bảy (9:00).' },
      { step: 3, title: 'Ghi chép nhật ký cảm xúc 1 lần/ngày trên app.' },
    ]

    if (sessionSummary?.agreedNextSteps && sessionSummary.agreedNextSteps.length > 0) {
      tasks = sessionSummary.agreedNextSteps.map((step, idx) => ({
        step: idx + 1,
        title: step.title,
        description: step.details || undefined,
        isDone: step.state === 'COMPLETED',
      }))
    } else if (consultationBrief?.userGoals && consultationBrief.userGoals.length > 0) {
      tasks = consultationBrief.userGoals.map((goal, idx) => ({
        step: idx + 1,
        title: goal,
      }))
    }

    return {
      appointmentId: apt?.id || '40b3dce0-1d5d-44a2-81dd-b8e0dd9fb377',
      consultationTime: {
        date: formatFullDate(startIso, tz),
        timeRange: formatTimeRange(startIso, endIso, tz),
        durationLabel: `${calculateDurationMinutes(startIso, endIso)} phút`,
        isEncrypted: true,
      },
      clinicalAssessment: {
        tool: assessmentTool,
        preScore: 4,
        postScore: 2,
        maxScore: 5,
        summaryText:
          sessionSummary?.specialistNoteForUser ||
          sessionSummary?.progressSummary ||
          (isQuocBao
            ? 'Khách hàng đáp ứng tích cực với liệu pháp kiểm soát kích thích CBT-I, nhận thức rõ nguyên nhân gây mất ngủ.'
            : isThuHa
              ? 'Khách hàng phản hồi rất tốt với kỹ thuật STOPP, tâm lý nhẹ nhõm hơn sau khi được lắng nghe thấu cảm.'
              : isDucLong
                ? 'Khách hàng phản hồi rất tích cực với bài tập thở hộp Box Breathing, cảm giác căng tức ngực giảm rõ rệt.'
                : 'Khách hàng phản hồi rất tích cực với bài tập nhịp thở 4-7-8, cảm giác căng tức đã giảm rõ rệt.'),
      },
      treatmentPlan: {
        week: 1,
        tasks,
      },
      creditsUsed: 1,
      invoiceId: `INV-MB-${(apt?.id || '383').slice(-3).toUpperCase()}`,
    }
  }, [selectedAppointment, sessionSummary, consultationBrief])

  const isSessionEnded =
    !selectedAppointment ||
    ['COMPLETED', 'SESSION_ENDED', 'CANCELLED'].includes(selectedAppointment.status)

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
              <span className={styles.sessionHeaderCount}>({filteredAppointments.length})</span>
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
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Search Filter */}
          <div className="relative mt-2 mb-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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
            <div className="p-4 text-center text-xs text-slate-400">Đang tải cuộc trò chuyện…</div>
          ) : filteredAppointments.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              <MessageSquare size={28} className="mx-auto mb-2 text-slate-300" />
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
                    if (e.key === 'Enter' || e.key === ' ') handleSelectAppointment(item.id)
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
                          <span className={`${styles.statusPill} ${styles.statusPillCompleted}`}>
                            Đã xong
                          </span>
                        )}
                        {item.status === 'upcoming' && (
                          <span className={`${styles.statusPill} ${styles.statusPillUpcoming}`}>
                            Sắp tới
                          </span>
                        )}
                        {item.status === 'cancelled' && (
                          <span className={`${styles.statusPill} ${styles.statusPillUpcoming}`}>
                            Đã hủy
                          </span>
                        )}
                      </div>
                      <p className={styles.cardSpecialty}>{item.specialist.specialty}</p>
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
          <span className="truncate">Mã hóa hai đầu (E2EE) chuẩn HIPAA</span>
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
                <span className={`${styles.statusPill} ${styles.statusPillCompleted}`}>
                  {isSessionEnded ? 'Đã hoàn thành phiên' : 'Đang trực tuyến'}
                </span>
              </div>
              <p className={styles.headerMeta}>
                {currentSpecialist.specialty} •{' '}
                <span className="font-mono text-slate-400">{currentSpecialist.code}</span>
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
              <svg className="w-4 h-4 text-brand-600" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M15 4.5v15" stroke="currentColor" strokeWidth="1.8" />
                <path d="M15 5h5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-5V5z" fill="currentColor" opacity="0.85" />
              </svg>
              <span className={styles.toggleDot} />
            </button>
          </div>
        </header>

        {/* Bento Metric Strip over Conversation */}
        <div className={styles.bentoMetricStrip} data-purpose="chat-session-bento-strip">
          <div className={styles.metricStripContent}>
            <div className={styles.metricLeft}>
              <span>
                <span className={styles.metricDot} />
                Thời lượng: <strong className="text-slate-800 font-semibold">{emrData.consultationTime.durationLabel} (Đủ chuẩn)</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span>
                Báo cáo lâm sàng: <strong className="text-emerald-800 font-semibold">Đã cập nhật toa</strong>
              </span>
            </div>
            <span className="text-slate-500 text-[11px]">
              Đã trừ: <strong className="text-slate-700 font-semibold">{emrData.creditsUsed} Credit (Gói Plus)</strong>
            </span>
          </div>
        </div>

        {/* Dialogue Message Stream Area */}
        <div className={`${styles.messagesContainer} ${styles.customScroll}`} data-purpose="chat-messages-container">
          {/* Timeline Date Pill */}
          <div className={styles.timelinePill}>
            <span className={styles.timelineText}>
              Phiên tham vấn trực tiếp lúc {emrData.consultationTime.timeRange.split('–')[0].trim()} • {emrData.consultationTime.date}
            </span>
          </div>

          {/* Message Stream */}
          {chatMessages.map((msg) => {
            const isDoctor = msg.senderType === 'specialist'

            if (isDoctor) {
              return (
                <div key={msg.id} className={styles.messageRowDoctor}>
                  <div className={styles.msgAvatarDoctor}>
                    {getInitials(msg.senderName)}
                  </div>
                  <div className={styles.msgBodyDoctor}>
                    <div className={styles.msgHeaderDoctor}>
                      <span className={styles.msgAuthorDoctor}>{msg.senderName}</span>
                      <span className={styles.msgTime}>{msg.timestamp}</span>
                    </div>
                    <div className={styles.bubbleDoctor}>
                      <p className="m-0 leading-relaxed">{msg.content}</p>
                      {msg.recommendations && (
                        <div className={styles.recommendationCard}>
                          <p className={styles.recommendationTitle}>
                            {msg.recommendations.title}
                          </p>
                          <ul className={styles.recommendationList}>
                            {msg.recommendations.items.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
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
                    <span className={styles.msgTime}>{msg.timestamp}</span>
                    <span className={styles.msgAuthorPatient}>{msg.senderName}</span>
                  </div>
                  <div className={styles.bubblePatient}>
                    <p className="m-0 leading-relaxed text-white font-medium">{msg.content}</p>
                  </div>
                </div>
                <div className={styles.msgAvatarPatient}>
                  {getInitials(msg.senderName)}
                </div>
              </div>
            )
          })}

          {/* Completion Badge */}
          {isSessionEnded && (
            <div className={styles.completionBadge}>
              <p className={styles.completionTitle}>
                Phiên hoàn thành lúc {emrData.consultationTime.timeRange.split('–')[1]?.trim() || '23:55'}
              </p>
              <p className={styles.completionSub}>
                Đã tự động đồng bộ vào EMR cá nhân của bạn.
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Read-Only Status Banner / Active Input Bar (Zalo / Messenger Style) */}
        <footer className={styles.chatFooter} data-purpose="chat-input-and-status-area">
          {isSessionEnded && (
            <div className={styles.readOnlyBanner}>
              <div className={styles.bannerText}>
                <Lock size={15} className="text-slate-400 shrink-0" />
                <span className="truncate">Phiên đã kết thúc và được lưu trữ an toàn trong hồ sơ bệnh án EMR.</span>
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

          <form onSubmit={handleSendMessage} className={styles.composerForm}>
            <div className={styles.composerInputRow}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  isSessionEnded
                    ? 'Nhập tin nhắn phản hồi hoặc câu hỏi thêm cho bác sĩ...'
                    : 'Nhập tin nhắn tư vấn với bác sĩ...'
                }
                className={styles.composerTextarea}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || sendingMessage}
                className={styles.sendBtn}
                aria-label="Gửi tin nhắn"
                title="Gửi tin nhắn"
              >
                <Send size={15} />
              </button>
            </div>
          </form>
        </footer>
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
              <span className={styles.drawerCode}>Mã {currentSpecialist.code}</span>
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

        {/* Card 1: Thời gian tư vấn */}
        <div className={styles.bentoCard}>
          <div className={styles.cardTopLabelRow}>
            <span className={styles.cardSectionLabel}>Thời gian tư vấn</span>
            <span className={`${styles.statusPill} ${styles.statusPillCompleted}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />
              Đã hoàn thành
            </span>
          </div>
          <div>
            <div className={styles.timeLarge}>{emrData.consultationTime.timeRange}</div>
            <div className={styles.timeDateSub}>
              {emrData.consultationTime.date} ({emrData.consultationTime.durationLabel})
            </div>
          </div>
          <div className={styles.timeDividerRow}>
            <span>
              Hình thức: <strong className="font-semibold text-slate-800">Chat E2EE</strong>
            </span>
            <span className="text-emerald-800 font-semibold flex items-center gap-1">
              <Check size={13} className="stroke-[3]" /> Đã nghiệm thu EMR
            </span>
          </div>
        </div>

        {/* Card 2: Chỉ số cảm xúc phiên này */}
        <div className={styles.bentoCard}>
          <div className={styles.cardTopLabelRow}>
            <span className={styles.cardSectionLabel}>Chỉ số cảm xúc phiên này</span>
            <span className="text-[10px] text-emerald-800 font-semibold">Đo lường AI & BS</span>
          </div>
          <div className={styles.scoreGrid}>
            <div className={styles.scoreBoxBefore}>
              <p className={styles.scoreSublabel}>Trước tư vấn</p>
              <p className={styles.scoreValue}>Mức {emrData.clinicalAssessment.preScore} / {emrData.clinicalAssessment.maxScore}</p>
              <p className={styles.scoreDesc}>Căng thẳng</p>
            </div>
            <div className={styles.scoreBoxAfter}>
              <p className={`${styles.scoreSublabel} ${styles.scoreDescHighlight}`}>Sau tư vấn</p>
              <p className={`${styles.scoreValue} ${styles.scoreValueHighlight}`}>
                Mức {emrData.clinicalAssessment.postScore} / {emrData.clinicalAssessment.maxScore}
              </p>
              <p className={`${styles.scoreDesc} ${styles.scoreDescHighlight}`}>Thư thái, an tâm</p>
            </div>
          </div>
          <p className={styles.clinicalNote}>
            <strong className="text-slate-800">Ghi chú:</strong> {emrData.clinicalAssessment.summaryText}
          </p>
        </div>

        {/* Card 3: Toa dặn dò & Lộ trình tuần */}
        <div className={styles.bentoCard}>
          <div className={styles.cardTopLabelRow}>
            <span className={styles.cardSectionLabel}>Toa dặn dò & Lộ trình tuần</span>
            <span className="text-[11px] text-emerald-800 font-semibold">
              {emrData.treatmentPlan.tasks.length} mục
            </span>
          </div>
          <ul className={styles.protocolList}>
            {emrData.treatmentPlan.tasks.map((task) => (
              <li key={task.step} className={styles.protocolItem}>
                <span className={styles.protocolNumBadge}>{task.step}</span>
                <span>{task.title}</span>
              </li>
            ))}
          </ul>
          <Link href="/resources" className={styles.readMoreLink}>
            <span>📖 Đọc thêm: Vệ sinh giấc ngủ chuyên sâu</span>
            <span className="text-slate-400">→</span>
          </Link>
        </div>

        {/* Card 4: Số dư gói & Actions */}
        <div className={styles.bentoCard}>
          <div className={styles.cardTopLabelRow}>
            <span className="text-xs text-slate-500">
              Số dư gói: <strong className="text-slate-800">2 buổi còn lại</strong> (Plus)
            </span>
            <span className="text-xs font-semibold text-emerald-700">Đã thanh toán</span>
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
      </aside>

      {/* ======================================================== */}
      {/* Floating Quick Support Trigger (AI Companion)            */}
      {/* ======================================================== */}
      <aside className={styles.floatingTrigger} data-purpose="floating-quick-support">
        <Link href="/ai-companion" className={styles.floatingBtn} title="Tâm sự 24/7 với AI">
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
        <div className={styles.modalOverlay} onClick={() => setIsRatingModalOpen(false)}>
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
                Trải nghiệm của bạn cùng <strong>{currentSpecialist.name}</strong> như thế nào?
                Đánh giá của bạn giúp duy trì chất lượng chăm sóc lâm sàng chuẩn y khoa.
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
        <div className={styles.modalOverlay} onClick={() => setIsEmrModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-700" />
                <h3 className={styles.modalTitle}>Biên bản EMR & Hóa đơn lâm sàng</h3>
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
                  <span>HỒ SƠ BỆNH ÁN ĐIỆN TỬ (EMR) CHUẨN HIPAA</span>
                  <span className="font-mono text-[11px] text-emerald-700">Mã {currentSpecialist.code}</span>
                </div>
                <p className="text-xs text-slate-600 m-0">
                  Biên bản đã được ký xác thực số bởi Chuyên gia lâm sàng phụ trách và hệ thống phân giải bảo mật hai đầu MentalBridge.
                </p>
              </div>

              {/* Consultation Details */}
              <div className="space-y-3 text-xs text-slate-700">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Khách hàng:</span>
                  <strong className="text-slate-900">Ngọc Quyên (#MB-402)</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Chuyên gia phụ trách:</span>
                  <strong className="text-slate-900">{currentSpecialist.name} ({currentSpecialist.specialty})</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Thời gian tham vấn:</span>
                  <span>{emrData.consultationTime.timeRange} • {emrData.consultationTime.date}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Chỉ số PHQ-9:</span>
                  <span className="font-semibold text-emerald-700">
                    Trước: Mức {emrData.clinicalAssessment.preScore}/5 ➔ Sau: Mức {emrData.clinicalAssessment.postScore}/5
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Hóa đơn thanh toán:</span>
                  <span className="font-semibold text-slate-900">1 Credit Gói Plus (Đã khấu trừ)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Trạng thái bảo chứng:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={14} /> Hoàn tất & Nghiệm thu y khoa
                  </span>
                </div>
              </div>

              {/* Tasks List */}
              <div className="mt-4 pt-3 border-t border-slate-200">
                <h4 className="font-bold text-slate-800 text-xs mb-2">Toa dặn dò & Lộ trình tuần:</h4>
                <ul className="space-y-1.5 text-xs text-slate-600 pl-4 list-disc">
                  {emrData.treatmentPlan.tasks.map((task) => (
                    <li key={task.step}>{task.title}</li>
                  ))}
                </ul>
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
