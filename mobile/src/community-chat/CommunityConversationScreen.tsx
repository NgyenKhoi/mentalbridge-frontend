import { randomUUID } from 'expo-crypto'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { CommunityApi } from '@/community/community-api'
import { useCommandKey, useCommunityAction } from '@/community/community-ui'
import { colors, spacing } from '@/theme/tokens'
import type { CommunityChatApi } from './community-chat-api'
import { messageContentSchema } from './community-chat-contract'
import { CommunityChatSession } from './community-chat-session'
import type { CommunitySocketFactory } from './community-chat-socket'
import { CommunityGroupPanel } from './CommunityGroupPanel'
import {
  ChatButton,
  ChatHeading,
  ChatNotice,
  chatStyles as s,
  conversationName,
  peerName,
} from './community-chat-ui'

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
  const [reportId, setReportId] = useState<string | null>(null),
    [blocking, setBlocking] = useState(false)
  const [retractId, setRetractId] = useState<string | null>(null)
  const [reportSent, setReportSent] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)
  const [clearError, setClearError] = useState(false)
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
  const value = state.phase === 'ready' ? state.conversation?.value : undefined
  const peer =
    value?.kind === 'DIRECT'
      ? value.peers.find(
          (item) =>
            item.state === 'AVAILABLE' && item.communityProfileId !== ownId,
        )
      : undefined
  const send = async () => {
    setSaved(false)
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
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.column}
    >
      <ChatButton
        label="Về hộp trò chuyện"
        onPress={() => {
          if (draft || state.unconfirmed || state.sending) setLeaving(true)
          else onBack()
        }}
      />
      {leaving && (
        <View style={s.card}>
          <ChatNotice>
            Rời hội thoại sẽ bỏ bản nháp ở phiên này. Nếu lần gửi chưa được xác
            nhận, hãy ở lại và thử gửi lại để kiểm tra kết quả.
          </ChatNotice>
          <ChatButton
            label="Ở lại hội thoại"
            onPress={() => setLeaving(false)}
          />
          <ChatButton label="Bỏ bản nháp và rời" onPress={onBack} />
        </View>
      )}
      <ChatHeading>
        {value ? conversationName(value, ownId) : 'Trò chuyện cộng đồng'}
      </ChatHeading>
      {state.phase === 'checking' && (
        <ChatNotice>Đang xác nhận quyền và kết nối…</ChatNotice>
      )}
      {(state.phase === 'unavailable' || state.phase === 'paused') && (
        <>
          <ChatNotice>
            Chưa thể xác nhận kết nối hoặc quyền truy cập. Nội dung đã được ẩn.
            Bạn có thể thử kết nối lại khi ứng dụng đang mở.
          </ChatNotice>
          <ChatButton
            label="Kết nối lại"
            onPress={() => {
              if (AppState.currentState === 'active') void runtime.start()
            }}
          />
        </>
      )}
      {value && (
        <>
          {peer?.state === 'AVAILABLE' &&
            state.presence[peer.communityProfileId] === 'ONLINE' && (
              <Text style={s.muted}>Đang hoạt động</Text>
            )}
          {value.kind === 'GROUP' && (
            <ChatButton
              label="Thành viên và quản lý nhóm"
              onPress={() => setGroup(true)}
            />
          )}
          <ChatButton
            label="Xóa cuộc trò chuyện phía tôi"
            disabled={clearBusy}
            onPress={() => {
              clearAttempt.current = null
              setClearError(false)
              setClearConfirm(true)
            }}
          />
          {clearConfirm && (
            <View style={s.card} accessibilityRole="alert">
              <Text style={s.heading}>Xóa cuộc trò chuyện phía bạn?</Text>
              <ChatNotice>
                Cuộc trò chuyện và lịch sử hiện tại sẽ biến mất khỏi hộp thư của
                bạn. Những người khác vẫn giữ nguyên lịch sử. Khi có tin nhắn
                mới, cuộc trò chuyện sẽ xuất hiện lại và chỉ hiển thị tin nhắn
                mới.
              </ChatNotice>
              {clearError && (
                <ChatNotice>
                  Chưa xác nhận đã xóa. Hội thoại vẫn được giữ trên màn hình;
                  bạn có thể thử lại an toàn.
                </ChatNotice>
              )}
              <ChatButton
                label="Giữ lại"
                disabled={clearBusy}
                onPress={() => {
                  clearAttempt.current = null
                  setClearError(false)
                  setClearConfirm(false)
                }}
              />
              <ChatButton
                label={clearBusy ? 'Đang xóa…' : 'Xác nhận xóa phía tôi'}
                disabled={clearBusy}
                onPress={() => void clearConversation()}
              />
            </View>
          )}
          {value.state !== 'ACTIVE' && (
            <ChatNotice>
              Hội thoại chỉ đọc. Bạn không thể gửi thêm tin nhắn.
            </ChatNotice>
          )}
          <Text style={s.muted}>{`${value.unreadCount} tin chưa đọc`}</Text>
          {!state.messages.length && (
            <ChatNotice>
              Chưa có tin nhắn trong lịch sử bạn được xem.
            </ChatNotice>
          )}
          {state.messages.map((message) => {
            const mine =
              message.sender.state === 'AVAILABLE' &&
              message.sender.communityProfileId === ownId
            return (
              <View
                key={message.messageId}
                style={[
                  styles.message,
                  mine && styles.own,
                  message.state === 'RETRACTED' && styles.retracted,
                ]}
                testID="community-chat-message"
              >
                <Text style={s.heading}>{peerName(message.sender)}</Text>
                <Text
                  selectable={message.state === 'ACTIVE'}
                  style={[
                    s.body,
                    message.state === 'RETRACTED' && styles.retractedText,
                  ]}
                >
                  {message.state === 'ACTIVE'
                    ? message.content
                    : mine
                      ? 'Bạn đã gỡ tin nhắn'
                      : message.sender.state === 'AVAILABLE'
                        ? `${message.sender.displayName} đã gỡ tin nhắn`
                        : 'Tin nhắn đã được gỡ'}
                </Text>
                <Text style={s.muted}>
                  {new Date(message.createdAt).toLocaleString('vi-VN')}
                </Text>
                {message.state === 'ACTIVE' &&
                  (mine ? (
                    <ChatButton
                      label={
                        state.retracting === message.messageId
                          ? 'Đang gỡ tin nhắn…'
                          : 'Gỡ tin nhắn'
                      }
                      disabled={Boolean(state.retracting)}
                      onPress={() => setRetractId(message.messageId)}
                    />
                  ) : (
                    <ChatButton
                      label={`Báo cáo tin nhắn của ${peerName(message.sender)}`}
                      onPress={() => {
                        setReportId(message.messageId)
                        setReportSent(false)
                      }}
                    />
                  ))}
                {state.retractionIssue?.messageId === message.messageId && (
                  <View style={styles.retractError}>
                    <ChatNotice>
                      Chưa thể gỡ tin nhắn lúc này. Nội dung vẫn được giữ
                      nguyên.
                    </ChatNotice>
                    <ChatButton
                      label="Thử lại gỡ tin nhắn"
                      disabled={Boolean(state.retracting)}
                      onPress={() => void runtime.retract(message.messageId)}
                    />
                  </View>
                )}
              </View>
            )
          })}
          {retractId &&
            state.messages.some(
              (message) =>
                message.messageId === retractId && message.state === 'ACTIVE',
            ) && (
              <View style={s.card} accessibilityRole="alert">
                <Text style={s.heading}>Gỡ tin nhắn cho mọi người?</Text>
                <ChatNotice>
                  Nội dung sẽ được thay bằng thông báo đã gỡ đối với mọi người
                  trong cuộc trò chuyện.
                </ChatNotice>
                <ChatButton
                  label="Giữ lại"
                  disabled={Boolean(state.retracting)}
                  onPress={() => setRetractId(null)}
                />
                <ChatButton
                  label={
                    state.retracting === retractId
                      ? 'Đang gỡ tin nhắn…'
                      : 'Xác nhận gỡ tin nhắn'
                  }
                  disabled={Boolean(state.retracting)}
                  onPress={() => {
                    void runtime.retract(retractId).then((succeeded) => {
                      if (succeeded) setRetractId(null)
                    })
                  }}
                />
              </View>
            )}
          {state.nextCursor && (
            <ChatButton
              label="Xem tiếp tin nhắn"
              onPress={() => void runtime.more()}
            />
          )}
          {state.messages.length > 0 && (
            <ChatButton
              label="Đánh dấu phần đã xem là đã đọc"
              onPress={() => void runtime.markRead()}
            />
          )}
          {saved && (
            <ChatNotice>
              Tin nhắn đã được lưu. Chưa có xác nhận người nhận đã nhận hoặc
              đọc. Chọn “Xem tiếp tin nhắn” nếu lịch sử còn trang sau.
            </ChatNotice>
          )}
          {state.unconfirmed && (
            <ChatNotice>
              Chưa xác nhận tin nhắn đã được lưu. Bản nháp được giữ ở phiên này;
              thử lại sẽ dùng cùng mã gửi để tránh trùng.
            </ChatNotice>
          )}
          {state.issue && (
            <ChatNotice>
              Yêu cầu chưa hoàn tất. Kiểm tra kết nối và thử lại.
            </ChatNotice>
          )}
          {value.state === 'ACTIVE' && (
            <View style={s.column}>
              <Text style={s.heading}>Tin nhắn</Text>
              <TextInput
                testID="community-chat-composer"
                accessibilityLabel="Nội dung tin nhắn cộng đồng"
                value={draft}
                onChangeText={setDraft}
                multiline
                editable={!state.sending && !state.unconfirmed}
                style={s.input}
              />
              <Text
                style={s.muted}
              >{`${[...draft].length}/4000 ký tự · Nội dung văn bản thuần`}</Text>
              <ChatButton
                label={
                  state.unconfirmed ? 'Thử gửi lại tin nhắn' : 'Gửi tin nhắn'
                }
                disabled={
                  state.sending ||
                  !messageContentSchema.safeParse(draft).success
                }
                onPress={() => void action.run(send)}
              />
            </View>
          )}
          {peer?.state === 'AVAILABLE' && (
            <ChatButton
              testID="community-chat-send"
              label="Chặn thành viên này"
              disabled={action.busy}
              onPress={() => setBlocking(true)}
            />
          )}
          {blocking && peer?.state === 'AVAILABLE' && (
            <View style={s.card}>
              <ChatNotice>
                Chặn thành viên này? Quyền hiển thị hội thoại sẽ được kiểm tra
                lại.
              </ChatNotice>
              <ChatButton
                label="Xác nhận chặn thành viên"
                disabled={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    await community.block(peer.communityProfileId)
                    runtime.clear()
                    setDraft('')
                    onBack()
                  })
                }
              />
              <ChatButton
                label="Hủy chặn thành viên"
                onPress={() => setBlocking(false)}
              />
            </View>
          )}
          {reportId &&
            state.messages.some(
              (message) =>
                message.messageId === reportId && message.state === 'ACTIVE',
            ) && (
              <View style={s.card}>
                <Text style={s.heading}>Lý do báo cáo tin nhắn</Text>
                {(
                  [
                    { code: 'HARASSMENT', label: 'Quấy rối' },
                    { code: 'SPAM', label: 'Tin rác' },
                    { code: 'PRIVACY_CONCERN', label: 'Quyền riêng tư' },
                    {
                      code: 'SELF_HARM_OR_CRISIS_CONCERN',
                      label: 'Lo ngại tự hại hoặc khủng hoảng',
                    },
                    { code: 'OTHER', label: 'Lý do khác' },
                  ] as const
                ).map((reason) => (
                  <ChatButton
                    key={reason.code}
                    label={reason.label}
                    disabled={action.busy || reportSent}
                    onPress={() =>
                      void action.run(async () => {
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
                  <ChatNotice>
                    Đã tiếp nhận báo cáo. Đây không phải kênh được giám sát khẩn
                    cấp; không có cuộc gọi hay liên hệ tự động được thực hiện.
                  </ChatNotice>
                )}
                <ChatButton
                  label="Đóng báo cáo"
                  onPress={() => setReportId(null)}
                />
              </View>
            )}
          {action.error && <ChatNotice>{action.error}</ChatNotice>}
        </>
      )}
    </KeyboardAvoidingView>
  )
}
const styles = StyleSheet.create({
  message: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  own: { backgroundColor: colors.tealPale },
  retracted: {
    backgroundColor: colors.surfaceSoft,
    borderStyle: 'dashed',
  },
  retractedText: { color: colors.inkSoft, fontStyle: 'italic' },
  retractError: { gap: spacing.sm },
})
