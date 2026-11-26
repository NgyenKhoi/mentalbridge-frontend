import { useMutation, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { router } from 'expo-router'
import { PrimaryButton } from '@/components/PrimaryButton'
import { CrisisSupportOffsetContext } from '@/crisis-support/crisis-support-offset'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'

import { JournalAnalysisPanel } from './JournalAnalysisPanel'
import type { JournalApi } from './journal-api'
import {
  journalWriteSchema,
  type JournalCreate,
  type JournalEntry,
  type JournalMood,
  type JournalSummary,
  type JournalWrite,
} from './journal-contract'
import { journalError, Notice, TextAction } from './journal-ui'

const moods: readonly {
  value: JournalMood
  label: string
  icon: string
  tint: string
}[] = [
  { value: 'GREAT', label: 'Rất tốt', icon: '🥰', tint: '#FAEEEE' },
  { value: 'GOOD', label: 'Tốt', icon: '😊', tint: '#FAF6E5' },
  { value: 'OKAY', label: 'Bình thường', icon: '🙂', tint: '#EEF6F0' },
  { value: 'LOW', label: 'Không tốt', icon: '🥺', tint: '#EFF4F9' },
  { value: 'VERY_LOW', label: 'Rất không tốt', icon: '😫', tint: '#F6F1F9' },
]
const prompts = [
  'Điều gì đang ở lại trong tâm trí bạn lúc này?',
  'Hôm nay có điều gì bình thường nhưng bạn thấy dễ chịu không?',
  'Có việc gì đang chiếm nhiều suy nghĩ của bạn trong ngày hôm nay?',
  'Bạn muốn dành một lời tử tế nào cho chính mình?',
  'Điều gì đã khiến bạn mỉm cười hoặc cảm thấy biết ơn hôm nay?',
  'Bạn muốn dành một khoảnh khắc tĩnh lặng này để ghi nhận điều gì?',
] as const
const topics = [
  'Công việc',
  'Gia đình',
  'Học tập',
  'Mối quan hệ',
  'Sức khỏe',
  'Giấc ngủ',
]
const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
})
const splitTags = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
const draftOf = (entry?: JournalEntry) => ({
  text: entry?.content.text ?? '',
  mood: entry?.mood ?? null,
  tags: entry?.tags.join(', ') ?? '',
})
type SaveAttempt = {
  key: string
  body: JournalCreate | JournalWrite
  entry: JournalEntry | undefined
}
export type JournalNavigationState = Readonly<{
  dirty: boolean
  busy: boolean
  uncertain: boolean
}>

export function JournalEditor({
  api,
  subject,
  initialEntry,
  previousEntry,
  now = () => new Date(),
  header,
  staleEntry = false,
  onClose,
  onDirtyChange,
  onCreated,
  onSaved,
  onNavigationStateChange,
}: Readonly<{
  api: JournalApi
  subject: string
  initialEntry?: JournalEntry
  previousEntry?: JournalSummary
  now?: () => Date
  header?: ReactNode
  staleEntry?: boolean
  onClose: () => void
  onDirtyChange: (dirty: boolean) => void
  onCreated?: (journalId: string) => void
  onSaved?: () => void
  onNavigationStateChange?: (state: JournalNavigationState) => void
}>) {
  const client = useQueryClient()
  const [entry, setEntry] = useState(initialEntry)
  const [draft, setDraft] = useState(() => draftOf(initialEntry))
  const fonts = useDashboardFonts()
  const setCrisisOffset = useContext(CrisisSupportOffsetContext)
  useEffect(() => () => setCrisisOffset(0), [setCrisisOffset])
  const [promptStart, setPromptStart] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const attempt = useRef<SaveAttempt | null>(null)
  const deleteKey = useRef<string | null>(null)
  const original = draftOf(entry)
  const newerSource = Boolean(
    entry &&
    initialEntry?.id === entry.id &&
    initialEntry.currentRevision > entry.currentRevision,
  )
  const dirty =
    draft.text !== original.text ||
    draft.mood !== original.mood ||
    draft.tags !== original.tags
  const parsed = journalWriteSchema.safeParse({
    content: { text: draft.text },
    mood: draft.mood,
    tags:
      entry && draft.tags === original.tags
        ? entry.tags
        : splitTags(draft.tags),
  })
  useEffect(() => {
    onDirtyChange(dirty || uncertain)
    return () => onDirtyChange(false)
  }, [dirty, uncertain, onDirtyChange])
  const refresh = () =>
    client.invalidateQueries({ queryKey: ['journal', subject, 'list'] })
  const save = useMutation({
    mutationFn: async () => {
      if (!attempt.current) {
        if (!parsed.success) throw new Error('Incomplete Journal draft')
        attempt.current = {
          key: randomUUID(),
          entry,
          body: entry
            ? parsed.data
            : {
                ...parsed.data,
                clientEntryId: randomUUID(),
                occurredAt: new Date().toISOString(),
              },
        }
      }
      const request = attempt.current
      return request.entry
        ? api.revise(
            request.entry.id,
            request.entry.currentRevision,
            request.body,
            request.key,
          )
        : api.create(request.body as JournalCreate, request.key)
    },
    onSuccess: async (saved) => {
      const created =
        attempt.current?.entry === undefined && attempt.current !== null
      setEntry(saved)
      setDraft(draftOf(saved))
      attempt.current = null
      setUncertain(false)
      setConflict(false)
      setNotice('Đã lưu nhật ký.')
      if (created) onCreated?.(saved.id)
      client.setQueryData(['journal', subject, 'detail', saved.id], saved)
      await refresh()
      onSaved?.()
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 412)
      ) {
        attempt.current = null
        setUncertain(false)
        setConflict(true)
        setNotice(
          'Bài viết đã thay đổi ở nơi khác. Nội dung bạn đang viết được giữ lại; cần xem bản mới nhất trước khi lưu tiếp.',
        )
      } else if (
        error instanceof ApiError &&
        error.status &&
        error.status < 500
      ) {
        attempt.current = null
        setUncertain(false)
        setNotice(journalError(error))
      } else {
        setUncertain(true)
        setNotice(
          'Chưa xác nhận được lần lưu vừa rồi. Thử lưu lại để kiểm tra cùng yêu cầu, không tạo bài trùng.',
        )
      }
    },
  })
  const reload = useMutation({
    mutationFn: () => api.detail(entry!.id),
    onSuccess: (latest) => {
      setEntry(latest)
      setDraft(draftOf(latest))
      setConflict(false)
      setNotice('Đã mở bản mới nhất. Bạn có thể tiếp tục chỉnh sửa.')
    },
    onError: (error) => setNotice(journalError(error)),
  })
  const remove = useMutation({
    mutationFn: () => {
      deleteKey.current ??= randomUUID()
      return api.remove(entry!.id, deleteKey.current)
    },
    onSuccess: async () => {
      client.removeQueries({
        queryKey: ['journal', subject, 'detail', entry!.id],
      })
      await refresh()
      onClose()
    },
    onError: (error) => setNotice(journalError(error)),
  })
  const busy = save.isPending || remove.isPending || reload.isPending
  useEffect(() => {
    onNavigationStateChange?.({ dirty, busy, uncertain })
    return () =>
      onNavigationStateChange?.({ dirty: false, busy: false, uncertain: false })
  }, [dirty, busy, uncertain, onNavigationStateChange])
  const locked = busy || uncertain
  const close = () => {
    if (busy) return
    if (!dirty && !uncertain) return onClose()
    Alert.alert(
      'Rời bài viết?',
      uncertain
        ? 'Lần lưu vừa rồi chưa được xác nhận. Bạn có thể quay lại danh sách để kiểm tra.'
        : 'Phần chưa lưu sẽ mất khi rời màn hình.',
      [
        { text: 'Tiếp tục viết', style: 'cancel' },
        { text: 'Rời bài viết', style: 'destructive', onPress: onClose },
      ],
    )
  }
  const sans = fonts ? e.sans : undefined
  const serif = fonts ? e.serif : e.serifFallback
  const tags = splitTags(draft.tags)
  const selectedTags = tags.map((tag) => tag.toLocaleLowerCase('vi'))
  const setText = (text: string) => {
    setDraft((value) => ({ ...value, text }))
    setNotice(null)
  }
  const insertPrompt = (prompt: string) => {
    if (draft.text.split('\n').includes(prompt)) return
    const next = draft.text.trimEnd()
      ? draft.text.trimEnd() + '\n\n' + prompt
      : prompt
    if (next.length <= 12000) setText(next)
  }
  const bottomActions = (
    <View
      style={e.actionBar}
      onLayout={({ nativeEvent }) => setCrisisOffset(nativeEvent.layout.height)}
    >
      <View style={e.actionContent}>
        <Pressable
          testID="journal-editor-back"
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={close}
          style={({ pressed }) => [e.cancel, pressed && e.pressed]}
        >
          <Text style={[e.cancelLabel, sans]}>Hủy bỏ</Text>
        </Pressable>
        <View style={e.grow}>
          <PrimaryButton
            testID="journal-save"
            tone="dashboard"
            labelStyle={[e.ctaText, sans]}
            label={
              save.isPending
                ? 'Đang lưu…'
                : uncertain
                  ? 'Thử lưu lại'
                  : 'Lưu nhật ký'
            }
            disabled={
              busy ||
              conflict ||
              newerSource ||
              !parsed.success ||
              (!dirty && !uncertain)
            }
            onPress={() => {
              // Lock parent/native navigation in the same event as submission,
              // rather than waiting for mutation state to reach an effect.
              onNavigationStateChange?.({ dirty, busy: true, uncertain })
              save.mutate()
            }}
          />
        </View>
      </View>
    </View>
  )
  return (
    <Screen
      layout="dashboard"
      backgroundColor="#F7FAF8"
      bottomActions={bottomActions}
    >
      <View style={e.stack}>
        <View style={e.brandRow}>
          <View style={e.grow}>
            <Text style={[e.brand, serif]}>MentalBridge</Text>
            <Text style={[e.meta, sans]}>
              Không gian viết tĩnh lặng &amp; bảo mật
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thông báo"
            onPress={() => router.push('/(user)/notifications')}
            style={e.iconButton}
          >
            <Text style={e.heading}>♧</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cá nhân"
            onPress={() => router.push('/(user)/profile')}
            style={e.iconButton}
          >
            <Text style={e.heading}>◎</Text>
          </Pressable>
        </View>
        {header}
        {staleEntry && (
          <Notice error>
            Chưa làm mới được bài viết. Lần lưu tiếp theo sẽ kiểm tra bản đã
            tải.
          </Notice>
        )}
        <View style={e.card}>
          <View style={e.row}>
            <View style={e.grow}>
              <Text style={[e.kicker, sans]}>Nhật ký riêng tư</Text>
              <Text accessibilityRole="header" style={[e.title, serif]}>
                {initialEntry ? 'Chỉnh sửa nhật ký' : 'Viết nhật ký hôm nay'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng trình viết"
              disabled={busy}
              onPress={close}
              style={e.iconButton}
            >
              <Text style={e.heading}>×</Text>
            </Pressable>
          </View>
        </View>
        <View style={e.card}>
          <View style={e.row}>
            <Text style={[e.step, sans]}>1</Text>
            <Text accessibilityRole="header" style={[e.heading, e.grow, sans]}>
              Tâm trạng &amp; Thời điểm
            </Text>
            <Text style={[e.pill, sans]}>Chỉ mình bạn xem</Text>
          </View>
          <View accessibilityRole="radiogroup" style={e.moods}>
            {moods.map((mood) => {
              const selected = draft.mood === mood.value
              return (
                <Pressable
                  key={mood.value}
                  accessibilityRole="radio"
                  accessibilityLabel={'Cảm xúc: ' + mood.label}
                  accessibilityState={{ checked: selected, disabled: locked }}
                  disabled={locked}
                  testID={'journal-mood-' + mood.value}
                  onPress={() =>
                    setDraft((value) => ({ ...value, mood: mood.value }))
                  }
                  style={({ pressed }) => [
                    e.mood,
                    { backgroundColor: mood.tint },
                    selected && e.selected,
                    pressed && e.pressed,
                  ]}
                >
                  <Text accessible={false} style={e.emoji}>
                    {mood.icon}
                  </Text>
                  <Text style={[e.moodLabel, sans]}>{mood.label}</Text>
                </Pressable>
              )
            })}
          </View>
          <View style={e.dateRow}>
            <Text style={[e.meta, e.grow, sans]}>
              ▣ {dateFormat.format(entry ? new Date(entry.occurredAt) : now())}
            </Text>
            {!entry && <Text style={[e.pill, sans]}>Bây giờ</Text>}
          </View>
        </View>
        <View style={[e.card, e.promptCard]}>
          <View style={e.row}>
            <View style={e.grow}>
              <Text accessibilityRole="header" style={[e.heading, sans]}>
                Gợi ý khơi gợi tâm trí
              </Text>
              <Text style={[e.meta, sans]}>Chạm để thêm vào trang viết</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đổi gợi ý"
              style={e.smallButton}
              onPress={() =>
                setPromptStart((value) => (value + 3) % prompts.length)
              }
            >
              <Text style={[e.link, sans]}>↻ Đổi gợi ý</Text>
            </Pressable>
          </View>
          {prompts.slice(promptStart, promptStart + 3).map((prompt) => {
            const applied = draft.text.split('\n').includes(prompt)
            return (
              <Pressable
                key={prompt}
                accessibilityRole="button"
                accessibilityLabel={prompt}
                accessibilityState={{
                  selected: applied,
                  disabled: locked || applied,
                }}
                disabled={locked || applied}
                onPress={() => insertPrompt(prompt)}
                style={({ pressed }) => [
                  e.prompt,
                  applied && e.appliedPrompt,
                  pressed && e.pressed,
                ]}
              >
                <Text style={[e.meta, sans]}>{applied ? '✓' : '○'}</Text>
                <Text style={[e.promptText, e.grow, sans]}>{prompt}</Text>
                <Text style={[e.pill, sans]}>
                  {applied ? 'Đã áp dụng' : 'Thêm'}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <View style={e.card}>
          <View style={e.row}>
            <Text style={[e.step, sans]}>2</Text>
            <Text accessibilityRole="header" style={[e.heading, e.grow, sans]}>
              Khung viết trọng tâm
            </Text>
            {dirty && <Text style={[e.meta, sans]}>Chưa lưu</Text>}
          </View>
          <View style={[e.row, e.toolbar]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm dòng danh sách"
              disabled={locked || draft.text.length > 11997}
              style={e.smallButton}
              onPress={() => setText(draft.text + (draft.text ? '\n• ' : '• '))}
            >
              <Text style={[e.link, sans]}>☷ Danh sách</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm dòng trích dẫn"
              disabled={locked || draft.text.length > 11998}
              style={e.smallButton}
              onPress={() => setText(draft.text + (draft.text ? '\n“' : '“'))}
            >
              <Text style={[e.link, sans]}>❞</Text>
            </Pressable>
            <Text style={[e.meta, e.count, sans]}>
              {draft.text.length}/12.000 ký tự
            </Text>
          </View>
          <TextInput
            accessibilityLabel="Nội dung nhật ký"
            testID="journal-text"
            multiline
            textAlignVertical="top"
            value={draft.text}
            editable={!locked}
            maxLength={12000}
            onChangeText={setText}
            style={[e.writing, sans]}
            placeholder="Một điều đã xảy ra, một cảm xúc hoặc điều bạn muốn giữ lại…"
            placeholderTextColor={colors.inkFaint}
          />
          <Text style={[e.meta, sans]}>
            Viết tự do · Chỉ bạn có thể mở bài viết này.
          </Text>
        </View>
        <View style={e.card}>
          <View style={e.row}>
            <Text style={[e.step, sans]}>3</Text>
            <Text accessibilityRole="header" style={[e.heading, e.grow, sans]}>
              Thẻ phân loại &amp; Ngữ cảnh
            </Text>
            <Text style={[e.meta, sans]}>{tags.length}/20 thẻ</Text>
          </View>
          <View style={e.tags}>
            {topics.map((topic) => {
              const normalized = topic.toLocaleLowerCase('vi')
              const selected = selectedTags.includes(normalized)
              const disabled = locked || (!selected && tags.length >= 20)
              return (
                <Pressable
                  key={topic}
                  accessibilityRole="button"
                  accessibilityLabel={topic}
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  style={[e.tag, selected && e.selected]}
                  onPress={() =>
                    setDraft((value) => ({
                      ...value,
                      tags: (selected
                        ? tags.filter(
                            (tag) => tag.toLocaleLowerCase('vi') !== normalized,
                          )
                        : [...tags, topic]
                      ).join(', '),
                    }))
                  }
                >
                  <Text style={[e.link, sans]}>
                    #{topic}
                    {selected ? '  ✓' : ''}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <TextInput
            accessibilityLabel="Nhãn nhật ký"
            value={draft.tags}
            editable={!locked}
            onChangeText={(tags) => setDraft((value) => ({ ...value, tags }))}
            style={[e.tagInput, sans]}
            placeholder="Nhập thẻ, ví dụ: Đi dạo, Biết ơn…"
            placeholderTextColor={colors.inkFaint}
          />
          <Text style={[e.meta, sans]}>
            Ngăn cách bằng dấu phẩy. Mỗi thẻ tối đa 40 ký tự.
          </Text>
        </View>
        {previousEntry && (
          <View style={e.previous}>
            <Text style={[e.link, sans]}>
              Nhật ký trước ·{' '}
              {dateFormat.format(new Date(previousEntry.occurredAt))}
            </Text>
            <Text numberOfLines={2} style={[e.meta, sans]}>
              {previousEntry.content.preview}
            </Text>
          </View>
        )}
        <View style={e.feedback}>
          {!parsed.success && dirty && (
            <Notice>
              Viết nội dung, chọn cảm xúc và kiểm tra độ dài các nhãn trước khi
              lưu.
            </Notice>
          )}
          {notice && (
            <Notice error={save.isError || reload.isError || remove.isError}>
              {notice}
            </Notice>
          )}
          {newerSource && (
            <Notice error>
              Bài viết đã có bản mới hơn. Nội dung đang viết được giữ lại; mở
              bản mới nhất trước khi lưu hoặc yêu cầu AI.
            </Notice>
          )}
          {(conflict || newerSource) && (
            <TextAction
              label="Mở bản mới nhất, bỏ phần chưa lưu"
              disabled={busy}
              onPress={() => reload.mutate()}
            />
          )}
          {entry && !uncertain && !confirmDelete && (
            <TextAction
              label="Xóa bài viết"
              disabled={busy}
              onPress={() => setConfirmDelete(true)}
            />
          )}
          {confirmDelete && (
            <View>
              <Notice error>
                Xóa bài viết này? Bài viết sẽ không còn trong nhật ký và không
                được dùng cho yêu cầu AI mới.
              </Notice>
              <TextAction
                label="Xác nhận xóa bài viết"
                disabled={busy}
                onPress={() => remove.mutate()}
              />
              <TextAction
                label="Giữ bài viết"
                disabled={busy}
                onPress={() => setConfirmDelete(false)}
              />
            </View>
          )}
        </View>
        {entry && (
          <JournalAnalysisPanel
            key={`${subject}:${entry.id}:${entry.currentRevision}`}
            api={api}
            subject={subject}
            target={{
              kind: 'EXACT',
              journalId: entry.id,
              revision: entry.currentRevision,
            }}
            blocked={dirty || conflict || newerSource || uncertain || busy}
            stale={entry.analysisState === 'stale'}
          />
        )}
      </View>
    </Screen>
  )
}

const e = StyleSheet.create({
  sans: { fontFamily: 'DashboardSans' },
  serif: { fontFamily: 'DashboardSerif' },
  serifFallback: { fontFamily: 'serif' },
  stack: { gap: spacing.md },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  brand: { fontSize: 21, color: colors.tealDeep, fontWeight: '700' },
  grow: { flex: 1, minWidth: 0 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.panel,
    padding: spacing.md,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 23, color: colors.tealDeep, fontWeight: '600' },
  kicker: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.tealPale,
    color: colors.tealDeep,
    fontSize: 11,
  },
  heading: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.inkSoft, fontSize: 11, lineHeight: 17 },
  count: { flex: 1, textAlign: 'right' },
  pill: {
    color: colors.tealDeep,
    backgroundColor: colors.surfaceSoft,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
    borderRadius: radii.pill,
    fontSize: 11,
    maxWidth: '37%',
  },
  step: {
    width: 23,
    lineHeight: 23,
    textAlign: 'center',
    backgroundColor: colors.tealPale,
    color: colors.tealDeep,
    fontSize: 12,
    fontWeight: '700',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  moods: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.xs },
  mood: {
    flex: 1,
    minHeight: 78,
    minWidth: 0,
    paddingHorizontal: 2,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  selected: { backgroundColor: colors.tealPale, borderColor: colors.teal },
  emoji: { fontSize: 22 },
  moodLabel: { color: colors.inkSoft, fontSize: 10, textAlign: 'center' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#F3F6F4',
    borderRadius: radii.control,
  },
  promptCard: { backgroundColor: '#F3F8F5', borderColor: colors.tealPale },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: radii.control,
  },
  appliedPrompt: { borderColor: colors.teal },
  promptText: { color: colors.ink, fontSize: 13, lineHeight: 20 },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
  },
  smallButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  link: { color: colors.tealDeep, fontSize: 12, fontWeight: '600' },
  toolbar: {
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    backgroundColor: '#F0F4F2',
    borderRadius: radii.control,
  },
  writing: {
    minHeight: 210,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink,
    padding: spacing.md,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FAFBFA',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  tagInput: {
    minHeight: 44,
    color: colors.ink,
    fontSize: 13,
    backgroundColor: '#F3F6F4',
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
  },
  previous: {
    backgroundColor: '#F0F4F2',
    borderRadius: radii.control,
    gap: spacing.xs,
    padding: spacing.md,
  },
  feedback: { gap: spacing.xs },
  actionBar: {
    backgroundColor: '#F7FAF8',
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  actionContent: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  cancel: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
  },
  cancelLabel: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  ctaText: { fontSize: 14, textAlign: 'center' },
  pressed: { opacity: 0.72 },
})
