import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useFocusEffect } from 'expo-router'
import { AppState, AccessibilityInfo, Keyboard, type Text } from 'react-native'
import type { Appointment } from '@/appointments/appointment-contract'
import type { ChatSession } from './chat-session'
import type { Eligibility } from './chat-contract'
import {
  AppointmentChatView,
  type AppointmentChatViewProps,
} from './AppointmentChatView'

export function phaseCopy(phase: Eligibility['phase']) {
  switch (phase) {
    case 'ACTIVE':
      return 'Đang diễn ra'
    case 'WAITING':
      return 'Phiên chưa bắt đầu. Bạn có thể tham gia và chờ đến giờ hẹn.'
    case 'TOO_EARLY':
      return 'Chưa đến giờ vào phiên. Hãy quay lại gần giờ hẹn.'
    case 'NOT_AVAILABLE':
      return 'Lịch hẹn chưa được xác nhận cho trò chuyện.'
    case 'CANCELLED':
      return 'Lịch hẹn đã bị hủy. Cuộc trò chuyện chỉ để xem.'
    case 'RESCHEDULED':
      return 'Lịch hẹn đã đổi. Cuộc trò chuyện cũ chỉ để xem.'
    default:
      return 'Phiên đã kết thúc. Cuộc trò chuyện chỉ để xem.'
  }
}
function issueCopy(code: string | null) {
  if (code?.startsWith('AUTHENTICATION_'))
    return 'Phiên đăng nhập cần được xác minh lại. Chưa thể gửi tin nhắn.'
  if (code === 'CHAT_CONTRACT_MISMATCH')
    return 'Chưa thể xác minh cuộc trò chuyện. Tạm dừng gửi để bảo vệ nội dung.'
  return 'Chưa thể kết nối hoặc xác minh quyền trò chuyện. Nội dung chưa xác nhận không được tự gửi lại.'
}

export function ChatScreen({
  session,
  subject,
  onBack,
  counterpartName,
  ...presentation
}: Readonly<{
  session: ChatSession
  subject: string
  onBack: () => void
  counterpartName?: string
  appointment?: Appointment
}> &
  Pick<
    AppointmentChatViewProps,
    'specialty' | 'onViewAppointment' | 'onViewSummary' | 'onBook'
  >) {
  const state = useSyncExternalStore(session.subscribe, session.snapshot)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const statusRef = useRef<Text>(null)
  const composerFocused = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (AppState.currentState === 'active' || AppState.currentState === null)
        session.start()
      const subscription = AppState.addEventListener('change', (value) => {
        if (value === 'active') session.start()
        else session.stop()
      })
      return () => {
        subscription.remove()
        session.stop()
      }
    }, [session]),
  )
  const canSend =
    state.phase === 'ready' && state.eligibility?.sendAllowed === true
  useEffect(() => {
    if (!canSend && composerFocused.current) {
      composerFocused.current = false
      Keyboard.dismiss()
      if (statusRef.current)
        AccessibilityInfo.sendAccessibilityEvent(statusRef.current, 'focus')
    }
  }, [canSend])
  async function send() {
    setBusy(true)
    const text = draft
    try {
      const accepted = await session.send(text)
      if (
        accepted ||
        session
          .snapshot()
          .pending.some((item) => item.command.payload.content === text)
      )
        setDraft('')
    } finally {
      setBusy(false)
    }
  }
  const headline = state.eligibility
    ? phaseCopy(state.eligibility.phase)
    : state.phase === 'reconnecting'
      ? 'Đang kết nối lại. Chưa thể xác nhận tin nhắn đã gửi.'
      : state.phase === 'checking' || state.phase === 'connecting'
        ? 'Đang xác minh cuộc trò chuyện…'
        : issueCopy(state.issue)
  const name =
    counterpartName ??
    (state.eligibility?.specialistAccountId === subject
      ? 'Người tham gia'
      : (presentation.appointment?.specialistDisplayName ?? 'Chuyên gia'))
  return (
    <AppointmentChatView
      {...presentation}
      state={state}
      subject={subject}
      draft={draft}
      busy={busy}
      canSend={canSend}
      counterpartName={name}
      headline={headline}
      statusRef={statusRef}
      onBack={onBack}
      {...(state.issue ? { issueMessage: issueCopy(state.issue) } : {})}
      onDraftChange={setDraft}
      onSend={() => void send()}
      onComposerFocus={() => {
        composerFocused.current = true
      }}
      onComposerBlur={() => {
        composerFocused.current = false
      }}
      onRetryConnection={() => session.start()}
      onLoadOlder={() => void session.loadOlder()}
      onCheckIn={() => {
        setBusy(true)
        void session.checkIn().finally(() => setBusy(false))
      }}
      onRetryMessage={(item) => {
        setBusy(true)
        void session
          .send(item.command.payload.content ?? '', item.command)
          .finally(() => setBusy(false))
      }}
    />
  )
}
