import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  AppState,
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { colors, radii, spacing, typography } from '@/theme/tokens'
import type { ChatSession } from './chat-session'
import type { Eligibility } from './chat-contract'

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
}: Readonly<{ session: ChatSession; subject: string; onBack: () => void }>) {
  const state = useSyncExternalStore(session.subscribe, session.snapshot)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const statusRef = useRef<Text>(null)
  const composerFocused = useRef(false)
  useEffect(() => {
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
  }, [session])
  const ready = state.phase === 'ready'
  const canSend = ready && state.eligibility?.sendAllowed === true
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
    const accepted = await session.send(text)
    // Once dispatched, the immutable pending row owns retry; don't create a second ID.
    if (
      accepted ||
      session
        .snapshot()
        .pending.some((item) => item.command.payload.content === text)
    )
      setDraft('')
    setBusy(false)
  }
  const headline = state.eligibility
    ? phaseCopy(state.eligibility.phase)
    : state.phase === 'reconnecting'
      ? 'Đang kết nối lại. Chưa thể xác nhận tin nhắn đã gửi.'
      : state.phase === 'checking' || state.phase === 'connecting'
        ? 'Đang xác minh cuộc trò chuyện…'
        : issueCopy(state.issue)
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.column}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={styles.back}
          >
            <Text style={styles.link}>Về danh sách phiên</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            Trò chuyện tư vấn
          </Text>
          <Text
            ref={statusRef}
            accessible
            accessibilityLiveRegion="polite"
            testID="chat-status"
            style={styles.status}
          >
            {headline}
          </Text>
          {state.eligibility && (
            <Text style={styles.body}>
              {new Intl.DateTimeFormat('vi-VN', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(state.eligibility.scheduledStartAt))}
            </Text>
          )}
          {state.issue && (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {issueCopy(state.issue)}
            </Text>
          )}
          {state.phase === 'blocked' && (
            <PrimaryButton
              label="Kiểm tra lại kết nối"
              onPress={() => session.start()}
            />
          )}
        </View>
        <ScrollView
          style={styles.history}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          testID="chat-messages"
        >
          {state.nextCursor && (
            <PrimaryButton
              label="Xem tin nhắn cũ hơn"
              onPress={() => void session.loadOlder()}
            />
          )}
          {state.messages.length === 0 && (
            <Text style={styles.body}>
              {state.eligibility?.historyAllowed
                ? 'Chưa có tin nhắn được lưu trong phiên này.'
                : 'Lịch sử sẽ xuất hiện khi quyền truy cập được xác nhận.'}
            </Text>
          )}
          {state.messages.map((item) => (
            <View
              key={item.messageId}
              style={[styles.message, item.senderId === subject && styles.own]}
            >
              <Text style={styles.sender}>
                {item.senderId === subject ? 'Bạn' : 'Người tham gia'}
              </Text>
              <Text selectable style={styles.body}>
                {item.content}
              </Text>
              <Text style={styles.meta}>
                Đã lưu trên hệ thống ·{' '}
                {new Intl.DateTimeFormat('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(item.sentAt))}
              </Text>
            </View>
          ))}
          {state.pending.map((item) => (
            <View
              key={item.command.commandId}
              style={[styles.message, styles.own]}
            >
              <Text style={styles.body}>{item.command.payload.content}</Text>
              <Text accessibilityLiveRegion="polite" style={styles.meta}>
                {item.state === 'pending'
                  ? 'Đang gửi…'
                  : item.state === 'accepted'
                    ? 'Đã được hệ thống chấp nhận. Đang tải bản lưu.'
                    : item.state === 'unconfirmed'
                      ? 'Chưa xác nhận đã lưu. Kiểm tra lại cùng tin nhắn.'
                      : 'Chưa gửi được. Có thể thử lại cùng tin nhắn.'}
              </Text>
              {(item.state === 'unconfirmed' || item.state === 'failed') && (
                <PrimaryButton
                  label="Thử lại tin nhắn"
                  disabled={!canSend || busy}
                  onPress={() => {
                    setBusy(true)
                    void session
                      .send(item.command.payload.content ?? '', item.command)
                      .finally(() => setBusy(false))
                  }}
                />
              )}
            </View>
          ))}
        </ScrollView>
        <View style={styles.composer}>
          {ready &&
            state.eligibility?.checkInAllowed &&
            !state.eligibility.participantCheckedIn && (
              <PrimaryButton
                label="Tham gia phiên"
                disabled={busy}
                onPress={() => {
                  setBusy(true)
                  void session.checkIn().finally(() => setBusy(false))
                }}
              />
            )}
          {canSend ? (
            <>
              <TextInput
                accessibilityLabel="Tin nhắn tư vấn"
                testID="chat-composer"
                onFocus={() => {
                  composerFocused.current = true
                }}
                onBlur={() => {
                  composerFocused.current = false
                }}
                multiline
                maxLength={4000}
                value={draft}
                onChangeText={setDraft}
                editable={!busy}
                style={styles.input}
                placeholder="Viết tin nhắn…"
              />
              <PrimaryButton
                label="Gửi tin nhắn"
                testID="chat-send"
                disabled={busy || !draft.trim()}
                onPress={() => void send()}
              />
            </>
          ) : (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {headline}
            </Text>
          )}
          <Text style={styles.meta}>
            Tin nhắn không xác định kết quả buổi tư vấn hoặc việc sử dụng lượt
            tư vấn.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  column: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
  },
  title: { color: colors.ink, fontSize: typography.heading, fontWeight: '700' },
  status: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  body: {
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    color: colors.ink,
  },
  meta: { fontSize: typography.eyebrow, lineHeight: 20, color: colors.inkSoft },
  back: { minHeight: 48, justifyContent: 'center' },
  link: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  history: { flex: 1 },
  messages: { padding: spacing.lg, gap: spacing.md },
  message: {
    alignSelf: 'flex-start',
    maxWidth: '95%',
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  own: { alignSelf: 'flex-end', backgroundColor: colors.tealPale },
  sender: {
    color: colors.tealDeep,
    fontSize: typography.eyebrow,
    fontWeight: '700',
  },
  composer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  input: {
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.tealDeep,
    borderRadius: radii.control,
    padding: spacing.md,
    fontSize: typography.body,
    color: colors.ink,
    textAlignVertical: 'top',
  },
})
