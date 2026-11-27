import { randomUUID } from 'expo-crypto'
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type AccessibilityActionEvent,
} from 'react-native'
import Animated, {
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'

import { emphasisEasing, useMotionProps } from '@/components/motion'
import { PressableScale } from '@/components/PressableScale'
import type { CommunityApi } from '@/community/community-api'
import {
  ActionRow,
  BottomSheet,
  Avatar,
  CommunityButton,
  CommunityMessage,
  IconButton,
  SkeletonGroup,
  StateCard,
  useCommandKey,
  useCommunityAction,
} from '@/community/community-ui'
import { Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'
import { communityColors } from '@/community/community-theme'
import type { CommunityChatApi } from './community-chat-api'
import {
  messageContentSchema,
  type CommunityMessage as ChatMessage,
} from './community-chat-contract'
import { CommunityChatSession } from './community-chat-session'
import type { CommunitySocketFactory } from './community-chat-socket'
import { CommunityGroupPanel } from './CommunityGroupPanel'
import {
  ChatAvatar,
  ChatBanner,
  ChatFrame,
  conversationName,
  peerAuthor,
  peerName,
  useScrollToEnd,
} from './community-chat-ui'

const time = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
})
const shortDay = new Intl.DateTimeFormat('vi-VN', {
  day: 'numeric',
  month: 'numeric',
})
const messageDay = (value: string) =>
  new Date(value).toDateString() === new Date().toDateString()
    ? 'Hôm nay'
    : shortDay.format(new Date(value))
// Consecutive messages from one sender within three minutes read as one run.
const sameRun = (first: ChatMessage | undefined, second: ChatMessage) =>
  first?.sender.state === 'AVAILABLE' &&
  second.sender.state === 'AVAILABLE' &&
  first.sender.communityProfileId === second.sender.communityProfileId &&
  new Date(first.createdAt).toDateString() ===
    new Date(second.createdAt).toDateString() &&
  Math.abs(Date.parse(second.createdAt) - Date.parse(first.createdAt)) < 180000

// The one motion in a thread: a message the user just sent fades in and rises 8 dp.
const sentEntering: EntryExitAnimationFunction = () => {
  'worklet'
  const timing = { duration: 220, easing: emphasisEasing }
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 8 }] },
    animations: {
      opacity: withTiming(1, timing),
      transform: [{ translateY: withTiming(0, timing) }],
    },
  }
}

function SentEntrance({
  enabled,
  children,
}: Readonly<{ enabled: boolean; children: ReactNode }>) {
  const motion = useMotionProps({ entering: sentEntering })
  return (
    <Animated.View
      testID="community-chat-message-row"
      {...(enabled ? motion : {})}
    >
      {children}
    </Animated.View>
  )
}

function MessageRow({
  message,
  mine,
  inGroup,
  grouped,
  continues,
  day,
  enter,
  retracting,
  busy,
  retractionFailed,
  onActions,
  onRetry,
}: Readonly<{
  message: ChatMessage
  mine: boolean
  inGroup: boolean
  grouped: boolean
  continues: boolean
  day: string | null
  enter: boolean
  retracting: boolean
  busy: boolean
  retractionFailed: boolean
  onActions: () => void
  onRetry: () => void
}>) {
  const retracted = message.state === 'RETRACTED'
  const bubble = (
    <View
      testID="community-chat-message"
      style={[
        styles.bubble,
        mine ? styles.own : styles.other,
        retracted && styles.retracted,
      ]}
    >
      <Txt
        style={[
          styles.text,
          mine && !retracted && { color: communityColors.white },
          retracted && { color: communityColors.inkSoft },
        ]}
      >
        {message.state === 'ACTIVE'
          ? message.content
          : mine
            ? 'Bạn đã gỡ tin nhắn'
            : message.sender.state === 'AVAILABLE'
              ? `${message.sender.displayName} đã gỡ tin nhắn`
              : 'Tin nhắn đã được gỡ'}
      </Txt>
    </View>
  )
  const actionLabel = mine
    ? retracting
      ? 'Đang gỡ tin nhắn…'
      : 'Gỡ tin nhắn'
    : `Báo cáo tin nhắn của ${peerName(message.sender)}`
  return (
    <>
      {day && (
        <View style={styles.day}>
          <Txt style={styles.dayText}>{day}</Txt>
        </View>
      )}
      <SentEntrance enabled={enter}>
        <View
          style={[
            styles.line,
            mine && styles.lineOwn,
            grouped ? styles.grouped : styles.runStart,
          ]}
        >
          {!mine && inGroup && (
            <View style={styles.avatarSlot}>
              {!grouped && (
                <Avatar size={28} author={peerAuthor(message.sender)} />
              )}
            </View>
          )}
          <View style={[styles.stack, mine && styles.stackOwn]}>
            {inGroup &&
              !mine &&
              !grouped &&
              message.sender.state === 'AVAILABLE' && (
                <Txt style={styles.sender}>{message.sender.displayName}</Txt>
              )}
            {message.state === 'ACTIVE' ? (
              // Long-press is the visual path; the accessibility action is the same sheet for assistive tech.
              <PressableScale
                scaleTo={0.98}
                delayLongPress={350}
                disabled={busy && mine}
                accessibilityActions={[
                  { name: 'message-actions', label: actionLabel },
                ]}
                onAccessibilityAction={(event: AccessibilityActionEvent) => {
                  if (event.nativeEvent.actionName === 'message-actions')
                    onActions()
                }}
                onLongPress={onActions}
              >
                {bubble}
              </PressableScale>
            ) : (
              bubble
            )}
            {!continues && (
              <Txt style={styles.time}>
                {time.format(new Date(message.createdAt))}
              </Txt>
            )}
            {retractionFailed && (
              <View style={styles.failure}>
                <ChatBanner icon="alert-outline" attention>
                  Chưa thể gỡ tin nhắn lúc này. Nội dung vẫn được giữ nguyên.
                </ChatBanner>
                <CommunityButton
                  variant="quiet"
                  label="Thử lại gỡ tin nhắn"
                  disabled={busy}
                  onPress={onRetry}
                />
              </View>
            )}
          </View>
        </View>
      </SentEntrance>
    </>
  )
}

const reportReasons = [
  { code: 'HARASSMENT', label: 'Quấy rối' },
  { code: 'SPAM', label: 'Tin rác' },
  { code: 'PRIVACY_CONCERN', label: 'Quyền riêng tư' },
  {
    code: 'SELF_HARM_OR_CRISIS_CONCERN',
    label: 'Lo ngại tự hại hoặc khủng hoảng',
  },
  { code: 'OTHER', label: 'Lý do khác' },
] as const

type Props = Readonly<{
  api: CommunityChatApi
  community: CommunityApi
  factory: CommunitySocketFactory
  subject: string
  ownId: string
  conversationId: string
  onBack: () => void
}>
export function CommunityConversationScreen({
  api,
  community,
  factory,
  subject,
  ownId,
  conversationId,
  onBack,
}: Props) {
  const [runtime] = useState(
    () =>
      new CommunityChatSession({
        api,
        factory,
        conversationId,
        uuid: randomUUID,
      }),
  )
  const state = useSyncExternalStore(runtime.subscribe, runtime.snapshot)
  const [draft, setDraft] = useState(''),
    [saved, setSaved] = useState(false),
    [group, setGroup] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null),
    [blocking, setBlocking] = useState(false)
  const [retractId, setRetractId] = useState<string | null>(null)
  const [reportSent, setReportSent] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)
  const [clearError, setClearError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const scroll = useScrollToEnd()
  const [sentFrom, setSentFrom] = useState(Infinity)
  const clearAttempt = useRef<string | null>(null)
  const action = useCommunityAction(),
    key = useCommandKey()
  useEffect(() => {
    if (AppState.currentState === 'active') void runtime.start()
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void runtime.start()
      else runtime.stop()
    })
    return () => {
      subscription.remove()
      runtime.clear()
    }
  }, [runtime])
  useEffect(
    () =>
      runtime.subscribe(() => {
        if (
          ['TARGET_UNAVAILABLE', 'UNAUTHENTICATED', 'FORBIDDEN'].includes(
            runtime.snapshot().issue ?? '',
          )
        ) {
          setDraft('')
          setActionId(null)
          setReportId(null)
          setRetractId(null)
          setBlocking(false)
          setClearConfirm(false)
          setClearBusy(false)
          setClearError(false)
          clearAttempt.current = null
        }
      }),
    [runtime],
  )
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (draft || state.unconfirmed || state.sending) setLeaving(true)
        else onBack()
        return true
      },
    )
    return () => subscription.remove()
  }, [draft, state.unconfirmed, state.sending, onBack])
  const ready = state.phase === 'ready'
  const value = ready ? state.conversation?.value : undefined
  const settled = ready && !state.nextCursor && state.messages.length > 0
  // Open on the latest message once the whole history is in; a jump, never an animation.
  const opened = useRef(false)
  useEffect(() => {
    if (!settled || opened.current) return
    opened.current = true
    scroll.toEnd(false)
  })
  const peer =
    value?.kind === 'DIRECT'
      ? value.peers.find(
          (item) =>
            item.state === 'AVAILABLE' && item.communityProfileId !== ownId,
        )
      : undefined
  const reconnect = () => {
    if (AppState.currentState === 'active') void runtime.start()
  }
  const send = async () => {
    setSaved(false)
    setSentFrom(state.messages.length)
    if (await runtime.send(draft)) {
      setDraft('')
      setSaved(true)
    }
  }
  const conversationIsVisible = async () => {
    let cursor: string | undefined
    do {
      const page = await api.conversations(cursor)
      if (page.items.some((item) => item.conversationId === conversationId))
        return true
      cursor = page.nextCursor ?? undefined
    } while (cursor)
    return false
  }
  const finishClear = () => {
    runtime.clear()
    setDraft('')
    setReportId(null)
    setRetractId(null)
    setBlocking(false)
    setClearConfirm(false)
    setClearError(false)
    clearAttempt.current = null
    onBack()
  }
  const clearConversation = async () => {
    if (clearBusy) return
    clearAttempt.current ??= randomUUID()
    const commandKey = clearAttempt.current
    setClearBusy(true)
    setClearError(false)
    try {
      await api.clearConversation(conversationId, commandKey)
      finishClear()
    } catch {
      try {
        if (!(await conversationIsVisible())) {
          finishClear()
          return
        }
      } catch {
        clearAttempt.current = commandKey
      }
      setClearError(true)
    } finally {
      setClearBusy(false)
    }
  }
  if (group && value?.kind === 'GROUP')
    return (
      <CommunityGroupPanel
        api={api}
        subject={subject}
        ownId={ownId}
        conversationId={conversationId}
        onBack={() => setGroup(false)}
        onExit={() => {
          runtime.clear()
          onBack()
        }}
        onChanged={() => runtime.repair()}
      />
    )
  const title = value ? conversationName(value, ownId) : 'Cuộc trò chuyện'
  const online =
    peer?.state === 'AVAILABLE' &&
    state.presence[peer.communityProfileId] === 'ONLINE'
  const leave = () => {
    if (draft || state.unconfirmed || state.sending) setLeaving(true)
    else onBack()
  }
  const activeMessage = (id: string | null) =>
    state.messages.find(
      (message) => message.messageId === id && message.state === 'ACTIVE',
    )
  const actionMessage = activeMessage(actionId)
  const header = (
    <View style={styles.header}>
      <IconButton icon="arrow-left" label="Về hộp trò chuyện" onPress={leave} />
      {value && <ChatAvatar conversation={value} ownId={ownId} size={30} />}
      <View style={styles.headerText}>
        <Txt
          accessibilityRole="header"
          numberOfLines={1}
          style={styles.headerTitle}
        >
          {title}
        </Txt>
        {online && <Txt style={styles.presence}>Đang hoạt động</Txt>}
      </View>
      {value?.kind === 'GROUP' && (
        <IconButton
          icon="account-group-outline"
          label="Thành viên và quản lý nhóm"
          onPress={() => setGroup(true)}
        />
      )}
      {value && (
        <IconButton
          icon="dots-vertical"
          label="Tùy chọn cuộc trò chuyện"
          expanded={menuOpen}
          onPress={() => setMenuOpen((open) => !open)}
        />
      )}
    </View>
  )
  const sendLabel = state.unconfirmed
    ? 'Thử gửi lại tin nhắn'
    : state.sending
      ? 'Đang gửi…'
      : 'Gửi tin nhắn'
  const footer = value ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.footer}
    >
      {saved && (
        <ChatBanner icon="check-circle-outline">
          Tin nhắn đã được lưu. Chưa có xác nhận người nhận đã nhận hoặc đọc.
          Chọn “Xem tiếp tin nhắn” nếu lịch sử còn trang sau.
        </ChatBanner>
      )}
      {state.unconfirmed && (
        <ChatBanner icon="alert-outline" attention>
          Chưa xác nhận tin nhắn đã được lưu. Bản nháp được giữ ở phiên này; thử
          lại sẽ dùng cùng mã gửi để tránh trùng.
        </ChatBanner>
      )}
      {state.issue && (
        <ChatBanner icon="alert-outline" attention>
          Yêu cầu chưa hoàn tất. Kiểm tra kết nối và thử lại.
        </ChatBanner>
      )}
      {value.state !== 'ACTIVE' && (
        <ChatBanner icon="lock-outline">
          Hội thoại chỉ đọc. Bạn không thể gửi thêm tin nhắn.
        </ChatBanner>
      )}
      {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
      {value.state === 'ACTIVE' && (
        <View style={styles.inputRow}>
          <TextInput
            testID="community-chat-composer"
            accessibilityLabel="Nội dung tin nhắn cộng đồng"
            value={draft}
            onChangeText={(text) => {
              setSaved(false)
              setDraft(text)
            }}
            multiline
            editable={!state.sending && !state.unconfirmed}
            style={styles.input}
          />
          <IconButton
            testID="community-chat-send"
            icon="send"
            filled
            label={sendLabel}
            disabled={
              state.sending || !messageContentSchema.safeParse(draft).success
            }
            onPress={() =>
              void action.run(async () => {
                await send()
                scroll.toEnd()
              })
            }
          />
        </View>
      )}
    </KeyboardAvoidingView>
  ) : undefined
  return (
    <ChatFrame
      soft
      inset={false}
      header={header}
      footer={footer}
      scrollRef={scroll.ref}
    >
      {state.phase === 'checking' && (
        <View style={styles.pad}>
          <SkeletonGroup label="Đang xác nhận quyền và kết nối…">
            <View style={styles.skeletonOther}>
              <View style={[styles.skeleton, { width: '60%', height: 40 }]} />
            </View>
            <View style={styles.skeletonOwn}>
              <View style={[styles.skeleton, { width: '45%', height: 40 }]} />
            </View>
            <View style={styles.skeletonOther}>
              <View style={[styles.skeleton, { width: '70%', height: 60 }]} />
            </View>
          </SkeletonGroup>
        </View>
      )}
      {state.phase === 'paused' && (
        <View style={styles.pad}>
          <ChatBanner icon="wifi-off" attention>
            Chưa thể xác nhận kết nối hoặc quyền truy cập. Nội dung đã được ẩn.
            Bạn có thể thử kết nối lại khi ứng dụng đang mở.
          </ChatBanner>
          <CommunityButton
            icon="refresh"
            label="Kết nối lại"
            onPress={reconnect}
          />
        </View>
      )}
      {state.phase === 'unavailable' && (
        <View style={styles.stateWrap}>
          <StateCard
            tone="error"
            icon="wifi-off"
            title="Không thể mở cuộc trò chuyện"
            body="Chưa thể xác nhận kết nối hoặc quyền truy cập. Nội dung đã được ẩn. Bạn có thể thử kết nối lại khi ứng dụng đang mở."
            actionLabel="Kết nối lại"
            onAction={reconnect}
          />
        </View>
      )}
      {value && (
        <View>
          {value.unreadCount > 0 && state.messages.length > 0 && (
            <View style={styles.unread}>
              <Txt
                style={styles.unreadText}
              >{`${value.unreadCount} tin chưa đọc`}</Txt>
              <CommunityButton
                variant="quiet"
                icon="check-all"
                label="Đánh dấu phần đã xem là đã đọc"
                onPress={() => void runtime.markRead()}
              />
            </View>
          )}
          {!state.messages.length ? (
            <View style={styles.stateWrap}>
              <StateCard
                icon="message-text-outline"
                title={
                  value.state !== 'ACTIVE'
                    ? 'Chưa có tin nhắn trong lịch sử bạn được xem.'
                    : value.kind === 'GROUP'
                      ? 'Bắt đầu cùng nhóm thật nhẹ nhàng'
                      : 'Bắt đầu thật nhẹ nhàng'
                }
                body={
                  value.state !== 'ACTIVE'
                    ? undefined
                    : value.kind === 'GROUP'
                      ? 'Chỉ thành viên đã chấp thuận mới có thể xem lịch sử và gửi tin trong nhóm này.'
                      : 'Chỉ chia sẻ điều bạn thấy an toàn. Bạn có thể chặn và rời đi bất cứ lúc nào.'
                }
              />
            </View>
          ) : (
            <View style={styles.list}>
              {state.messages.map((message, index) => {
                const previous = state.messages[index - 1],
                  next = state.messages[index + 1]
                const mine =
                  message.sender.state === 'AVAILABLE' &&
                  message.sender.communityProfileId === ownId
                return (
                  <MessageRow
                    key={message.messageId}
                    message={message}
                    mine={mine}
                    inGroup={value.kind === 'GROUP'}
                    grouped={sameRun(previous, message)}
                    continues={Boolean(next && sameRun(message, next))}
                    day={
                      !previous ||
                      new Date(previous.createdAt).toDateString() !==
                        new Date(message.createdAt).toDateString()
                        ? messageDay(message.createdAt)
                        : null
                    }
                    // Only a bubble the user just sent enters; history and pagination stay still.
                    enter={mine && index >= sentFrom}
                    retracting={state.retracting === message.messageId}
                    busy={Boolean(state.retracting)}
                    retractionFailed={
                      state.retractionIssue?.messageId === message.messageId
                    }
                    onActions={() => setActionId(message.messageId)}
                    onRetry={() => void runtime.retract(message.messageId)}
                  />
                )
              })}
            </View>
          )}
          {state.nextCursor && (
            <View style={styles.pad}>
              <CommunityButton
                label="Xem tiếp tin nhắn"
                onPress={() => {
                  setSentFrom(Infinity)
                  void runtime.more()
                }}
              />
            </View>
          )}
        </View>
      )}
      <BottomSheet
        visible={menuOpen && Boolean(value)}
        onClose={() => setMenuOpen(false)}
      >
        <ActionRow
          icon="trash-can-outline"
          danger
          label="Xóa cuộc trò chuyện phía tôi"
          disabled={clearBusy}
          onPress={() => {
            setMenuOpen(false)
            clearAttempt.current = null
            setClearError(false)
            setClearConfirm(true)
          }}
        />
        {peer?.state === 'AVAILABLE' && (
          <ActionRow
            icon="account-cancel-outline"
            danger
            label="Chặn thành viên này"
            disabled={action.busy}
            onPress={() => {
              setMenuOpen(false)
              setBlocking(true)
            }}
          />
        )}
      </BottomSheet>
      <BottomSheet
        visible={Boolean(actionMessage)}
        onClose={() => setActionId(null)}
      >
        {actionMessage &&
          (actionMessage.sender.state === 'AVAILABLE' &&
          actionMessage.sender.communityProfileId === ownId ? (
            <ActionRow
              icon="undo-variant"
              label={
                state.retracting === actionMessage.messageId
                  ? 'Đang gỡ tin nhắn…'
                  : 'Gỡ tin nhắn'
              }
              disabled={Boolean(state.retracting)}
              onPress={() => {
                setRetractId(actionMessage.messageId)
                setActionId(null)
              }}
            />
          ) : (
            <ActionRow
              icon="flag-outline"
              label={`Báo cáo tin nhắn của ${peerName(actionMessage.sender)}`}
              onPress={() => {
                setReportId(actionMessage.messageId)
                setReportSent(false)
                setActionId(null)
              }}
            />
          ))}
      </BottomSheet>
      <BottomSheet
        visible={Boolean(activeMessage(retractId))}
        title="Gỡ tin nhắn cho mọi người?"
        onClose={() => {
          if (!state.retracting) setRetractId(null)
        }}
      >
        <CommunityMessage>
          Nội dung sẽ được thay bằng thông báo đã gỡ đối với mọi người trong
          cuộc trò chuyện.
        </CommunityMessage>
        <CommunityButton
          variant="quiet"
          label="Giữ lại"
          disabled={Boolean(state.retracting)}
          onPress={() => setRetractId(null)}
        />
        <CommunityButton
          variant="primary"
          label={
            state.retracting === retractId
              ? 'Đang gỡ tin nhắn…'
              : 'Xác nhận gỡ tin nhắn'
          }
          disabled={Boolean(state.retracting)}
          onPress={() => {
            if (!retractId) return
            void runtime.retract(retractId).then((succeeded) => {
              if (succeeded) setRetractId(null)
            })
          }}
        />
      </BottomSheet>
      <BottomSheet
        visible={Boolean(activeMessage(reportId))}
        title="Lý do báo cáo tin nhắn"
        onClose={() => setReportId(null)}
      >
        {reportReasons.map((reason) => (
          <ActionRow
            key={reason.code}
            icon="flag-outline"
            label={reason.label}
            disabled={action.busy || reportSent}
            onPress={() =>
              void action.run(async () => {
                if (!reportId) return
                await api.report(
                  reportId,
                  reason.code,
                  key({ reportId, reason: reason.code }),
                )
                setReportSent(true)
              })
            }
          />
        ))}
        {reportSent && (
          <CommunityMessage>
            Đã tiếp nhận báo cáo. Đây không phải kênh được giám sát khẩn cấp;
            không có cuộc gọi hay liên hệ tự động được thực hiện.
          </CommunityMessage>
        )}
        <CommunityButton
          variant="quiet"
          label="Đóng báo cáo"
          onPress={() => setReportId(null)}
        />
      </BottomSheet>
      <BottomSheet
        visible={clearConfirm && Boolean(value)}
        title="Xóa cuộc trò chuyện phía bạn?"
        onClose={() => {
          if (clearBusy) return
          clearAttempt.current = null
          setClearError(false)
          setClearConfirm(false)
        }}
      >
        <CommunityMessage>
          Cuộc trò chuyện và lịch sử hiện tại sẽ biến mất khỏi hộp thư của bạn.
          Những người khác vẫn giữ nguyên lịch sử. Khi có tin nhắn mới, cuộc trò
          chuyện sẽ xuất hiện lại và chỉ hiển thị tin nhắn mới.
        </CommunityMessage>
        {clearError && (
          <CommunityMessage>
            Chưa xác nhận đã xóa. Hội thoại vẫn được giữ trên màn hình; bạn có
            thể thử lại an toàn.
          </CommunityMessage>
        )}
        <CommunityButton
          variant="quiet"
          label="Giữ lại"
          disabled={clearBusy}
          onPress={() => {
            clearAttempt.current = null
            setClearError(false)
            setClearConfirm(false)
          }}
        />
        <CommunityButton
          variant="primary"
          label={clearBusy ? 'Đang xóa…' : 'Xác nhận xóa phía tôi'}
          disabled={clearBusy}
          onPress={() => void clearConversation()}
        />
      </BottomSheet>
      <BottomSheet
        visible={blocking && peer?.state === 'AVAILABLE'}
        onClose={() => setBlocking(false)}
      >
        <CommunityMessage>
          Chặn thành viên này? Quyền hiển thị hội thoại sẽ được kiểm tra lại.
        </CommunityMessage>
        <CommunityButton
          variant="primary"
          label="Xác nhận chặn thành viên"
          disabled={action.busy}
          onPress={() =>
            void action.run(async () => {
              if (peer?.state !== 'AVAILABLE') return
              await community.block(peer.communityProfileId)
              runtime.clear()
              setDraft('')
              onBack()
            })
          }
        />
        <CommunityButton
          variant="quiet"
          label="Hủy chặn thành viên"
          onPress={() => setBlocking(false)}
        />
      </BottomSheet>
      <BottomSheet visible={leaving} onClose={() => setLeaving(false)}>
        <CommunityMessage>
          Rời hội thoại sẽ bỏ bản nháp ở phiên này. Nếu lần gửi chưa được xác
          nhận, hãy ở lại và thử gửi lại để kiểm tra kết quả.
        </CommunityMessage>
        <CommunityButton
          variant="primary"
          label="Ở lại hội thoại"
          onPress={() => setLeaving(false)}
        />
        <CommunityButton
          variant="danger"
          label="Bỏ bản nháp và rời"
          onPress={onBack}
        />
      </BottomSheet>
    </ChatFrame>
  )
}
const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerText: { flex: 1, flexShrink: 1 },
  headerTitle: {
    color: communityColors.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  presence: { color: communityColors.inkSoft, fontSize: 12, lineHeight: 16 },
  pad: { gap: spacing.md, padding: spacing.md },
  stateWrap: {
    backgroundColor: communityColors.background,
    borderRadius: radii.panel,
    margin: spacing.md,
  },
  unread: {
    backgroundColor: communityColors.mint,
    borderRadius: 16,
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  unreadText: {
    color: communityColors.primaryDeep,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  list: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  day: { alignItems: 'center', marginVertical: 6 },
  dayText: { color: communityColors.inkSoft, fontSize: 12, lineHeight: 16 },
  line: { flexDirection: 'row', gap: spacing.xs },
  lineOwn: { justifyContent: 'flex-end' },
  runStart: { marginTop: 10 },
  grouped: { marginTop: 4 },
  avatarSlot: { alignSelf: 'flex-end', width: 28 },
  stack: { alignItems: 'flex-start', flexShrink: 1, maxWidth: '76%' },
  stackOwn: { alignItems: 'flex-end' },
  bubble: {
    borderRadius: radii.panel,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  own: {
    backgroundColor: communityColors.primaryDeep,
    borderBottomRightRadius: 6,
  },
  other: {
    backgroundColor: communityColors.background,
    borderBottomLeftRadius: 6,
  },
  retracted: {
    backgroundColor: 'transparent',
    borderColor: communityColors.line,
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  text: { color: communityColors.ink, fontSize: 14.5, lineHeight: 21 },
  sender: {
    color: communityColors.inkSoft,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 2,
    marginLeft: 4,
  },
  time: {
    color: communityColors.inkSoft,
    fontSize: 11.5,
    lineHeight: 16,
    marginHorizontal: 4,
    marginTop: 2,
  },
  failure: { gap: spacing.xs, marginTop: spacing.xs },
  skeleton: {
    backgroundColor: communityColors.background,
    borderRadius: radii.panel,
  },
  skeletonOwn: { alignItems: 'flex-end' },
  skeletonOther: { alignItems: 'flex-start' },
  footer: {
    backgroundColor: communityColors.background,
    borderTopColor: communityColors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputRow: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm },
  input: {
    backgroundColor: communityColors.soft,
    borderRadius: 22,
    color: communityColors.ink,
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    textAlignVertical: 'center',
  },
})
