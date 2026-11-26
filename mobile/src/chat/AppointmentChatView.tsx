import {
  Fragment,
  useCallback,
  useContext,
  useRef,
  useState,
  type Ref,
} from 'react'
import { useFocusEffect } from 'expo-router'
import {
  ActivityIndicator,
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
import type { Appointment } from '@/appointments/appointment-contract'
import { CrisisSupportOffsetContext } from '@/crisis-support/crisis-support-offset'
import { useResourceFonts } from '@/resources/useResourceFonts'
import { colors, radii, spacing } from '@/theme/tokens'
import type { ChatState, PendingMessage } from './chat-session'
import {
  chatCreditLabels,
  chatDate,
  chatDayKey,
  chatInitials,
  chatPhaseLabels,
  chatTime,
} from './chat-presentation'

export type AppointmentChatViewProps = Readonly<{
  state: ChatState
  subject: string
  draft: string
  busy: boolean
  canSend: boolean
  headline: string
  issueMessage?: string
  statusRef: Ref<Text>
  appointment?: Appointment
  counterpartName: string
  specialty?: string
  onBack: () => void
  onSend: () => void
  onDraftChange: (value: string) => void
  onComposerFocus: () => void
  onComposerBlur: () => void
  onCheckIn: () => void
  onRetryConnection: () => void
  onLoadOlder: () => void
  onRetryMessage: (item: PendingMessage) => void
  onViewAppointment?: () => void
  onViewSummary?: () => void
  onBook?: () => void
}>

export function AppointmentChatView({
  statusRef,
  ...props
}: AppointmentChatViewProps) {
  const {
    state,
    subject,
    counterpartName: name,
    appointment,
    busy,
    canSend,
  } = props
  const fonts = useResourceFonts()
  const font = fonts ? { fontFamily: 'ResourceSans' } : undefined
  const bold = fonts
    ? { fontFamily: 'ResourceSansSemibold', fontWeight: 'normal' as const }
    : undefined
  const serif = fonts ? { fontFamily: 'ResourceSerif' } : undefined
  const [detailsOpen, setDetailsOpen] = useState(true)
  const scroll = useRef<ScrollView>(null)
  const followLatest = useRef(true)
  const composerHeight = useRef(0)
  const setCrisisOffset = useContext(CrisisSupportOffsetContext)
  useFocusEffect(
    useCallback(() => {
      setCrisisOffset(composerHeight.current)
      return () => setCrisisOffset(0)
    }, [setCrisisOffset]),
  )
  const timeZone = appointment?.timezone ?? 'Asia/Ho_Chi_Minh'
  const decision = state.eligibility
  const closed = Boolean(
    decision &&
    !['ACTIVE', 'WAITING', 'TOO_EARLY', 'NOT_AVAILABLE'].includes(
      decision.phase,
    ),
  )
  const completed = decision?.phase === 'COMPLETED'
  const starting = state.phase === 'checking' || state.phase === 'connecting'
  const initials = chatInitials(name)
  const minutes = decision
    ? Math.round(
        (Date.parse(decision.scheduledEndAt) -
          Date.parse(decision.scheduledStartAt)) /
          60000,
      )
    : null

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.column}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Về danh sách phiên"
            onPress={props.onBack}
            style={styles.iconButton}
          >
            <Text accessible={false} style={styles.icon}>
              ←
            </Text>
          </Pressable>
          <View style={styles.avatar}>
            <Text style={[styles.initials, bold]}>{initials}</Text>
          </View>
          <View style={styles.flex}>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={[styles.name, serif]}
            >
              {name}
            </Text>
            <Text numberOfLines={1} style={[styles.small, font]}>
              {props.specialty || 'Trò chuyện theo lịch hẹn'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              detailsOpen ? 'Ẩn thông tin buổi hẹn' : 'Hiện thông tin buổi hẹn'
            }
            accessibilityState={{ expanded: detailsOpen, disabled: !decision }}
            disabled={!decision}
            onPress={() => {
              if (!detailsOpen) {
                followLatest.current = false
                scroll.current?.scrollTo({ y: 0, animated: false })
              }
              setDetailsOpen((value) => !value)
            }}
            style={styles.iconButton}
          >
            <Text accessible={false} style={styles.icon}>
              ⓘ
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tải lại phòng trò chuyện"
            onPress={props.onRetryConnection}
            style={styles.iconButton}
          >
            <Text accessible={false} style={styles.icon}>
              ↻
            </Text>
          </Pressable>
        </View>
        <ScrollView
          ref={scroll}
          style={styles.history}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          testID="chat-messages"
          scrollEventThrottle={100}
          onScroll={(event) => {
            const { layoutMeasurement, contentOffset, contentSize } =
              event.nativeEvent
            followLatest.current =
              contentSize.height - contentOffset.y - layoutMeasurement.height <
              100
          }}
          onContentSizeChange={() => {
            if (followLatest.current)
              scroll.current?.scrollToEnd({ animated: false })
          }}
        >
          {detailsOpen && decision ? (
            <View style={styles.sessionCard}>
              <View style={styles.rowBetween}>
                <Text style={[styles.eyebrow, font]}>
                  ● LỊCH HẸN #
                  {decision.appointmentId.slice(0, 8).toLocaleUpperCase()}
                </Text>
                <Text
                  style={[styles.phaseBadge, completed && styles.mint, font]}
                >
                  {chatPhaseLabels[decision.phase]}
                </Text>
              </View>
              <Text style={[styles.sessionTitle, serif]}>
                Phiên tham vấn tâm lý
              </Text>
              <Text style={[styles.schedule, font]}>
                {chatTime(decision.scheduledStartAt, timeZone)} –{' '}
                {chatTime(decision.scheduledEndAt, timeZone)}
              </Text>
              <Text style={[styles.small, font]}>
                {chatDate(decision.scheduledStartAt, timeZone)}
              </Text>
              <View style={styles.sessionFoot}>
                <Text style={[styles.small, font]}>
                  {minutes} phút · Trò chuyện trong ứng dụng
                </Text>
                <View>
                  <Text style={[styles.small, font]}>Lượt tư vấn</Text>
                  <Text style={[styles.credit, bold]}>
                    {chatCreditLabels[decision.creditState]}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.connection}>
            {starting ? (
              <ActivityIndicator
                accessibilityLabel="Đang xác minh cuộc trò chuyện"
                size="small"
                color={colors.tealDeep}
              />
            ) : null}
            <Text
              ref={statusRef}
              accessible
              accessibilityLiveRegion="polite"
              testID="chat-status"
              style={[styles.status, font]}
            >
              {props.headline}
            </Text>
          </View>
          {props.issueMessage ? (
            <View style={styles.notice}>
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.body, font]}
              >
                {props.issueMessage}
              </Text>
              {state.phase === 'blocked' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={props.onRetryConnection}
                  style={styles.secondary}
                >
                  <Text style={[styles.link, bold]}>Kiểm tra lại kết nối</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {state.nextCursor ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                followLatest.current = false
                props.onLoadOlder()
              }}
              style={styles.older}
            >
              <Text style={[styles.link, bold]}>Xem tin nhắn cũ hơn</Text>
            </Pressable>
          ) : null}
          {!state.messages.length && !starting ? (
            <View style={styles.empty}>
              <Text style={[styles.body, font]}>
                {decision?.historyAllowed
                  ? 'Chưa có tin nhắn được lưu trong phiên này.'
                  : 'Lịch sử sẽ xuất hiện khi quyền truy cập được xác nhận.'}
              </Text>
            </View>
          ) : null}

          {state.messages.map((item, index) => {
            const own = item.senderId === subject
            const previous = state.messages[index - 1]
            const newDay =
              !previous ||
              chatDayKey(previous.sentAt, timeZone) !==
                chatDayKey(item.sentAt, timeZone)
            return (
              <Fragment key={`message-${item.messageId}`}>
                {newDay ? (
                  <View style={styles.day}>
                    <Text style={[styles.dayText, font]}>
                      {chatDate(item.sentAt, timeZone)}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.messageRow, own && styles.ownRow]}>
                  {!own ? (
                    <View style={styles.messageAvatar}>
                      <Text
                        accessible={false}
                        style={[styles.avatarText, font]}
                      >
                        {initials}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.messageColumn, own && styles.ownColumn]}>
                    {!own ? (
                      <Text numberOfLines={1} style={[styles.sender, font]}>
                        {name}
                      </Text>
                    ) : null}
                    <View style={[styles.bubble, own && styles.ownBubble]}>
                      <Text
                        selectable
                        style={[styles.body, font, own && styles.white]}
                      >
                        {item.content}
                      </Text>
                    </View>
                    <Text style={[styles.time, font, own && styles.ownTime]}>
                      {chatTime(item.sentAt, timeZone)}
                      {own ? ' · Đã lưu' : ''}
                    </Text>
                  </View>
                </View>
              </Fragment>
            )
          })}
          {state.pending.map((item) => (
            <View
              key={`pending-${item.command.commandId}`}
              style={[styles.messageRow, styles.ownRow]}
            >
              <View style={[styles.messageColumn, styles.ownColumn]}>
                <View style={[styles.bubble, styles.ownBubble, styles.pending]}>
                  <Text style={[styles.body, font, styles.white]}>
                    {item.command.payload.content}
                  </Text>
                </View>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.small, font]}
                >
                  {item.state === 'pending'
                    ? 'Đang gửi…'
                    : item.state === 'accepted'
                      ? 'Đã được hệ thống chấp nhận. Đang tải bản lưu.'
                      : item.state === 'unconfirmed'
                        ? 'Chưa xác nhận đã lưu. Kiểm tra lại cùng tin nhắn.'
                        : 'Chưa gửi được. Có thể thử lại cùng tin nhắn.'}
                </Text>
                {item.state === 'unconfirmed' || item.state === 'failed' ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={!canSend || busy}
                    onPress={() => props.onRetryMessage(item)}
                    style={[
                      styles.secondary,
                      (!canSend || busy) && styles.disabled,
                    ]}
                  >
                    <Text style={[styles.link, bold]}>Thử lại tin nhắn</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}

          {closed ? (
            <View style={styles.closedSection}>
              <View style={styles.closedNotice}>
                <Text accessible={false} style={styles.icon}>
                  ✓
                </Text>
                <Text style={[styles.closedCopy, font]}>
                  {completed
                    ? 'Phiên đã hoàn thành. Bạn có thể xem lại các tin nhắn đã được lưu.'
                    : props.headline}
                </Text>
              </View>
              {appointment?.sessionEndedAt ? (
                <Text style={[styles.small, font]}>
                  Kết thúc lúc {chatTime(appointment.sessionEndedAt, timeZone)}{' '}
                  · {chatDate(appointment.sessionEndedAt, timeZone)}
                </Text>
              ) : null}
              <View style={styles.followUp}>
                <Text style={[styles.followUpTitle, bold]}>
                  Cuộc trò chuyện hiện chỉ để xem
                </Text>
                <Text style={[styles.small, font]}>
                  Tiếp tục chăm sóc theo nhịp của bạn.
                </Text>
                <View style={styles.row}>
                  {(completed && props.onViewSummary) ||
                  props.onViewAppointment ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={
                        completed && props.onViewSummary
                          ? props.onViewSummary
                          : props.onViewAppointment
                      }
                      style={[styles.secondary, styles.flex]}
                    >
                      <Text style={[styles.buttonText, bold]}>
                        {completed && props.onViewSummary
                          ? '▤ Xem tóm tắt'
                          : '▤ Xem lịch hẹn'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {props.onBook ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={props.onBook}
                      style={[styles.primary, styles.flex]}
                    >
                      <Text style={[styles.buttonText, bold, styles.white]}>
                        Đặt lịch tiếp →
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={styles.composer}
          testID="chat-composer-area"
          onLayout={({ nativeEvent }) => {
            composerHeight.current = nativeEvent.layout.height
            setCrisisOffset(nativeEvent.layout.height)
          }}
        >
          {state.phase === 'ready' &&
          decision?.checkInAllowed &&
          !decision.participantCheckedIn ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={props.onCheckIn}
              style={[styles.primary, busy && styles.disabled]}
            >
              <Text style={[styles.buttonText, bold, styles.white]}>
                Tham gia phiên
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.composerRow}>
            {canSend ? (
              <TextInput
                accessibilityLabel="Tin nhắn tư vấn"
                testID="chat-composer"
                multiline
                maxLength={4000}
                value={props.draft}
                onChangeText={props.onDraftChange}
                onFocus={props.onComposerFocus}
                onBlur={props.onComposerBlur}
                editable={!busy}
                placeholder="Chia sẻ với chuyên gia…"
                placeholderTextColor={colors.inkFaint}
                style={[styles.input, font]}
              />
            ) : (
              <View style={styles.lockedInput}>
                <Text style={[styles.lockedLabel, font]} numberOfLines={2}>
                  {closed ? 'Phiên đã đóng · Chỉ xem' : 'Chưa thể gửi tin nhắn'}
                </Text>
                <Text accessible={false} style={styles.lock}>
                  🔒
                </Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gửi tin nhắn"
              testID="chat-send"
              accessibilityState={{
                disabled: !canSend || busy || !props.draft.trim(),
              }}
              disabled={!canSend || busy || !props.draft.trim()}
              onPress={props.onSend}
              style={[
                styles.send,
                (!canSend || busy || !props.draft.trim()) && styles.disabled,
              ]}
            >
              <Text accessible={false} style={styles.sendIcon}>
                ↑
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.composerHint, font]}>
            {canSend
              ? `${props.draft.length}/4000 ký tự · Nội dung chỉ dành cho người tham gia lịch hẹn`
              : 'Tin nhắn không xác định kết quả buổi tư vấn hoặc việc sử dụng lượt tư vấn.'}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5faf7' },
  column: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: '#e6eee8',
  },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  icon: { fontSize: 23, color: colors.tealDeep },
  lock: { fontSize: 15 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dce9e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: { color: colors.tealDeep, fontSize: 15, fontWeight: '600' },
  name: { color: colors.ink, fontSize: 19, lineHeight: 26 },
  small: { color: colors.inkSoft, fontSize: 11, lineHeight: 18 },
  history: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 88 },
  sessionCard: {
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: '#edf3ef',
    gap: spacing.sm,
  },
  eyebrow: { color: colors.inkSoft, fontSize: 10, letterSpacing: 0.5 },
  phaseBadge: {
    color: colors.inkSoft,
    backgroundColor: '#dfe7e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 10,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  mint: { backgroundColor: '#d3ebdf', color: colors.tealDeep },
  sessionTitle: { color: colors.ink, fontSize: 24, lineHeight: 32 },
  schedule: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  sessionFoot: {
    borderTopWidth: 1,
    borderTopColor: '#dde8e0',
    paddingTop: spacing.md,
    marginTop: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  credit: {
    color: colors.tealDeep,
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '600',
  },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  status: {
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 18,
    flexShrink: 1,
    textAlign: 'center',
  },
  notice: {
    backgroundColor: '#f8ede5',
    padding: spacing.md,
    borderRadius: 16,
    gap: spacing.sm,
  },
  empty: { padding: spacing.lg, alignItems: 'center' },
  older: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  link: { color: colors.tealDeep, fontSize: 12, fontWeight: '600' },
  day: {
    alignSelf: 'center',
    backgroundColor: '#eaf0eb',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  dayText: { color: colors.inkSoft, fontSize: 10, lineHeight: 17 },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  ownRow: { justifyContent: 'flex-end' },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dfeae3',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },
  avatarText: { color: colors.tealDeep, fontSize: 10 },
  messageColumn: { maxWidth: '86%', flexShrink: 1, gap: 6 },
  ownColumn: { alignItems: 'flex-end' },
  sender: {
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 18,
    paddingLeft: spacing.xs,
  },
  bubble: {
    padding: spacing.lg,
    borderRadius: 23,
    borderTopLeftRadius: 5,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#edf1ee',
  },
  ownBubble: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
    borderTopLeftRadius: 23,
    borderBottomRightRadius: 5,
  },
  body: { color: colors.ink, fontSize: 14, lineHeight: 25 },
  white: { color: colors.white },
  time: {
    color: colors.inkFaint,
    fontSize: 10,
    lineHeight: 17,
    paddingHorizontal: spacing.xs,
  },
  ownTime: { textAlign: 'right' },
  pending: { opacity: 0.8 },
  closedSection: {
    gap: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  closedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 24,
    backgroundColor: '#e3ece5',
    padding: spacing.lg,
  },
  closedCopy: {
    flex: 1,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 21,
    textAlign: 'center',
  },
  followUp: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
  },
  followUpTitle: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '600',
  },
  secondary: {
    minHeight: 44,
    borderRadius: radii.pill,
    padding: spacing.md,
    backgroundColor: '#e3ebe5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    minHeight: 44,
    borderRadius: radii.pill,
    padding: spacing.md,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.tealDeep,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  composer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: '#e6eee8',
    backgroundColor: colors.white,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: '#eef3ef',
    borderRadius: 23,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 23,
    textAlignVertical: 'top',
  },
  lockedInput: {
    flex: 1,
    minHeight: 48,
    backgroundColor: '#eef3ef',
    borderRadius: 23,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  lockedLabel: {
    flex: 1,
    color: colors.inkFaint,
    fontSize: 12,
    lineHeight: 19,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDeep,
  },
  sendIcon: { color: colors.white, fontSize: 25 },
  disabled: { opacity: 0.45 },
  composerHint: {
    color: colors.inkFaint,
    fontSize: 9,
    lineHeight: 15,
    textAlign: 'center',
  },
})
