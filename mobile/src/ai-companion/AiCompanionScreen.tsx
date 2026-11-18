import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { router } from 'expo-router'
import { useContext, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ApiError } from '@/api/api-error'
import { PrimaryButton } from '@/components/PrimaryButton'
import { CrisisSupportOffsetContext } from '@/crisis-support/crisis-support-offset'
import type { JournalApi } from '@/journal/journal-api'
import { colors, radii, spacing } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'

import type {
  CompanionConversation,
  CompanionSuggestion,
  createCompanionApi,
} from './companion-api'

type ChatMessage = CompanionConversation['messages'][number]
type Turn = { id: string; text: string; key: string }
const starters = ['Hướng dẫn mình thở chậm', 'Mình cần ai đó lắng nghe']
const clock = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})
const paper = '#F4F8F5'
const forest = '#174A3F'
const mint = '#D9F1E7'

function showSuggestion(suggestion: CompanionSuggestion) {
  switch (suggestion.destination) {
    case 'RESOURCE':
      if (suggestion.resourceId)
        router.push({
          pathname: '/(user)/resources/[resourceId]',
          params: { resourceId: suggestion.resourceId },
        })
      break
    case 'RESOURCE_LIBRARY':
      router.push('/(user)/resources')
      break
    case 'JOURNAL':
      router.push('/(user)/journal')
      break
    case 'EMOTION_CHECK_IN':
      router.push('/(user)/emotion')
      break
    case 'SUPPORT_PLAN':
      router.push('/(user)/support-plan')
      break
    case 'SPECIALIST_DISCOVERY':
      router.push('/(user)/specialists')
      break
  }
}
const destinationLabels: Record<CompanionSuggestion['destination'], string> = {
  RESOURCE: 'Mở bài tập',
  RESOURCE_LIBRARY: 'Kho tài nguyên',
  JOURNAL: 'Ghi nhật ký',
  EMOTION_CHECK_IN: 'Ghi nhận cảm xúc',
  SUPPORT_PLAN: 'Xem kế hoạch',
  SPECIALIST_DISCOVERY: 'Tìm chuyên gia',
}

function sendError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'AI_CONSENT_REQUIRED')
      return 'Bạn cần đồng ý xử lý bằng AI để gửi tin nhắn.'
    if (error.status === 401)
      return 'Chưa xác minh được phiên. Thử lại sau khi kết nối ổn định.'
    if (error.status === 429)
      return 'Bạn đã chạm giới hạn trò chuyện. Vui lòng thử lại sau.'
  }
  return 'Chưa nhận được phản hồi. Bạn có thể thử gửi lại.'
}

export function AiCompanionScreen({
  subject,
  api,
  consentApi,
}: Readonly<{
  subject: string
  api: ReturnType<typeof createCompanionApi>
  consentApi: Pick<JournalApi, 'authorization' | 'disclosure' | 'consent'>
}>) {
  const client = useQueryClient()
  const fonts = useDashboardFonts()
  const sans = fonts ? s.sans : undefined
  const serif = fonts ? s.serif : s.serifFallback
  const setCrisisOffset = useContext(CrisisSupportOffsetContext)
  useEffect(() => () => setCrisisOffset(0), [setCrisisOffset])
  const [selected, setSelected] = useState<string | null>(null)
  const [startNew, setStartNew] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [pendingTurn, setPendingTurn] = useState<Turn | null>(null)
  const [notice, setNotice] = useState('')
  const [consentRequired, setConsentRequired] = useState(false)
  const listRef = useRef<FlatList<ChatMessage>>(null)
  const sending = useRef(false)
  const listKey = ['ai-companion', subject, 'history'] as const
  const history = useQuery({
    queryKey: listKey,
    queryFn: api.list,
    gcTime: 0,
    retry: false,
  })
  const id =
    selected ?? (startNew ? null : (history.data?.[0]?.conversationId ?? null))
  const detailKey = ['ai-companion', subject, 'conversation', id] as const
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: () => api.detail(id!),
    enabled: Boolean(id),
    gcTime: 0,
    retry: false,
  })
  const authorization = useQuery({
    queryKey: ['ai-companion', subject, 'authorization'],
    queryFn: consentApi.authorization,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always',
  })
  const mustConsent =
    consentRequired || authorization.data?.authorized === false
  const disclosure = useQuery({
    queryKey: ['ai-companion', subject, 'disclosure'],
    queryFn: consentApi.disclosure,
    enabled: mustConsent,
    retry: false,
  })
  const policy = disclosure.data
  const consent = useMutation({
    mutationFn: (version: Parameters<JournalApi['consent']>[0]) =>
      consentApi.consent(version, true, randomUUID()),
    onSuccess: async () => {
      const result = await authorization.refetch()
      if (!result.data?.authorized) return
      setConsentRequired(false)
      setNotice('')
    },
    onError: () =>
      setNotice('Chưa lưu được lựa chọn đồng ý. Vui lòng thử lại.'),
  })
  const send = useMutation({
    mutationFn: (turn: Turn) => api.send(turn.id, turn.text, turn.key),
    onSuccess: (reply, turn) => {
      const key = ['ai-companion', subject, 'conversation', turn.id]
      client.setQueryData<CompanionConversation>(key, (current) => {
        if (
          !current ||
          current.messages.some(
            (item) => item.messageId === reply.assistantMessageId,
          )
        )
          return current
        return {
          ...current,
          messages: [
            ...current.messages,
            {
              messageId: reply.userMessageId,
              role: 'USER',
              content: turn.text,
              createdAt: reply.createdAt,
            },
            {
              messageId: reply.assistantMessageId,
              role: 'ASSISTANT',
              content: reply.assistant,
              createdAt: reply.createdAt,
              suggestion: reply.suggestion ?? null,
            },
          ],
        }
      })
      void client.invalidateQueries({ queryKey: key })
      setDraft('')
      setPendingTurn(null)
      void client.invalidateQueries({ queryKey: listKey })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'AI_CONSENT_REQUIRED') {
        setConsentRequired(true)
        void authorization.refetch()
      }
      if (
        error instanceof ApiError &&
        error.status &&
        error.status < 500 &&
        error.status !== 409
      )
        setPendingTurn(null)
      setNotice(sendError(error))
    },
  })
  const [creating, setCreating] = useState(false)
  const locked = creating || send.isPending
  const blocked =
    locked ||
    mustConsent ||
    !authorization.data?.authorized ||
    authorization.isError ||
    history.isPending ||
    history.isError ||
    Boolean(id && (!detail.data || detail.isError))
  const sendDraft = async () => {
    const text = draft.trim()
    if (!text || blocked || sending.current) return
    sending.current = true
    setNotice('')
    try {
      let conversationId = id
      if (!conversationId) {
        setCreating(true)
        const created = await api.create()
        conversationId = created.conversationId
        client.setQueryData(
          ['ai-companion', subject, 'conversation', conversationId],
          created,
        )
        setCreating(false)
      }
      setSelected(conversationId)
      const turn = pendingTurn ?? {
        id: conversationId,
        text,
        key: randomUUID(),
      }
      setPendingTurn(turn)
      await send.mutateAsync(turn).catch(() => undefined)
    } catch {
      setNotice('Chưa mở được cuộc trò chuyện. Vui lòng thử lại.')
      void history.refetch()
    } finally {
      sending.current = false
      setCreating(false)
    }
  }
  const openConversation = (conversationId: string | null) => {
    if (locked || pendingTurn || draft.trim()) return
    setSelected(conversationId)
    setStartNew(conversationId === null)
    setHistoryOpen(false)
    setNotice('')
  }
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.column}>
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={() => router.back()}
            style={s.round}
          >
            <Text style={s.icon}>‹</Text>
          </Pressable>
          <View style={s.flex}>
            <Text accessibilityRole="header" style={[s.title, serif]}>
              AI Companion
            </Text>
            <Text style={[s.meta, sans]}>Trò chuyện hỗ trợ cùng AI</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lịch sử trò chuyện"
            accessibilityState={{ expanded: historyOpen }}
            onPress={() => setHistoryOpen((value) => !value)}
            style={s.round}
          >
            <Text style={s.icon}>≡</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Nhật ký"
            onPress={() => router.push('/(user)/journal')}
            style={s.round}
          >
            <Text style={s.icon}>✎</Text>
          </Pressable>
        </View>
        <View style={s.companion}>
          <Text style={s.avatar}>❧</Text>
          <View style={s.flex}>
            <Text style={[s.name, sans]}>An Yên • AI Companion</Text>
            <Text style={[s.meta, sans]}>
              {locked ? 'Đang xử lý tin nhắn…' : 'Không gian chia sẻ riêng tư'}
            </Text>
          </View>
        </View>
        <FlatList
          ref={listRef}
          data={historyOpen ? [] : (detail.data?.messages ?? [])}
          keyExtractor={({ messageId }) => messageId}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.messages}
          onContentSizeChange={() => {
            if (!historyOpen && !mustConsent)
              listRef.current?.scrollToEnd({ animated: false })
          }}
          ListHeaderComponent={
            <>
              {historyOpen ? (
                <View style={s.panel}>
                  <Text style={[s.name, sans]}>Các cuộc trò chuyện</Text>
                  {draft.trim() && (
                    <Text style={[s.meta, sans]}>
                      Gửi hoặc xóa nội dung đang soạn trước khi đổi cuộc trò
                      chuyện.
                    </Text>
                  )}
                  <PrimaryButton
                    tone="dashboard"
                    label="Cuộc trò chuyện mới"
                    disabled={
                      Boolean(draft.trim()) || locked || Boolean(pendingTurn)
                    }
                    onPress={() => openConversation(null)}
                  />
                  {history.data?.map((item) => (
                    <Pressable
                      key={item.conversationId}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: item.conversationId === id,
                      }}
                      disabled={
                        Boolean(draft.trim()) || locked || Boolean(pendingTurn)
                      }
                      style={s.historyItem}
                      onPress={() => openConversation(item.conversationId)}
                    >
                      <Text style={[s.body, sans]} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <>
                  <Text style={[s.privacy, sans]}>
                    Không gian chia sẻ • Chỉ hiển thị trong tài khoản của bạn
                  </Text>
                  {detail.data && (
                    <Text style={[s.date, sans]}>
                      {new Date(detail.data.createdAt).toLocaleDateString(
                        'vi-VN',
                        { timeZone: 'Asia/Ho_Chi_Minh' },
                      )}{' '}
                      · Phiên trò chuyện riêng tư
                    </Text>
                  )}
                  {history.isPending || (id && detail.isPending) ? (
                    <ActivityIndicator
                      accessibilityLabel="Đang tải cuộc trò chuyện"
                      color={forest}
                    />
                  ) : null}
                  {history.isError || detail.isError ? (
                    <View style={s.panel}>
                      <Text style={[s.body, sans]}>
                        Chưa tải được cuộc trò chuyện.
                      </Text>
                      <PrimaryButton
                        label="Thử lại"
                        onPress={() =>
                          void (history.isError
                            ? history.refetch()
                            : detail.refetch())
                        }
                      />
                    </View>
                  ) : null}
                  {!history.isPending &&
                    !history.isError &&
                    !detail.isError &&
                    (!id || detail.data?.messages.length === 0) && (
                      <View style={s.assistantRow}>
                        <Text style={s.avatarSmall}>❧</Text>
                        <View style={s.assistantColumn}>
                          <Text style={[s.meta, sans]}>An Yên</Text>
                          <View style={s.assistantBubble}>
                            <Text style={[s.body, sans]}>
                              Chào bạn, mình ở đây để lắng nghe. Bạn muốn chia
                              sẻ điều gì hôm nay?
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                </>
              )}
            </>
          }
          renderItem={({ item }) => {
            const user = item.role === 'USER'
            const suggestion = item.suggestion
            const destination =
              suggestion &&
              (suggestion.destination !== 'RESOURCE' || suggestion.resourceId)
            return (
              <View style={user ? s.userRow : s.assistantRow}>
                {!user && <Text style={s.avatarSmall}>❧</Text>}
                <View style={user ? s.userColumn : s.assistantColumn}>
                  {!user && <Text style={[s.meta, sans]}>An Yên</Text>}
                  <View style={user ? s.userBubble : s.assistantBubble}>
                    <Text style={[s.body, sans, user && s.white]}>
                      {item.content}
                    </Text>
                    {!user && suggestion && destination && (
                      <Pressable
                        accessibilityRole="link"
                        style={s.suggestion}
                        onPress={() => showSuggestion(suggestion)}
                      >
                        <Text style={[s.meta, sans]}>
                          Gợi ý từ cuộc trò chuyện
                        </Text>
                        <Text style={[s.name, sans]}>
                          {suggestion.resourceTitle ??
                            destinationLabels[suggestion.destination]}{' '}
                          →
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <Text style={[s.meta, sans, user && s.right]}>
                    {clock.format(new Date(item.createdAt))}
                  </Text>
                </View>
              </View>
            )
          }}
          ListFooterComponent={
            !historyOpen ? (
              <View style={s.messages}>
                {pendingTurn && locked && (
                  <View style={s.userRow}>
                    <View style={[s.userColumn, s.userBubble]}>
                      <Text style={[s.body, sans, s.white]}>
                        {pendingTurn.text}
                      </Text>
                    </View>
                  </View>
                )}
                {locked && (
                  <Text accessibilityLiveRegion="polite" style={[s.date, sans]}>
                    ● ● ● An Yên đang soạn phản hồi…
                  </Text>
                )}
                {mustConsent && (
                  <View style={s.panel}>
                    <Text style={[s.name, sans]}>
                      {policy?.title ?? 'Đồng ý xử lý bằng AI'}
                    </Text>
                    {policy ? (
                      <>
                        <Text style={[s.body, sans]}>{policy.content}</Text>
                        <PrimaryButton
                          tone="dashboard"
                          label={
                            consent.isPending
                              ? 'Đang lưu…'
                              : 'Đồng ý xử lý bằng AI'
                          }
                          disabled={consent.isPending}
                          onPress={() => consent.mutate(policy.version)}
                        />
                      </>
                    ) : disclosure.isError ? (
                      <PrimaryButton
                        label="Tải lại thông tin đồng ý"
                        onPress={() => void disclosure.refetch()}
                      />
                    ) : (
                      <ActivityIndicator
                        color={forest}
                        accessibilityLabel="Đang tải thông tin đồng ý"
                      />
                    )}
                  </View>
                )}
                {authorization.isError && (
                  <PrimaryButton
                    label="Kiểm tra lại quyền trò chuyện"
                    onPress={() => void authorization.refetch()}
                  />
                )}
                {notice && (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[s.error, sans]}
                  >
                    {notice}
                  </Text>
                )}
              </View>
            ) : null
          }
        />
        {!historyOpen && (
          <View
            style={s.composerArea}
            onLayout={({ nativeEvent }) =>
              setCrisisOffset(nativeEvent.layout.height)
            }
          >
            {!draft && !mustConsent && (
              <View style={s.starters}>
                {starters.map((starter) => (
                  <Pressable
                    key={starter}
                    accessibilityRole="button"
                    disabled={locked}
                    style={s.starter}
                    onPress={() => setDraft(starter)}
                  >
                    <Text style={[s.meta, sans]} numberOfLines={2}>
                      {starter}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={s.composer}>
              <TextInput
                accessibilityLabel="Chia sẻ với AI Companion"
                multiline
                placeholder="Chia sẻ với AI Companion..."
                placeholderTextColor={colors.inkSoft}
                maxLength={2000}
                value={draft}
                editable={!locked && !pendingTurn}
                onChangeText={setDraft}
                style={[s.input, sans]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  pendingTurn ? 'Thử gửi lại' : 'Gửi tin nhắn'
                }
                accessibilityState={{ disabled: blocked || !draft.trim() }}
                disabled={blocked || !draft.trim()}
                onPress={() => void sendDraft()}
                style={[s.send, (blocked || !draft.trim()) && s.disabled]}
              >
                <Text style={[s.icon, s.white]}>
                  {pendingTurn && !locked ? '↻' : '↑'}
                </Text>
              </Pressable>
            </View>
            <Text style={[s.footer, sans]}>
              AI Companion hỗ trợ tự chăm sóc và không thay thế chuyên gia.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: paper },
  column: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' },
  flex: { flex: 1, minWidth: 0 },
  sans: { fontFamily: 'DashboardSans' },
  serif: { fontFamily: 'DashboardSerif' },
  serifFallback: { fontFamily: 'serif' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  title: { color: forest, fontSize: 22, fontWeight: '700' },
  round: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 23, color: forest, fontWeight: '700' },
  companion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: '#ECF2EF',
  },
  avatar: {
    color: forest,
    backgroundColor: mint,
    borderRadius: radii.pill,
    overflow: 'hidden',
    width: 42,
    lineHeight: 42,
    textAlign: 'center',
    fontSize: 24,
  },
  avatarSmall: {
    color: forest,
    backgroundColor: mint,
    width: 30,
    lineHeight: 30,
    textAlign: 'center',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  name: { color: forest, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.inkSoft, fontSize: 12, lineHeight: 17 },
  body: { color: colors.ink, fontSize: 14, lineHeight: 23 },
  privacy: {
    borderRadius: radii.control,
    overflow: 'hidden',
    padding: spacing.sm,
    backgroundColor: '#E8EFEB',
    color: colors.inkSoft,
    fontSize: 12,
    textAlign: 'center',
  },
  date: {
    alignSelf: 'center',
    color: colors.inkSoft,
    fontSize: 11,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: '#E8EFEB',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  messages: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  assistantColumn: { flex: 1, gap: spacing.xs, marginRight: spacing.lg },
  assistantBubble: {
    backgroundColor: '#E2EEE8',
    padding: spacing.md,
    borderRadius: radii.panel,
    borderTopLeftRadius: spacing.xs,
    gap: spacing.md,
  },
  userRow: { alignItems: 'flex-end' },
  userColumn: { maxWidth: '88%', gap: spacing.xs },
  userBubble: {
    backgroundColor: forest,
    padding: spacing.md,
    borderRadius: radii.panel,
    borderBottomRightRadius: spacing.xs,
  },
  white: { color: colors.white },
  right: { textAlign: 'right' },
  suggestion: {
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    padding: spacing.md,
    minHeight: 44,
  },
  panel: {
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
  },
  historyItem: { paddingVertical: spacing.sm, minHeight: 44 },
  composerArea: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: paper,
  },
  composer: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    borderColor: colors.line,
    borderWidth: 1,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    color: colors.ink,
    padding: spacing.sm,
    fontSize: 14,
  },
  send: {
    minWidth: 44,
    height: 44,
    backgroundColor: forest,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.48 },
  starters: { flexDirection: 'row', gap: spacing.sm },
  starter: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  footer: { color: colors.inkSoft, fontSize: 11, textAlign: 'center' },
  error: { color: '#923E33', fontSize: 13 },
})
